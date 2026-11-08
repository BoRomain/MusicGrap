package com.borom.wave;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;

import com.borom.wave.core.mobile.Mobile;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Plays the Go engine's output. A thread at audio priority pulls PCM from the
 * core and writes it to an AudioTrack on the music path (deep buffer), with
 * enough ahead to ride out the CPU throttling of a long session screen off.
 */
final class AudioOutput {
    private static final String TAG = "AudioOutput";
    /** Frames per pull from the core, about 23 ms. */
    private static final int CHUNK_FRAMES = 1024;
    /** Audio written ahead of the speaker; also the delay of pause and seek. */
    private static final int BUFFER_MS = 250;
    private static final int FRAME_BYTES = 8; // stereo float
    /** Poll period while nothing is audible. */
    private static final long IDLE_MS = 100;
    private static final long REPORT_MS = 30_000;

    private AudioOutput() {}

    static void start() {
        Thread t = new Thread(AudioOutput::run, "Wave audio");
        t.setDaemon(true);
        t.start();
    }

    private static void run() {
        try {
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO);
        } catch (Exception e) {
            Log.w(TAG, "thread priority", e);
        }
        int rate = (int) Mobile.sampleRate();
        AudioFormat format = new AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
            .setSampleRate(rate)
            .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
            .build();
        int min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_FLOAT);
        AudioTrack track = new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build())
            .setAudioFormat(format)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_POWER_SAVING)
            .setBufferSizeInBytes(Math.max(min, rate * BUFFER_MS / 1000 * FRAME_BYTES))
            .build();
        Log.i(TAG, "buffer " + track.getBufferSizeInFrames() * 1000 / rate + " ms");

        boolean playing = false;
        long written = 0; // frames since the last flush
        int underruns = 0;
        long nextReport = SystemClock.elapsedRealtime() + REPORT_MS;
        for (;;) {
            byte[] pcm = Mobile.render(CHUNK_FRAMES);
            if (pcm == null || pcm.length == 0) {
                if (playing) {
                    // Let the fade-out already written play, then release the output.
                    drain(track, written);
                    track.pause();
                    track.flush();
                    playing = false;
                    written = 0;
                    underruns = track.getUnderrunCount(); // running dry here is expected
                }
                SystemClock.sleep(IDLE_MS);
                continue;
            }
            if (!playing) {
                track.play();
                playing = true;
            }
            ByteBuffer buf = ByteBuffer.wrap(pcm).order(ByteOrder.LITTLE_ENDIAN);
            while (buf.hasRemaining()) {
                int n = track.write(buf, buf.remaining(), AudioTrack.WRITE_BLOCKING);
                if (n < 0) {
                    Log.w(TAG, "write: " + n);
                    SystemClock.sleep(IDLE_MS);
                    break;
                }
            }
            written += pcm.length / FRAME_BYTES;

            long now = SystemClock.elapsedRealtime();
            if (now >= nextReport) {
                nextReport = now + REPORT_MS;
                int u = track.getUnderrunCount();
                if (u != underruns) Log.w(TAG, (u - underruns) + " underruns in the last 30 s");
                underruns = u;
            }
        }
    }

    /** Waits (bounded) until the track has played the frames written so far. */
    private static void drain(AudioTrack track, long written) {
        long deadline = SystemClock.elapsedRealtime() + BUFFER_MS * 4;
        while ((track.getPlaybackHeadPosition() & 0xffffffffL) < written
            && SystemClock.elapsedRealtime() < deadline) {
            SystemClock.sleep(10);
        }
    }
}
