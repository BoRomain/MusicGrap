package audio

import "math"

// fill writes the mix of the current (and, while transitioning, next) deck into out.
func (e *Engine) fill(out [][2]float64) {
	filled := 0
	for filled < len(out) {
		if e.cur == nil {
			clear(out[filled:])
			return
		}
		chunk := out[filled:]
		if e.fading {
			filled += e.mixFade(chunk)
			continue
		}
		if e.next != nil && e.next.fadeIn && e.crossfade > 0 {
			rem := e.cur.remaining()
			if rem <= e.crossfade {
				e.startFade(max(rem, 1), false)
				continue
			}
			// Stop exactly where the fade has to begin.
			if rem-e.crossfade < len(chunk) {
				chunk = chunk[:rem-e.crossfade]
			}
		}
		m := e.cur.stream(chunk)
		filled += m
		if m < len(chunk) {
			e.advance()
		}
	}
}

// advance handles the current deck running out without a fade: gapless switch.
func (e *Engine) advance() {
	e.cur.close()
	if e.next != nil {
		e.cur, e.next = e.next, nil
		e.emit(EventTrackStarted, e.cur)
		e.emit(EventNeedNext, nil)
		return
	}
	e.cur = nil
	e.emit(EventEnded, nil)
}

func (e *Engine) startFade(total int, announced bool) {
	e.fading = true
	e.fadePos = 0
	e.fadeTotal = total
	e.announced = announced
}

// mixFade mixes up to len(chunk) samples of the transition using equal-power
// curves, so the perceived loudness stays constant across the fade.
func (e *Engine) mixFade(chunk [][2]float64) int {
	k := min(len(chunk), e.fadeTotal-e.fadePos)
	if cap(e.bufA) < k {
		e.bufA = make([][2]float64, k)
	}
	a := e.bufA[:k]
	clear(a[e.cur.stream(a):])
	b := chunk[:k]
	clear(b[e.next.stream(b):])

	for i := range k {
		t := float64(e.fadePos+i) / float64(e.fadeTotal)
		gOut := math.Cos(t * math.Pi / 2)
		gIn := math.Sin(t * math.Pi / 2)
		b[i][0] = a[i][0]*gOut + b[i][0]*gIn
		b[i][1] = a[i][1]*gOut + b[i][1]*gIn
	}
	e.fadePos += k

	if !e.announced && e.fadePos*2 >= e.fadeTotal {
		e.announced = true
		e.emit(EventTrackStarted, e.next)
	}
	if e.fadePos >= e.fadeTotal {
		e.finishFade()
	}
	return k
}

func (e *Engine) finishFade() {
	e.cur.close()
	e.cur, e.next, e.fading = e.next, nil, false
	if !e.announced {
		e.emit(EventTrackStarted, e.cur)
	}
	e.emit(EventNeedNext, nil)
}
