package com.borom.wave;

import android.media.AudioFormat;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;

import com.borom.wave.core.mobile.Decoder;
import com.borom.wave.core.mobile.Source;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;

/**
 * Decodes the formats the Go core can't (AAC/ALAC in .m4a, Opus) with the
 * platform codecs. The Go engine pulls interleaved stereo 16-bit little-endian
 * PCM from it, so EQ, speed, reverb and crossfade apply as for other formats.
 */
final class AndroidDecoder implements Decoder {
    /** Output wait per loop; short since all available inputs are queued first. */
    private static final long TIMEOUT_US = 2_000;

    @Override
    public double duration(String path) throws Exception {
        MediaExtractor ex = new MediaExtractor();
        try {
            ex.setDataSource(path);
            MediaFormat f = ex.getTrackFormat(audioTrack(ex, path));
            if (!f.containsKey(MediaFormat.KEY_DURATION)) throw new Exception(path + ": unknown duration");
            return f.getLong(MediaFormat.KEY_DURATION) / 1e6;
        } finally {
            ex.release();
        }
    }

    @Override
    public Source open(String path) throws Exception {
        return new CodecSource(path);
    }

    private static int audioTrack(MediaExtractor ex, String path) throws Exception {
        for (int i = 0; i < ex.getTrackCount(); i++) {
            String mime = ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME);
            if (mime != null && mime.startsWith("audio/")) return i;
        }
        throw new Exception(path + ": no audio track");
    }

    /** One file being decoded. Calls come from the Go audio thread, one at a time. */
    private static final class CodecSource implements Source {
        private final MediaExtractor ex = new MediaExtractor();
        private final MediaCodec codec;
        private final MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        private final long durationUs;

        private int rate;
        private int channels;
        private boolean floatPcm;
        private boolean inputDone, outputDone;
        /** After a seek: output before this time is decoded but dropped. -1 when not seeking. */
        private long seekTargetUs = -1;

        /** Converted PCM not handed to Go yet. */
        private byte[] pending;
        private int pendingOff;

        CodecSource(String path) throws Exception {
            ex.setDataSource(path);
            int track = audioTrack(ex, path);
            ex.selectTrack(track);
            MediaFormat format = ex.getTrackFormat(track);
            durationUs = format.containsKey(MediaFormat.KEY_DURATION) ? format.getLong(MediaFormat.KEY_DURATION) : 0;
            rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
            channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);

            codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME));
            try {
                codec.configure(format, null, null, 0);
                codec.start();
                // Decode the first block now: the output format (actual rate, e.g. doubled
                // for HE-AAC) is only known then, and Go reads SampleRate right after open.
                pending = decodeChunk();
            } catch (Exception e) {
                codec.release();
                ex.release();
                throw e;
            }
        }

        @Override
        public synchronized long sampleRate() { return rate; }

        @Override
        public synchronized long frames() { return durationUs * rate / 1_000_000; }

        @Override
        public synchronized byte[] read(long max) throws Exception {
            byte[] out = new byte[(int) max * 4];
            int n = 0;
            while (n < out.length) {
                if (pending == null || pendingOff == pending.length) {
                    pending = decodeChunk();
                    pendingOff = 0;
                    if (pending == null) break;
                }
                int c = Math.min(out.length - n, pending.length - pendingOff);
                System.arraycopy(pending, pendingOff, out, n, c);
                pendingOff += c;
                n += c;
            }
            return n == out.length ? out : Arrays.copyOf(out, n);
        }

        @Override
        public synchronized void seekFrame(long frame) {
            long us = frame * 1_000_000 / rate;
            ex.seekTo(us, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
            codec.flush();
            inputDone = outputDone = false;
            pending = null;
            pendingOff = 0;
            seekTargetUs = us;
        }

        @Override
        public synchronized void close() {
            try {
                codec.stop();
            } catch (IllegalStateException ignored) {
                // Already stopped after an error.
            }
            codec.release();
            ex.release();
        }

        /** Decodes until a block of output is ready; null at the end of the stream. */
        private byte[] decodeChunk() {
            while (!outputDone) {
                // Keep the codec's input full, or it idles while we wait for output.
                while (!inputDone && feedInput()) {}
                int o = codec.dequeueOutputBuffer(info, TIMEOUT_US);
                if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    readOutputFormat(codec.getOutputFormat());
                    continue;
                }
                if (o < 0) continue; // INFO_TRY_AGAIN_LATER

                ByteBuffer buf = codec.getOutputBuffer(o);
                byte[] chunk = buf == null ? new byte[0] : toStereo16(buf, info.offset, info.size);
                long pts = info.presentationTimeUs;
                if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outputDone = true;
                codec.releaseOutputBuffer(o, false);

                if (seekTargetUs >= 0) {
                    long drop = (seekTargetUs - pts) * rate / 1_000_000;
                    if (drop * 4 >= chunk.length) continue; // still before the target
                    if (drop > 0) chunk = Arrays.copyOfRange(chunk, (int) drop * 4, chunk.length);
                    seekTargetUs = -1;
                }
                if (chunk.length > 0) return chunk;
            }
            return null;
        }

        /** Queues one input buffer; false when none is free right now. */
        private boolean feedInput() {
            int i = codec.dequeueInputBuffer(0);
            if (i < 0) return false;
            ByteBuffer b = codec.getInputBuffer(i);
            int n = b == null ? -1 : ex.readSampleData(b, 0);
            if (n < 0) {
                codec.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                inputDone = true;
            } else {
                codec.queueInputBuffer(i, 0, n, ex.getSampleTime(), 0);
                ex.advance();
            }
            return true;
        }

        private void readOutputFormat(MediaFormat f) {
            if (f.containsKey(MediaFormat.KEY_SAMPLE_RATE)) rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE);
            if (f.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
            floatPcm = f.containsKey(MediaFormat.KEY_PCM_ENCODING)
                && f.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT;
        }

        /** Codec output (16-bit or float, any channel count) to stereo 16-bit little-endian. */
        private byte[] toStereo16(ByteBuffer src, int offset, int size) {
            src = src.duplicate().order(ByteOrder.nativeOrder());
            int sampleBytes = floatPcm ? 4 : 2;
            int frames = size / (sampleBytes * channels);
            ByteBuffer out = ByteBuffer.allocate(frames * 4).order(ByteOrder.LITTLE_ENDIAN);
            for (int f = 0; f < frames; f++) {
                int base = offset + f * channels * sampleBytes;
                short l = sample(src, base);
                // Mono is duplicated; beyond stereo, only front left/right are kept.
                short r = channels > 1 ? sample(src, base + sampleBytes) : l;
                out.putShort(l).putShort(r);
            }
            return out.array();
        }

        private short sample(ByteBuffer b, int pos) {
            if (!floatPcm) return b.getShort(pos);
            float v = Math.max(-1f, Math.min(1f, b.getFloat(pos)));
            return (short) (v * 32767);
        }
    }
}
