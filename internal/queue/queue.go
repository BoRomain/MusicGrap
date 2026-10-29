// Package queue holds the play order with shuffle and repeat modes.
package queue

import (
	"math/rand/v2"
	"slices"
)

type Repeat string

const (
	RepeatOff Repeat = "off"
	RepeatAll Repeat = "all"
	RepeatOne Repeat = "one"
)

// Queue is not safe for concurrent use.
type Queue struct {
	ids     []string
	order   []int // play order, as indexes into ids
	pos     int   // index into order, -1 when empty
	shuffle bool
	repeat  Repeat
}

func New() *Queue { return &Queue{pos: -1, repeat: RepeatOff} }

// Set replaces the queue, starting at ids[start].
func (q *Queue) Set(ids []string, start int) {
	q.ids = slices.Clone(ids)
	if len(ids) == 0 {
		q.order, q.pos = nil, -1
		return
	}
	start = max(0, min(start, len(ids)-1))
	q.rebuild(start)
}

// rebuild recomputes the order so that ids[cur] is at the current position.
func (q *Queue) rebuild(cur int) {
	q.order = make([]int, len(q.ids))
	for i := range q.order {
		q.order[i] = i
	}
	if !q.shuffle {
		q.pos = cur
		return
	}
	rest := slices.Delete(slices.Clone(q.order), cur, cur+1)
	rand.Shuffle(len(rest), func(i, j int) { rest[i], rest[j] = rest[j], rest[i] })
	q.order = append([]int{cur}, rest...)
	q.pos = 0
}

func (q *Queue) at(pos int) string { return q.ids[q.order[pos]] }

// Current returns the current position and track id, or (-1, "").
func (q *Queue) Current() (int, string) {
	if q.pos < 0 {
		return -1, ""
	}
	return q.pos, q.at(q.pos)
}

// PeekNext returns what plays automatically after the current track, without moving.
// fadeIn is false when the transition must not crossfade (repeat one).
func (q *Queue) PeekNext() (pos int, id string, fadeIn bool) {
	switch {
	case q.pos < 0:
		return -1, "", false
	case q.repeat == RepeatOne:
		return q.pos, q.at(q.pos), false
	case q.pos+1 < len(q.order):
		return q.pos + 1, q.at(q.pos + 1), true
	case q.repeat == RepeatAll:
		return 0, q.at(0), true
	}
	return -1, "", false
}

// Next moves to the following track on user request (repeat one is ignored).
func (q *Queue) Next() (int, string) {
	switch {
	case q.pos < 0:
		return -1, ""
	case q.pos+1 < len(q.order):
		q.pos++
	case q.repeat != RepeatOff:
		q.pos = 0
	default:
		return -1, ""
	}
	return q.Current()
}

// Prev moves to the previous track.
func (q *Queue) Prev() (int, string) {
	switch {
	case q.pos < 0:
		return -1, ""
	case q.pos > 0:
		q.pos--
	case q.repeat != RepeatOff:
		q.pos = len(q.order) - 1
	}
	return q.Current()
}

// SetPos moves to an absolute position (as returned by PeekNext).
func (q *Queue) SetPos(pos int) {
	if pos >= 0 && pos < len(q.order) {
		q.pos = pos
	}
}

func (q *Queue) Shuffle() bool  { return q.shuffle }
func (q *Queue) Repeat() Repeat { return q.repeat }

func (q *Queue) SetRepeat(r Repeat) {
	if r == RepeatOff || r == RepeatAll || r == RepeatOne {
		q.repeat = r
	}
}

// SetShuffle toggles shuffle, keeping the current track playing.
func (q *Queue) SetShuffle(on bool) {
	q.shuffle = on
	if q.pos >= 0 {
		q.rebuild(q.order[q.pos])
	}
}

// Upcoming returns the queue in play order, starting from the current track.
func (q *Queue) Upcoming() []string {
	if q.pos < 0 {
		return nil
	}
	out := make([]string, 0, len(q.order)-q.pos)
	for _, i := range q.order[q.pos:] {
		out = append(out, q.ids[i])
	}
	return out
}
