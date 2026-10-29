package audio

// Freeverb (Jezar at Dreampoint, public domain), tuned for 44.1 kHz.

var (
	combTuning    = [8]int{1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617}
	allpassTuning = [4]int{556, 441, 341, 225}
)

const (
	stereoSpread = 23
	fixedGain    = 0.015
	scaleRoom    = 0.28
	offsetRoom   = 0.7
	scaleDamp    = 0.4
	scaleWet     = 2.0
	damping      = 0.5
)

type comb struct {
	buf         []float64
	idx         int
	filterStore float64
}

func (c *comb) process(in, feedback, damp1, damp2 float64) float64 {
	out := c.buf[c.idx]
	c.filterStore = out*damp2 + c.filterStore*damp1
	c.buf[c.idx] = in + c.filterStore*feedback
	if c.idx++; c.idx >= len(c.buf) {
		c.idx = 0
	}
	return out
}

type allpass struct {
	buf []float64
	idx int
}

func (a *allpass) process(in float64) float64 {
	bufOut := a.buf[a.idx]
	a.buf[a.idx] = in + bufOut*0.5
	if a.idx++; a.idx >= len(a.buf) {
		a.idx = 0
	}
	return bufOut - in
}

// Reverb is a stereo Freeverb. Not safe for concurrent use.
type Reverb struct {
	combs     [2][8]comb
	allpasses [2][4]allpass
	wet, room float64
}

func NewReverb() *Reverb {
	r := &Reverb{room: 0.6}
	for ch := 0; ch < 2; ch++ {
		spread := ch * stereoSpread
		for i, n := range combTuning {
			r.combs[ch][i].buf = make([]float64, n+spread)
		}
		for i, n := range allpassTuning {
			r.allpasses[ch][i].buf = make([]float64, n+spread)
		}
	}
	return r
}

func (r *Reverb) Wet() float64  { return r.wet }
func (r *Reverb) Room() float64 { return r.room }

// SetParams sets the wet amount and room size, both in [0, 1].
func (r *Reverb) SetParams(wet, room float64) {
	r.wet = clamp01(wet)
	r.room = clamp01(room)
}

func (r *Reverb) Process(samples [][2]float64) {
	if r.wet == 0 {
		return
	}
	feedback := r.room*scaleRoom + offsetRoom
	damp1 := damping * scaleDamp
	damp2 := 1 - damp1
	wet := r.wet * scaleWet
	dry := 1 - r.wet*0.4
	for i := range samples {
		in := (samples[i][0] + samples[i][1]) * fixedGain
		var out [2]float64
		for ch := 0; ch < 2; ch++ {
			for c := range r.combs[ch] {
				out[ch] += r.combs[ch][c].process(in, feedback, damp1, damp2)
			}
			for a := range r.allpasses[ch] {
				out[ch] = r.allpasses[ch][a].process(out[ch])
			}
		}
		samples[i][0] = samples[i][0]*dry + out[0]*wet
		samples[i][1] = samples[i][1]*dry + out[1]*wet
	}
}

func clamp01(x float64) float64 {
	if x < 0 {
		return 0
	}
	if x > 1 {
		return 1
	}
	return x
}
