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
	ext := strings.ToLower(filepath.Ext(path))
	dec := externalDecoder()
	if ExternalExt[ext] {
		if dec == nil {
			return nil, beep.Format{}, fmt.Errorf("unsupported format: %s (no external decoder)", ext)
		}
		return openExternal(dec, path)
	}
	s, format, err := openGo(path, ext)
	if err != nil && ext == ".ogg" && dec != nil {
		// Not Vorbis: most likely Opus in an Ogg container.
		return openExternal(dec, path)
	}
	return s, format, err
}

// openGo decodes the formats handled by pure Go decoders.
func openGo(path, ext string) (beep.StreamSeekCloser, beep.Format, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, beep.Format{}, err
	}
	var (
		s      beep.StreamSeekCloser
		format beep.Format
	)
	switch ext {
	case ".mp3":
		s, format, err = mp3.Decode(f)
	case ".flac":
		s, format, err = flac.Decode(f)
	case ".ogg":
		s, format, err = vorbis.Decode(f)
	case ".wav":
		s, format, err = wav.Decode(f)
	default:
		err = fmt.Errorf("unsupported format: %s", ext)
	}
	if err != nil {
		f.Close()
		return nil, beep.Format{}, err
	}
	return s, format, nil
}

// Duration returns the length of an audio file in seconds.
func Duration(path string) (float64, error) {
	ext := strings.ToLower(filepath.Ext(path))
	dec := externalDecoder()
	if dec != nil && ExternalExt[ext] {
		return dec.Duration(path)
	}
	s, format, err := openGo(path, ext)
	if err != nil {
		if ext == ".ogg" && dec != nil {
			return dec.Duration(path)
		}
		return 0, err
	}
	defer s.Close()
	return float64(s.Len()) / float64(format.SampleRate), nil
}
