package audio

import "math"

// EQBands are the center frequencies (Hz) of the 10-band graphic equalizer.
var EQBands = [10]float64{31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000}

const (
	eqQ       = 1.41
	EQMaxGain = 12.0
)

// EQPresets maps preset names to per-band gains in dB.
var EQPresets = map[string][10]float64{
	"Flat":         {},
	"Bass Boost":   {7, 6, 5, 3, 1, 0, 0, 0, 0, 0},
	"Treble Boost": {0, 0, 0, 0, 0, 1, 2, 4, 5, 6},
	"Vocal":        {-2, -2, -1, 1, 3, 4, 3, 1, 0, -1},
	"Rock":         {4, 3, 2, 0, -1, -1, 1, 3, 4, 4},
	"Electronic":   {5, 4, 1, 0, -2, 1, 0, 2, 4, 5},
	"Hip-Hop":      {6, 5, 2, 3, -1, -1, 1, 0, 2, 3},
	"Lo-Fi":        {3, 2, 1, 0, 0, -1, -3, -5, -8, -10},
}

type biquad struct {
	b0, b1, b2, a1, a2 float64
	z1, z2             [2]float64 // transposed direct form II state per channel
}

// setPeaking configures the filter as an RBJ peaking EQ.
func (f *biquad) setPeaking(freq, gainDB, q, rate float64) {
	a := math.Pow(10, gainDB/40)
	w0 := 2 * math.Pi * freq / rate
	alpha := math.Sin(w0) / (2 * q)
	cosw := math.Cos(w0)
	a0 := 1 + alpha/a
	f.b0 = (1 + alpha*a) / a0
	f.b1 = -2 * cosw / a0
	f.b2 = (1 - alpha*a) / a0
	f.a1 = -2 * cosw / a0
	f.a2 = (1 - alpha/a) / a0
}

func (f *biquad) process(x float64, ch int) float64 {
	y := f.b0*x + f.z1[ch]
	f.z1[ch] = f.b1*x - f.a1*y + f.z2[ch]
	f.z2[ch] = f.b2*x - f.a2*y
	return y
}

// Equalizer is a 10-band peaking equalizer with automatic pre-gain.
// It is not safe for concurrent use; callers synchronise via the speaker lock.
type Equalizer struct {
	gains   [10]float64
	filters [10]biquad
	preamp  float64
	active  bool
	rate    float64
}

func NewEqualizer(rate float64) *Equalizer {
	e := &Equalizer{rate: rate, preamp: 1}
	e.SetGains(EQPresets["Flat"])
	return e
}

func (e *Equalizer) Gains() [10]float64 { return e.gains }

func (e *Equalizer) SetGain(band int, db float64) {
	if band < 0 || band >= len(e.gains) {
		return
	}
	g := e.gains
	g[band] = db
	e.SetGains(g)
}

func (e *Equalizer) SetGains(gains [10]float64) {
	maxBoost := 0.0
	e.active = false
	for i, g := range gains {
		g = math.Max(-EQMaxGain, math.Min(EQMaxGain, g))
		e.gains[i] = g
		e.filters[i].setPeaking(EQBands[i], g, eqQ, e.rate)
		if g != 0 {
			e.active = true
		}
		maxBoost = math.Max(maxBoost, g)
	}
	// Overlapping boosted bands sum up, so pull the level down to leave headroom.
	e.preamp = math.Pow(10, -maxBoost*0.6/20)
}

func (e *Equalizer) Process(samples [][2]float64) {
	if !e.active {
		return
	}
	for i := range samples {
		for ch := 0; ch < 2; ch++ {
			x := samples[i][ch] * e.preamp
			for b := range e.filters {
				if e.gains[b] != 0 {
					x = e.filters[b].process(x, ch)
				}
			}
			samples[i][ch] = x
		}
	}
}
