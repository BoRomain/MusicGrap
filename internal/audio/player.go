package audio

import (
	"encoding/binary"
	"log"
	"math"
	"sync"
	"time"

	"github.com/gopxl/beep/v2/speaker"

	"musicplayer/internal/queue"
)

const (
	skipFade      = 0.3 // seconds, short fade on manual track changes
	prevThreshold = 3.0 // seconds; "previous" restarts the track past this point
)

// State is a snapshot of playback for the UI.
type State struct {
	TrackID   string  `json:"trackId"`
	Position  float64 `json:"position"`
	Duration  float64 `json:"duration"`
	Paused    bool    `json:"paused"`
	Speed     float64 `json:"speed"`
	Shuffle   bool    `json:"shuffle"`
	Repeat    string  `json:"repeat"`
	HasTrack  bool    `json:"hasTrack"`
	QueueSize int     `json:"queueSize"`
}

// Callbacks notify the owner about playback changes. They run on the player goroutine.
type Callbacks struct {
	TrackChanged func(id string)
	Progress     func(State)
	Ended        func()
}

// Player drives the Engine through the speaker and keeps it in sync with the queue.
type Player struct {
	eng    *Engine
	lookup func(id string) (path string, ok bool)
	cb     Callbacks

	mu              sync.Mutex // guards the fields below
	queue           *queue.Queue
	crossfadeSec    float64
	crossfadeOnSkip bool

	preloadMu sync.Mutex

	pull      bool       // PullOutput at creation
	outMu     sync.Mutex // stands for the speaker lock in pull mode
	renderBuf [][2]float64
}

// OutputBuffer is the audio output buffer. Larger means fewer dropouts under
// load but slower reaction to pause and seek. Set it before NewPlayer.
var OutputBuffer = 100 * time.Millisecond

// PullOutput leaves the audio device to the platform, which pulls the samples
// with Player.Render (Android AudioTrack). Set it before NewPlayer.
var PullOutput = false

// NewPlayer opens the audio device and starts the playback goroutine.
func NewPlayer(lookup func(id string) (string, bool), cb Callbacks) (*Player, error) {
	p := &Player{eng: NewEngine(), lookup: lookup, cb: cb, queue: queue.New(), pull: PullOutput}
	if !p.pull {
		if err := speaker.Init(SampleRate, SampleRate.N(OutputBuffer)); err != nil {
			return nil, err
		}
		speaker.Play(p.eng)
	}
	go p.loop()
	return p, nil
}

// RenderFrameBytes is the size of one frame given by Render: stereo float32.
const RenderFrameBytes = 8

// Render fills buf with the next frames as interleaved stereo float32
// little-endian samples and returns the number of bytes written. It returns 0
// when nothing is audible (no track, or paused once the fade-out is done), so
// the platform can stop its output. Pull mode only.
func (p *Player) Render(buf []byte) int {
	frames := len(buf) / RenderFrameBytes
	p.outMu.Lock()
	defer p.outMu.Unlock()
	if p.eng.idle() {
		return 0
	}
	if cap(p.renderBuf) < frames {
		p.renderBuf = make([][2]float64, frames)
	}
	s := p.renderBuf[:frames]
	p.eng.Stream(s)
	for i, f := range s {
		binary.LittleEndian.PutUint32(buf[i*8:], math.Float32bits(float32(f[0])))
		binary.LittleEndian.PutUint32(buf[i*8+4:], math.Float32bits(float32(f[1])))
	}
	return frames * RenderFrameBytes
}

func (p *Player) loop() {
	tick := time.NewTicker(250 * time.Millisecond)
	defer tick.Stop()
	report := time.NewTicker(30 * time.Second)
	defer report.Stop()
	for {
		select {
		case ev := <-p.eng.Events:
			switch ev.Kind {
			case EventTrackStarted:
				p.mu.Lock()
				p.queue.SetPos(ev.Deck.QueuePos)
				p.mu.Unlock()
				if p.cb.TrackChanged != nil {
					p.cb.TrackChanged(ev.Deck.ID)
				}
			case EventNeedNext:
				p.preload()
			case EventEnded:
				if p.cb.Ended != nil {
					p.cb.Ended()
				}
			}
		case <-tick.C:
			if p.cb.Progress != nil {
				p.cb.Progress(p.State())
			}
		case <-report.C:
			p.logStats()
		}
	}
}

// logStats reports processing trouble from the last period, if any.
func (p *Player) logStats() {
	var s streamStats
	p.locked(func(e *Engine) { s, e.stats = e.stats, streamStats{} })
	starved := externalStarved.Swap(0)
	if s.slow > 0 || starved > 0 {
		log.Printf("audio: %d slow blocks (worst %v for %v of audio), external decoder late %d times",
			s.slow, s.worst.Round(time.Millisecond), s.budget.Round(time.Millisecond), starved)
	}
}

// locked runs fn with the audio callback paused.
func (p *Player) locked(fn func(e *Engine)) {
	if p.pull {
		p.outMu.Lock()
		defer p.outMu.Unlock()
	} else {
		speaker.Lock()
		defer speaker.Unlock()
	}
	fn(p.eng)
}

