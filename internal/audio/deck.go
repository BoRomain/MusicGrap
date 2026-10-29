package audio

import (
	"github.com/gopxl/beep/v2"
)

const resampleQuality = 4

// Deck is one playing source: a decoder followed by a resampler that converts the
// file's sample rate to the output rate and applies the "slowed" speed ratio.
type Deck struct {
	ID       string
	QueuePos int

	src    beep.StreamSeekCloser
	rate   float64
	res    *beep.Resampler
	pos    float64 // source samples actually consumed; the resampler reads ahead of this
	fadeIn bool
}

func NewDeck(path, id string, queuePos int) (*Deck, error) {
	src, format, err := Open(path)
	if err != nil {
		return nil, err
	}
	return newDeck(src, float64(format.SampleRate), id, queuePos), nil
}

func newDeck(src beep.StreamSeekCloser, rate float64, id string, queuePos int) *Deck {
	d := &Deck{ID: id, QueuePos: queuePos, src: src, rate: rate}
	d.res = beep.ResampleRatio(resampleQuality, d.ratio(1), src)
	return d
}

func (d *Deck) ratio(speed float64) float64 {
	return d.rate / float64(SampleRate) * speed
}

func (d *Deck) setSpeed(speed float64) {
	d.res.SetRatio(d.ratio(speed))
}

// stream fills buf as far as the source allows and returns the number of samples written.
func (d *Deck) stream(buf [][2]float64) int {
	n := 0
	for n < len(buf) {
		m, ok := d.res.Stream(buf[n:])
		n += m
		d.pos += float64(m) * d.res.Ratio()
		if !ok || m == 0 {
			break
		}
	}
	return n
}

// remaining estimates the number of output samples left before the deck ends.
func (d *Deck) remaining() int {
	left := float64(d.src.Len()) - d.pos
	return int(left / d.res.Ratio())
}

// Position returns the playback position in seconds of the source.
func (d *Deck) Position() float64 { return min(d.pos, float64(d.src.Len())) / d.rate }

// Duration returns the length of the source in seconds.
func (d *Deck) Duration() float64 { return float64(d.src.Len()) / d.rate }

func (d *Deck) seek(sec float64) error {
	p := int(sec * d.rate)
	p = max(0, min(p, d.src.Len()-1))
	if err := d.src.Seek(p); err != nil {
		return err
	}
	d.pos = float64(p)
	// Drop samples the resampler buffered from the old position.
	d.res = beep.ResampleRatio(resampleQuality, d.res.Ratio(), d.src)
	return nil
}

// close releases the source in the background: it is called from the audio
// callback, and releasing a platform decoder or killing ffmpeg can take tens of ms.
func (d *Deck) close() {
	if d != nil {
		go d.src.Close()
	}
}
