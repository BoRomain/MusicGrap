package library

import (
	"math"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/gopxl/beep/v2"
	"github.com/gopxl/beep/v2/wav"

	"musicplayer/internal/audio"
)

// writeTone writes a 1-second 440 Hz WAV at 48 kHz.
func writeTone(t *testing.T, path string) {
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	rate := beep.SampleRate(48000)
	n := 0
	tone := beep.StreamerFunc(func(s [][2]float64) (int, bool) {
		if n >= int(rate) {
			return 0, false
		}
		k := min(len(s), int(rate)-n)
		for i := range k {
			v := 0.3 * math.Sin(2*math.Pi*440*float64(n+i)/float64(rate))
			s[i] = [2]float64{v, v}
		}
		n += k
		return k, true
	})
	if err := wav.Encode(f, tone, beep.Format{SampleRate: rate, NumChannels: 2, Precision: 2}); err != nil {
		t.Fatal(err)
	}
}

func TestSortOrder(t *testing.T) {
	l := &Library{}
	l.set([]Track{
		{ID: "unnumbered", Artist: "A", Album: "X", DiscNo: 2},
		{ID: "d2t1", Artist: "A", Album: "X", DiscNo: 2, TrackNo: 1},
		{ID: "feat", Artist: "Z feat. A", AlbumArtist: "A", Album: "X", DiscNo: 1, TrackNo: 2},
		{ID: "other", Artist: "B", Album: "Y", TrackNo: 1},
		{ID: "d1t1", Artist: "A", Album: "X", DiscNo: 1, TrackNo: 1},
		{ID: "z2", Artist: "Ziak, Lowonstage", Album: "M", TrackNo: 2},
		{ID: "z1", Artist: "Ziak, Rosaliedu38, Koboi", Album: "M", TrackNo: 1},
		{ID: "z3", Artist: "Ziak feat. Plyer", Album: "M", TrackNo: 3},
	})
	var got []string
	for _, tr := range l.Tracks() {
		got = append(got, tr.ID)
	}
	want := []string{"d1t1", "feat", "d2t1", "unnumbered", "other", "z1", "z2", "z3"}
	if !slices.Equal(got, want) {
		t.Fatalf("order = %v, want %v", got, want)
	}
}

func TestScanAndPlayRealFile(t *testing.T) {
	dir := t.TempDir()
	music := filepath.Join(dir, "music", "Artist")
	os.MkdirAll(music, 0o755)
	writeTone(t, filepath.Join(music, "01 - Tone.wav"))
	os.WriteFile(filepath.Join(music, "notes.txt"), []byte("ignored"), 0o644)

	cache := filepath.Join(dir, "library.json")
	lib := New(cache)
	if err := lib.Scan(filepath.Join(dir, "music"), nil); err != nil {
		t.Fatal(err)
	}
	tracks := lib.Tracks()
	if len(tracks) != 1 || tracks[0].Title != "01 - Tone" || tracks[0].TrackNo != 1 || math.Abs(tracks[0].Duration-1) > 0.01 {
		t.Fatalf("tracks = %+v", tracks)
	}

	// The cache is reloaded identically.
	if again := New(cache).Tracks(); len(again) != 1 || again[0] != tracks[0] {
		t.Fatalf("cache mismatch: %+v", again)
	}

	// Decode through the engine: 48 kHz source resampled to 44.1 kHz output.
	d, err := audio.NewDeck(tracks[0].Path, tracks[0].ID, 0)
	if err != nil {
		t.Fatal(err)
	}
	e := audio.NewEngine()
	e.Skip(d, 0)
	out := make([][2]float64, int(audio.SampleRate)+4410)
	for i := 0; i < len(out); i += 512 {
		e.Stream(out[i:min(i+512, len(out))])
	}
	peak := 0.0
	for _, s := range out[:int(audio.SampleRate)-100] {
		peak = math.Max(peak, math.Abs(s[0]))
	}
	if math.Abs(peak-0.3) > 0.01 {
		t.Fatalf("peak = %v, want 0.3", peak)
	}
	if out[len(out)-1][0] != 0 {
		t.Fatal("expected silence after the 1 s file")
	}
}

func TestReleaseDate(t *testing.T) {
	for in, want := range map[string]string{
		"2021-05-14T00:00:00": "2021-05-14",
		"2019":                "2019",
		" 2020-03 ":           "2020-03",
		"":                    "",
		"abc":                 "",
	} {
		if got := releaseDate(in); got != want {
			t.Errorf("releaseDate(%q) = %q, want %q", in, got, want)
		}
	}
}