// preload opens the track that follows in the queue and hands it to the engine.
func (p *Player) preload() {
	p.preloadMu.Lock()
	defer p.preloadMu.Unlock()

	p.mu.Lock()
	pos, id, fadeIn := p.queue.PeekNext()
	p.mu.Unlock()
	if pos < 0 {
		p.locked(func(e *Engine) { e.ClearNext() })
		return
	}
	d, err := p.openDeck(id, pos)
	if err != nil {
		log.Printf("preload %s: %v", id, err)
		return
	}
	p.locked(func(e *Engine) { e.SetNext(d, fadeIn) })
}

func (p *Player) openDeck(id string, pos int) (*Deck, error) {
	path, ok := p.lookup(id)
	if !ok {
		return nil, errNotFound(id)
	}
	return NewDeck(path, id, pos)
}

type errNotFound string

func (e errNotFound) Error() string { return "track not found: " + string(e) }

// start plays the queue's current track, fading from whatever is playing.
func (p *Player) start(pos int, id string, resume bool) error {
	if pos < 0 {
		return nil
	}
	d, err := p.openDeck(id, pos)
	if err != nil {
		return err
	}
	p.mu.Lock()
	fade := skipFade
	if p.crossfadeOnSkip && p.crossfadeSec > 0 {
		fade = p.crossfadeSec
	}
	p.mu.Unlock()
	p.locked(func(e *Engine) {
		if resume {
			e.SetPaused(false)
		}
		e.Skip(d, int(fade*float64(SampleRate)))
	})
	return nil
}

// PlayQueue replaces the queue with ids and starts playing ids[start].
func (p *Player) PlayQueue(ids []string, start int) error {
	p.mu.Lock()
	p.queue.Set(ids, start)
	pos, id := p.queue.Current()
	p.mu.Unlock()
	return p.start(pos, id, true)
}

func (p *Player) TogglePause() {
	var empty bool
	p.locked(func(e *Engine) {
		empty = e.Current() == nil
		if !empty {
			e.SetPaused(!e.Paused())
		}
	})
	if empty {
		// Nothing loaded (e.g. queue finished): restart the current queue entry.
		p.mu.Lock()
		pos, id := p.queue.Current()
		p.mu.Unlock()
		if err := p.start(pos, id, true); err != nil {
			log.Print(err)
		}
	}
}

// SetPaused pauses or resumes; resuming with nothing loaded restarts the current queue entry.
func (p *Player) SetPaused(paused bool) {
	var current bool
	p.locked(func(e *Engine) { current = e.Current() == nil || e.Paused() })
	if current != paused {
		p.TogglePause()
	}
}

func (p *Player) Next() error {
	p.mu.Lock()
	pos, id := p.queue.Next()
	p.mu.Unlock()
	return p.start(pos, id, false)
}

func (p *Player) Prev() error {
	var position float64
	p.locked(func(e *Engine) {
		if d := e.Current(); d != nil {
			position = d.Position()
		}
	})
	if position > prevThreshold {
		return p.Seek(0)
	}
	p.mu.Lock()
	pos, id := p.queue.Prev()
	p.mu.Unlock()
	return p.start(pos, id, false)
}

func (p *Player) Seek(sec float64) error {
	var err error
	p.locked(func(e *Engine) { err = e.Seek(sec) })
	return err
}

func (p *Player) SetVolume(v float64) {
	// Squared curve: closer to how loudness is perceived than a linear slider.
	p.locked(func(e *Engine) { e.SetVolume(v * v) })
}

func (p *Player) SetSpeed(s float64) { p.locked(func(e *Engine) { e.SetSpeed(s) }) }

func (p *Player) SetEQGains(g [10]float64) { p.locked(func(e *Engine) { e.EQ.SetGains(g) }) }

func (p *Player) SetEQBand(band int, db float64) {
	p.locked(func(e *Engine) { e.EQ.SetGain(band, db) })
}

func (p *Player) EQGains() (g [10]float64) {
	p.locked(func(e *Engine) { g = e.EQ.Gains() })
	return g
}

func (p *Player) SetReverb(wet, room float64) {
	p.locked(func(e *Engine) { e.Reverb.SetParams(wet, room) })
}

func (p *Player) SetCrossfade(sec float64) {
	p.mu.Lock()
	p.crossfadeSec = sec
	p.mu.Unlock()
	p.locked(func(e *Engine) { e.SetCrossfade(sec) })
}

func (p *Player) SetCrossfadeOnSkip(on bool) {
	p.mu.Lock()
	p.crossfadeOnSkip = on
	p.mu.Unlock()
}

func (p *Player) SetShuffle(on bool) {
	p.mu.Lock()
	p.queue.SetShuffle(on)
	p.mu.Unlock()
	p.preload()
}

func (p *Player) SetRepeat(r string) {
	p.mu.Lock()
	p.queue.SetRepeat(queue.Repeat(r))
	p.mu.Unlock()
	p.preload()
}

// Upcoming returns the queued track ids starting from the current one.
func (p *Player) Upcoming() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.queue.Upcoming()
}

func (p *Player) State() State {
	var s State
	p.locked(func(e *Engine) {
		if d := e.Current(); d != nil {
			s.TrackID = d.ID
			s.Position = d.Position()
			s.Duration = d.Duration()
			s.HasTrack = true
		}
		s.Paused = e.Paused()
		s.Speed = e.Speed()
	})
	p.mu.Lock()
	s.Shuffle = p.queue.Shuffle()
	s.Repeat = string(p.queue.Repeat())
	s.QueueSize = len(p.queue.Upcoming())
	p.mu.Unlock()
	return s
}
