package audio

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gopxl/beep/v2"
	"github.com/gopxl/beep/v2/flac"
	"github.com/gopxl/beep/v2/mp3"
	"github.com/gopxl/beep/v2/vorbis"
	"github.com/gopxl/beep/v2/wav"
)

// SupportedExt lists the file extensions the player can decode.
var SupportedExt = map[string]bool{".mp3": true, ".flac": true, ".ogg": true, ".wav": true}

// Open decodes an audio file. The returned streamer owns the file and closes it on Close.
func Open(path string) (beep.StreamSeekCloser, beep.Format, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, beep.Format{}, err
	}
	var (
		s      beep.StreamSeekCloser
		format beep.Format
	)
	switch strings.ToLower(filepath.Ext(path)) {
	case ".mp3":
		s, format, err = mp3.Decode(f)
	case ".flac":
		s, format, err = flac.Decode(f)
	case ".ogg":
		s, format, err = vorbis.Decode(f)
	case ".wav":
		s, format, err = wav.Decode(f)
	default:
		err = fmt.Errorf("unsupported format: %s", filepath.Ext(path))
	}
	if err != nil {
		f.Close()
		return nil, beep.Format{}, err
	}
	return s, format, nil
}

// Duration returns the length of an audio file in seconds.
func Duration(path string) (float64, error) {
	s, format, err := Open(path)
	if err != nil {
		return 0, err
	}
	defer s.Close()
	return float64(s.Len()) / float64(format.SampleRate), nil
}
