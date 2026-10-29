package audio

import (
	"encoding/binary"
	"sync"

	"github.com/gopxl/beep/v2"
)

// PCMSource is audio decoded outside of Go (ffmpeg on desktop, MediaCodec on
// Android), delivered as interleaved stereo 16-bit little-endian PCM.
type PCMSource interface {
	SampleRate() int
	// Frames is the total length in frames (one frame = one stereo sample).
	Frames() int64
	// Read returns up to max frames; an empty result means the end of the stream.
	Read(max int) ([]byte, error)
	SeekFrame(frame int64) error
	Close()
}

// ExternalDecoder opens the formats the Go decoders don't handle (AAC, ALAC, Opus).
type ExternalDecoder interface {
	Open(path string) (PCMSource, error)
	// Duration is the length in seconds, read without decoding (used by the library scan).
	Duration(path string) (float64, error)
}

// ExternalExt lists the extensions handed to the external decoder, when there is one.
// Ogg files go to it too when they are not Vorbis (Ogg Opus).
var ExternalExt = map[string]bool{".m4a": true, ".mp4": true, ".aac": true, ".opus": true}

var (
	externalMu sync.RWMutex
	external   ExternalDecoder
)

// SetExternalDecoder installs the decoder for ExternalExt. Call it before scanning the library.
func SetExternalDecoder(d ExternalDecoder) {
	externalMu.Lock()
	external = d
	externalMu.Unlock()
}

func externalDecoder() ExternalDecoder {
	externalMu.RLock()
	defer externalMu.RUnlock()
	return external
}

// Supported reports whether files with this (lowercase) extension can be played.
func Supported(ext string) bool {
	return SupportedExt[ext] || ExternalExt[ext] && externalDecoder() != nil
}

const bytesPerFrame = 4 // 2 channels × int16

// pcmStreamer adapts a PCMSource to beep.StreamSeekCloser.
type pcmStreamer struct {
	src PCMSource
	len int
	pos int
	buf []byte // decoded bytes not consumed yet
	err error
}

func newPCMStreamer(src PCMSource) *pcmStreamer {
	return &pcmStreamer{src: src, len: int(src.Frames())}
}

func (p *pcmStreamer) Stream(samples [][2]float64) (int, bool) {
	if p.err != nil {
		return 0, false
	}
	n := 0
	for n < len(samples) {
		if len(p.buf) < bytesPerFrame {
			b, err := p.src.Read(len(samples) - n)
			if err != nil {
				p.err = err
			}
			if len(b) < bytesPerFrame {
				break
			}
			p.buf = b
		}
		for n < len(samples) && len(p.buf) >= bytesPerFrame {
			l := int16(binary.LittleEndian.Uint16(p.buf[0:]))
			r := int16(binary.LittleEndian.Uint16(p.buf[2:]))
			samples[n] = [2]float64{float64(l) / 32768, float64(r) / 32768}
			p.buf = p.buf[bytesPerFrame:]
			n++
		}
	}
	p.pos += n
	return n, n > 0
}

func (p *pcmStreamer) Err() error    { return p.err }
func (p *pcmStreamer) Len() int      { return p.len }
func (p *pcmStreamer) Position() int { return p.pos }

func (p *pcmStreamer) Seek(frame int) error {
	if err := p.src.SeekFrame(int64(frame)); err != nil {
		return err
	}
	p.pos, p.buf, p.err = frame, nil, nil
	return nil
}

func (p *pcmStreamer) Close() error {
	p.src.Close()
	return nil
}

// openExternal decodes path with the external decoder.
func openExternal(d ExternalDecoder, path string) (beep.StreamSeekCloser, beep.Format, error) {
	src, err := d.Open(path)
	if err != nil {
		return nil, beep.Format{}, err
	}
	format := beep.Format{SampleRate: beep.SampleRate(src.SampleRate()), NumChannels: 2, Precision: 2}
	return newPCMStreamer(src), format, nil
}
