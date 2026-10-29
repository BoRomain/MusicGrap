package audio

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strconv"
)

// ffmpegDecoder decodes through the ffmpeg and ffprobe executables (desktop).
type ffmpegDecoder struct {
	ffmpeg, ffprobe string
}

// NewFFmpegDecoder returns a decoder using ffmpeg and ffprobe from the PATH,
// or false when either is missing.
func NewFFmpegDecoder() (ExternalDecoder, bool) {
	ffmpeg, err1 := exec.LookPath("ffmpeg")
	ffprobe, err2 := exec.LookPath("ffprobe")
	if err1 != nil || err2 != nil {
		return nil, false
	}
	return &ffmpegDecoder{ffmpeg: ffmpeg, ffprobe: ffprobe}, true
}

// probe returns the sample rate and duration (seconds) of the first audio stream.
func (d *ffmpegDecoder) probe(path string) (rate int, dur float64, err error) {
	cmd := exec.Command(d.ffprobe, "-v", "error", "-select_streams", "a:0",
		"-show_entries", "stream=sample_rate,duration:format=duration", "-of", "json", path)
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		return 0, 0, fmt.Errorf("ffprobe %s: %w", path, err)
	}
	var info struct {
		Streams []struct {
			SampleRate string `json:"sample_rate"`
			Duration   string `json:"duration"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &info); err != nil {
		return 0, 0, err
	}
	if len(info.Streams) == 0 {
		return 0, 0, fmt.Errorf("ffprobe %s: no audio stream", path)
	}
	rate, _ = strconv.Atoi(info.Streams[0].SampleRate)
	// Stream duration is missing for some containers (Matroska, Ogg): fall back to the file's.
	dur, err = strconv.ParseFloat(info.Streams[0].Duration, 64)
	if err != nil {
		dur, err = strconv.ParseFloat(info.Format.Duration, 64)
	}
	if rate <= 0 || err != nil {
		return 0, 0, fmt.Errorf("ffprobe %s: no sample rate or duration", path)
	}
	return rate, dur, nil
}

func (d *ffmpegDecoder) Duration(path string) (float64, error) {
	_, dur, err := d.probe(path)
	return dur, err
}

func (d *ffmpegDecoder) Open(path string) (PCMSource, error) {
	rate, dur, err := d.probe(path)
	if err != nil {
		return nil, err
	}
	return &ffmpegSource{dec: d, path: path, rate: rate, frames: int64(dur * float64(rate))}, nil
}

// ffmpegSource streams one file from an ffmpeg process, started on the first
// Read and restarted at the new position on Seek.
type ffmpegSource struct {
	dec    *ffmpegDecoder
	path   string
	rate   int
	frames int64

	start int64 // frame the current process started at
	cmd   *exec.Cmd
	out   io.ReadCloser
	buf   []byte
}

func (s *ffmpegSource) SampleRate() int { return s.rate }
func (s *ffmpegSource) Frames() int64   { return s.frames }

func (s *ffmpegSource) launch() error {
	sec := float64(s.start) / float64(s.rate)
	cmd := exec.Command(s.dec.ffmpeg, "-v", "error", "-nostdin",
		"-ss", strconv.FormatFloat(sec, 'f', 6, 64), "-i", s.path,
		"-vn", "-f", "s16le", "-ac", "2", "-ar", strconv.Itoa(s.rate), "-")
	hideWindow(cmd)
	out, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("ffmpeg %s: %w", s.path, err)
	}
	s.cmd, s.out = cmd, out
	return nil
}

func (s *ffmpegSource) Read(max int) ([]byte, error) {
	if s.cmd == nil {
		if err := s.launch(); err != nil {
			return nil, err
		}
	}
	if cap(s.buf) < max*bytesPerFrame {
		s.buf = make([]byte, max*bytesPerFrame)
	}
	// Fill the buffer (a pipe read can stop in the middle of a frame); short only at the end.
	n, err := io.ReadFull(s.out, s.buf[:max*bytesPerFrame])
	n -= n % bytesPerFrame
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		err = nil
	}
	return s.buf[:n], err
}

func (s *ffmpegSource) SeekFrame(frame int64) error {
	s.stop()
	s.start = frame
	return nil
}

func (s *ffmpegSource) stop() {
	if s.cmd != nil {
		s.cmd.Process.Kill()
		s.cmd.Wait()
		s.cmd, s.out = nil, nil
	}
}

func (s *ffmpegSource) Close() { s.stop() }
