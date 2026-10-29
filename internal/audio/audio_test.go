package audio

import (
	"math"
	"testing"
)

// constSource is an in-memory StreamSeekCloser producing a constant value.
type constSource struct {
	val      float64
	pos, len int
}

func (c *constSource) Stream(s [][2]float64) (int, bool) {
	n := min(len(s), c.len-c.pos)
	for i := range n {
		s[i] = [2]float64{c.val, c.val}
	}
	c.pos += n
	return n, n > 0
}
func (c *constSource) Err() error       { return nil }
func (c *constSource) Len() int         { return c.len }
func (c *constSource) Position() int    { return c.pos }
func (c *constSource) Seek(p int) error { c.pos = p; return nil }
func (c *constSource) Close() error     { return nil }

func testDeck(val float64, seconds float64, id string) *Deck {
	return newDeck(&constSource{val: val, len: int(seconds * float64(SampleRate))}, float64(SampleRate), id, 0)
}

func render(e *Engine, seconds float64) [][2]float64 {
	out := make([][2]float64, int(seconds*float64(SampleRate)))
	for i := 0; i < len(out); i += 512 {
		e.Stream(out[i:min(i+512, len(out))])
	}
	return out
}

func sine(freq float64, n int) [][2]float64 {
	s := make([][2]float64, n)
	for i := range s {
		v := 0.25 * math.Sin(2*math.Pi*freq*float64(i)/float64(SampleRate))
		s[i] = [2]float64{v, v}
	}
	return s
}

func peak(s [][2]float64) float64 {
	p := 0.0
	for _, x := range s {
		p = math.Max(p, math.Abs(x[0]))
	}
	return p
}

func TestEQFlatIsTransparent(t *testing.T) {
	eq := NewEqualizer(float64(SampleRate))
	in := sine(440, 4096)
	out := sine(440, 4096)
	eq.Process(out)
	for i := range in {
		if in[i] != out[i] {
			t.Fatalf("sample %d changed: %v -> %v", i, in[i], out[i])
		}
	}
}

func TestEQBoostsBand(t *testing.T) {
	eq := NewEqualizer(float64(SampleRate))
	eq.SetGain(5, 6) // 1 kHz +6 dB
	s := sine(1000, 44100)
	eq.Process(s)
	// +6 dB ≈ ×2, minus the automatic headroom of 0.6×6 dB.
	want := 0.25 * math.Pow(10, (6-3.6)/20)
	if got := peak(s[22050:]); math.Abs(got-want) > 0.01 {
		t.Fatalf("peak = %.4f, want ≈ %.4f", got, want)
	}
}

func TestReverbDryAndStable(t *testing.T) {
	r := NewReverb()
	s := sine(300, 1000)
	r.Process(s)
	if peak(s) != peak(sine(300, 1000)) {
		t.Fatal("wet=0 must leave the signal untouched")
	}
	r.SetParams(1, 1)
	noise := make([][2]float64, 10*int(SampleRate))
	for i := range noise {
		v := math.Sin(float64(i)*12.9898) * 0.5
		noise[i] = [2]float64{v, -v}
	}
	r.Process(noise)
	for _, x := range noise {
		if math.IsNaN(x[0]) || math.Abs(x[0]) > 10 {
			t.Fatalf("reverb unstable: %v", x)
		}
	}
}

func TestGaplessKeepsEverySample(t *testing.T) {
	e := NewEngine()
	e.Skip(testDeck(0.1, 1, "a"), 0)
	e.SetNext(testDeck(0.2, 1, "b"), true) // crossfade is 0: gapless
	out := render(e, 2.5)
	n := int(SampleRate)
	if out[n-1][0] != 0.1 || out[n][0] != 0.2 || out[2*n-1][0] != 0.2 {
		t.Fatalf("boundary samples: %v %v %v", out[n-1][0], out[n][0], out[2*n-1][0])
	}
	if out[2*n][0] != 0 {
		t.Fatal("expected silence after the queue ends")
	}
}

func TestCrossfadeEqualPower(t *testing.T) {
	e := NewEngine()
	e.SetCrossfade(2)
	e.Skip(testDeck(0.5, 5, "a"), 0)
	e.SetNext(testDeck(0.5, 5, "b"), true)
	out := render(e, 8.5)

	n := int(SampleRate)
	// Fade spans [3s, 5s): with identical inputs, gOut+gIn peaks at √2 mid-fade.
	if v := out[3*n-10][0]; math.Abs(v-0.5) > 1e-9 {
		t.Fatalf("before fade: %v", v)
	}
	mid := out[4*n][0] / 0.5
	if math.Abs(mid-math.Sqrt2) > 0.01 {
		t.Fatalf("mid-fade gain = %v, want √2 (equal-power)", mid)
	}
	// The second track is 5s long and started at 3s, so it ends at 8s.
	if out[8*n-10][0] == 0 || out[8*n+10][0] != 0 {
		t.Fatal("second track has wrong length after crossfade")
	}

	var started []string
	for len(e.Events) > 0 {
		if ev := <-e.Events; ev.Kind == EventTrackStarted {
			started = append(started, ev.Deck.ID)
		}
	}
	if len(started) != 2 || started[1] != "b" {
		t.Fatalf("track started events = %v", started)
	}
}

func TestCrossfadeLengthIndependentOfSpeed(t *testing.T) {
	e := NewEngine()
	e.SetCrossfade(2)
	e.SetSpeed(0.5)
	e.Skip(testDeck(0.5, 3, "a"), 0) // 3s of source = 6s at half speed
	e.SetNext(testDeck(0.5, 10, "b"), true)
	out := render(e, 7)
	n := int(SampleRate)
	// Fade should cover [4s, 6s) of output; outside it, the level is exactly 0.5.
	if v := out[4*n-600][0]; math.Abs(v-0.5) > 1e-3 {
		t.Fatalf("fade started too early: %v", v)
	}
	if v := out[5*n][0]; v < 0.6 {
		t.Fatalf("not fading at 5s: %v", v)
	}
	if v := out[6*n+600][0]; math.Abs(v-0.5) > 1e-3 {
		t.Fatalf("fade not finished by 6s: %v", v)
	}
}

func TestPauseRampsToSilence(t *testing.T) {
	e := NewEngine()
	e.Skip(testDeck(0.5, 5, "a"), 0)
	render(e, 0.1)
	e.SetPaused(true)
	out := render(e, 0.1)
	if out[0][0] == 0 || out[len(out)-1][0] != 0 {
		t.Fatal("pause should ramp down then go silent")
	}
}
