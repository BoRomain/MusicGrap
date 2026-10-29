// Package settings persists user preferences as JSON.
package settings

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Settings struct {
	MusicDir        string      `json:"musicDir"`
	Volume          float64     `json:"volume"`
	EQ              [10]float64 `json:"eq"`
	EQPreset        string      `json:"eqPreset"`
	Speed           float64     `json:"speed"`
	ReverbWet       float64     `json:"reverbWet"`
	ReverbRoom      float64     `json:"reverbRoom"`
	Crossfade       float64     `json:"crossfade"`
	CrossfadeOnSkip bool        `json:"crossfadeOnSkip"`
	Shuffle         bool        `json:"shuffle"`
	Repeat          string      `json:"repeat"`
}

func Defaults() Settings {
	return Settings{
		Volume:     0.8,
		EQPreset:   "Flat",
		Speed:      1,
		ReverbRoom: 0.6,
		Crossfade:  5,
		Repeat:     "off",
	}
}

// Dir returns the per-user config directory of the app.
func Dir() string {
	base, err := os.UserConfigDir()
	if err != nil {
		base = "."
	}
	return filepath.Join(base, "wave-player")
}

func path() string { return filepath.Join(Dir(), "settings.json") }

// Load returns saved settings, falling back to defaults for anything missing.
func Load() Settings {
	s := Defaults()
	if b, err := os.ReadFile(path()); err == nil {
		json.Unmarshal(b, &s)
	}
	return s
}

func Save(s Settings) error {
	if err := os.MkdirAll(Dir(), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path(), b, 0o644)
}
