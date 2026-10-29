package audio

import (
	"math"

	"github.com/gopxl/beep/v2"
)

// SampleRate is the fixed output rate of the engine.
const SampleRate beep.SampleRate = 44100

const pauseRamp = 0.02 // seconds of fade when pausing/resuming, avoids clicks

type EventKind int

const (
	// EventTrackStarted fires when a deck becomes the audible track
	// (immediately on a skip, at mid-fade on a crossfade).
	EventTrackStarted EventKind = iota
	// EventNeedNext asks the owner to preload the next deck.
	EventNeedNext
	// EventEnded fires when the last track finished and nothing follows.
	EventEnded
)

type Event struct {
	Kind EventKind
	Deck *Deck
}

// Engine mixes the current and next deck and runs the effect chain:
//
//	[cur | next] → crossfader → EQ → reverb → pause ramp/volume → soft clip
//
// It implements beep.Streamer and must only be mutated while the speaker is
// locked (or from the goroutine calling Stream, in tests).
type Engine struct {
	cur, next *Deck

	fading    bool
	fadePos   int
	fadeTotal int
	announced bool

	crossfade int // samples; 0 = gapless
	speed     float64
	volume    float64
	paused    bool
	gain      float64 // pause ramp gain

	EQ     *Equalizer
	Reverb *Reverb

	bufA   [][2]float64
	Events chan Event
}

func NewEngine() *Engine {
	return &Engine{
		speed:  1,
		volume: 1,
		gain:   1,
		EQ:     NewEqualizer(float64(SampleRate)),
		Reverb: NewReverb(),
		Events: make(chan Event, 64),
	}
}

func (e *Engine) emit(kind EventKind, d *Deck) {
	select {
	case e.Events <- Event{kind, d}:
	default:
	}
}

func (e *Engine) Stream(out [][2]float64) (int, bool) {
	if e.cur == nil || (e.paused && e.gain == 0) {
		clear(out)
		return len(out), true
	}
	e.fill(out)
	e.EQ.Process(out)
	e.Reverb.Process(out)

	target := 1.0
	if e.paused {
		target = 0
	}
	step := 1 / (pauseRamp * float64(SampleRate))
	for i := range out {
		if e.gain < target {
			e.gain = math.Min(target, e.gain+step)
		} else if e.gain > target {
			e.gain = math.Max(target, e.gain-step)
		}
		g := e.gain * e.volume
		out[i][0] = softClip(out[i][0] * g)
		out[i][1] = softClip(out[i][1] * g)
	}
	return len(out), true
}

func (e *Engine) Err() error { return nil }

// softClip is linear up to 0.8 and saturates smoothly towards 1 above it.
func softClip(x float64) float64 {
	a := math.Abs(x)
	if a <= 0.8 {
		return x
	}
	return math.Copysign(0.8+0.2*math.Tanh((a-0.8)/0.2), x)
}

// SetNext queues d to follow the current deck. fadeIn selects a crossfade
// (if enabled) over a gapless switch. Returns false (and closes d) if a
// transition is already in progress.
func (e *Engine) SetNext(d *Deck, fadeIn bool) bool {
	if e.fading || e.cur == nil {
		d.close()
		return false
	}
	e.next.close()
	d.fadeIn = fadeIn
	d.setSpeed(e.speed)
	e.next = d
	return true
}

func (e *Engine) ClearNext() {
	if !e.fading {
		e.next.close()
		e.next = nil
	}
}

// Skip switches to d right away, fading over fadeSamples (0 = hard cut).
func (e *Engine) Skip(d *Deck, fadeSamples int) {
	if e.fading {
		e.cur.close()
		e.cur, e.next, e.fading = e.next, nil, false
	}
	e.next.close()
	e.next = nil
	d.setSpeed(e.speed)
	if e.cur == nil || e.paused || fadeSamples <= 0 {
		e.cur.close()
		e.cur = d
		e.emit(EventTrackStarted, d)
		e.emit(EventNeedNext, nil)
		return
	}
	e.next = d
	e.startFade(fadeSamples, true)
	e.emit(EventTrackStarted, d)
}

// Stop closes every deck.
func (e *Engine) Stop() {
	e.cur.close()
	e.next.close()
	e.cur, e.next, e.fading = nil, nil, false
}

// Seek jumps within the audible track, completing any running transition first.
func (e *Engine) Seek(sec float64) error {
	if e.fading {
		e.finishFade()
	}
	if e.cur == nil {
		return nil
	}
	return e.cur.seek(sec)
}

// Current returns the deck the listener perceives as playing.
func (e *Engine) Current() *Deck {
	if e.fading && e.announced {
		return e.next
	}
	return e.cur
}

func (e *Engine) Paused() bool        { return e.paused }
func (e *Engine) SetPaused(p bool)    { e.paused = p }
func (e *Engine) SetVolume(v float64) { e.volume = math.Max(0, v) }
func (e *Engine) Speed() float64      { return e.speed }

// SetSpeed sets the playback rate; pitch follows like a slowed-down record.
func (e *Engine) SetSpeed(s float64) {
	s = math.Max(0.5, math.Min(1.5, s))
	e.speed = s
	for _, d := range []*Deck{e.cur, e.next} {
		if d != nil {
			d.setSpeed(s)
		}
	}
}

// SetCrossfade sets the automatic transition length in seconds (0 = gapless).
// The length is in real output time, so it is unaffected by the speed.
func (e *Engine) SetCrossfade(sec float64) {
	e.crossfade = int(math.Max(0, sec) * float64(SampleRate))
}
