package queue

import (
	"slices"
	"testing"
)

func TestRepeatModes(t *testing.T) {
	q := New()
	q.Set([]string{"a", "b", "c"}, 2)

	if pos, _, _ := q.PeekNext(); pos != -1 {
		t.Fatal("repeat off: nothing after the last track")
	}
	q.SetRepeat(RepeatAll)
	if _, id, fade := q.PeekNext(); id != "a" || !fade {
		t.Fatalf("repeat all should wrap to a with fade, got %q %v", id, fade)
	}
	q.SetRepeat(RepeatOne)
	if _, id, fade := q.PeekNext(); id != "c" || fade {
		t.Fatalf("repeat one should loop c without fade, got %q %v", id, fade)
	}
	if _, id := q.Next(); id != "a" {
		t.Fatalf("manual next ignores repeat one, got %q", id)
	}
}

func TestShuffleKeepsCurrentAndAllTracks(t *testing.T) {
	q := New()
	ids := []string{"a", "b", "c", "d", "e", "f"}
	q.Set(ids, 3)
	q.SetShuffle(true)
	up := q.Upcoming()
	if up[0] != "d" || len(up) != len(ids) {
		t.Fatalf("upcoming = %v", up)
	}
	sorted := slices.Clone(up)
	slices.Sort(sorted)
	if !slices.Equal(sorted, ids) {
		t.Fatalf("shuffle lost tracks: %v", up)
	}
	q.SetShuffle(false)
	if _, id := q.Current(); id != "d" {
		t.Fatalf("unshuffle moved current track to %q", id)
	}
	if _, id := q.Next(); id != "e" {
		t.Fatalf("unshuffled next = %q", id)
	}
}
