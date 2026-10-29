package audio

import (
	"encoding/binary"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

// rampSource yields frame i as (i, -i) in int16, in chunks of at most chunk frames.
type rampSource struct {
	frames, pos int64
	chunk       int
	closed      bool
}

func (r *rampSource) SampleRate() int { return 48000 }
func (r *rampSource) Frames() int64   { return r.frames }
func (r *rampSource) Read(max int) ([]byte, error) {
	n := min(int64(max), int64(r.chunk), r.frames-r.pos)
	b := make([]byte, n*bytesPerFrame)
	for i := range n {
		v := int16(r.pos + i)
		binary.LittleEndian.PutUint16(b[i*4:], uint16(v))
		binary.LittleEndian.PutUint16(b[i*4+2:], uint16(-v))
	}
	r.pos += n
	return b, nil
}
func (r *rampSource) SeekFrame(f int64) error { r.pos = f; return nil }
func (r *rampSource) Close()                  { r.closed = true }

func TestPCMStreamer(t *testing.T) {
	src := &rampSource{frames: 1000, chunk: 7}
	s := newPCMStreamer(src)
	if s.Len() != 1000 {
		t.Fatalf("Len = %d", s.Len())
	}
	buf := make([][2]float64, 300)
	n, ok := s.Stream(buf)
	if n != 300 || !ok {
		t.Fatalf("Stream = %d %v", n, ok)
	}
	for i, f := range buf {
		if want := float64(i) / 32768; f[0] != want || f[1] != -want {
			t.Fatalf("frame %d = %v, want %v", i, f, want)
		}
	}
	if err := s.Seek(900); err != nil || s.Position() != 900 {
		t.Fatalf("Seek: %v, pos %d", err, s.Position())
	}
	n, _ = s.Stream(buf)
	if n != 100 || buf[0][0] != 900.0/32768 {
		t.Fatalf("after seek: n=%d first=%v", n, buf[0][0])
	}
	if n, ok = s.Stream(buf); n != 0 || ok {
		t.Fatalf("at end: %d %v", n, ok)
	}
	s.Close()
	if !src.closed {
		t.Error("source not closed")
	}
}

func TestPCMStreamerSeekWhileReading(t *testing.T) {
	src := &rampSource{frames: 100000, chunk: 512}
	s := newPCMStreamer(src)
	buf := make([][2]float64, 100)
	s.Stream(buf) // reader goroutine now running ahead
	if err := s.Seek(50000); err != nil {
		t.Fatal(err)
	}
	s.Stream(buf)
	target := int64(50000) // the ramp wraps around int16
	if want := float64(int16(target)) / 32768; buf[0][0] != want {
		t.Fatalf("after seek: first = %v, want %v", buf[0][0], want)
	}
	s.Close()
}

func TestPCMStreamerCloseUnread(t *testing.T) {
	src := &rampSource{frames: 10, chunk: 10}
	newPCMStreamer(src).Close()
	if !src.closed {
		t.Error("source not closed")
	}
}

type fakeDecoder struct{ opened string }

func (f *fakeDecoder) Open(path string) (PCMSource, error) {
	f.opened = path
	return &rampSource{frames: 10, chunk: 10}, nil
}
func (f *fakeDecoder) Duration(string) (float64, error) { return 1.5, nil }

func TestExternalRouting(t *testing.T) {
	dir := t.TempDir()
	notVorbis := filepath.Join(dir, "opus.ogg")
	if err := os.WriteFile(notVorbis, []byte("OggS not vorbis"), 0o644); err != nil {
		t.Fatal(err)
	}

	if Supported(".m4a") {
		t.Error(".m4a supported without an external decoder")
	}
	dec := &fakeDecoder{}
	SetExternalDecoder(dec)
	defer SetExternalDecoder(nil)
	if !Supported(".m4a") || !Supported(".opus") || !Supported(".mp3") {
		t.Error("extensions not supported with an external decoder")
	}

	s, format, err := Open(notVorbis)
	if err != nil || dec.opened != notVorbis || format.SampleRate != 48000 {
		t.Fatalf("ogg fallback: %v, opened %q, rate %d", err, dec.opened, format.SampleRate)
	}
	s.Close()
	if d, err := Duration(filepath.Join(dir, "x.m4a")); err != nil || d != 1.5 {
		t.Errorf("Duration = %v %v", d, err)
	}
}

func TestFFmpegDecoder(t *testing.T) {
	dec, ok := NewFFmpegDecoder()
	if !ok {
		t.Skip("ffmpeg/ffprobe not in PATH")
	}
	ffmpeg, _ := exec.LookPath("ffmpeg")
	for _, name := range []string{"a.m4a", "a.opus", "a.ogg"} {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), name)
			args := []string{"-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-ac", "2"}
			if name == "a.ogg" {
				args = append(args, "-c:a", "libopus") // Opus in Ogg: the Vorbis decoder must fail over
			}
			if out, err := exec.Command(ffmpeg, append(args, path)...).CombinedOutput(); err != nil {
				t.Skipf("ffmpeg cannot encode %s: %v %s", name, err, out)
			}
			SetExternalDecoder(dec)
			defer SetExternalDecoder(nil)

			d, err := Duration(path)
			if err != nil || math.Abs(d-2) > 0.1 {
				t.Fatalf("Duration = %v %v", d, err)
			}
			s, format, err := Open(path)
			if err != nil {
				t.Fatal(err)
			}
			defer s.Close()
			buf := make([][2]float64, int(format.SampleRate)/2)
			n, _ := s.Stream(buf)
			if n != len(buf) || peak(buf) < 0.05 {
				t.Fatalf("Stream: n=%d peak=%v", n, peak(buf))
			}
			if err := s.Seek(int(format.SampleRate)); err != nil {
				t.Fatal(err)
			}
			n, _ = s.Stream(buf)
			if n != len(buf) || peak(buf) < 0.05 {
				t.Fatalf("after Seek: n=%d peak=%v", n, peak(buf))
			}
		})
	}
}
