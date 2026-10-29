package playlist

import (
	"path/filepath"
	"slices"
	"testing"
)

func TestEditAndReload(t *testing.T) {
	path := filepath.Join(t.TempDir(), "playlists.json")
	s := New(path)

	p, err := s.Create("  ")
	if err != nil {
		t.Fatal(err)
	}
	if p.Name != "Nouvelle playlist" {
		t.Fatalf("blank name should get a default, got %q", p.Name)
	}
	other, _ := s.Create("Sport")
	s.Rename(p.ID, "Chill")
	s.Add(p.ID, "a", "b", "a", "c")
	s.RemoveAt(p.ID, 2) // the second "a" only
	s.Delete(other.ID)

	got := New(path).List()
	if len(got) != 1 || got[0].Name != "Chill" {
		t.Fatalf("reloaded = %+v", got)
	}
	if want := []string{"a", "b", "c"}; !slices.Equal(got[0].TrackIDs, want) {
		t.Fatalf("tracks = %v, want %v", got[0].TrackIDs, want)
	}
}

func TestUnknownPlaylist(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "playlists.json"))
	if err := s.Add("nope", "a"); err != ErrNotFound {
		t.Fatalf("err = %v", err)
	}
	if err := s.Delete("nope"); err != ErrNotFound {
		t.Fatalf("err = %v", err)
	}
}

func TestListIsACopy(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "playlists.json"))
	p, _ := s.Create("x")
	s.Add(p.ID, "a")
	s.List()[0].TrackIDs[0] = "changed"
	if s.List()[0].TrackIDs[0] != "a" {
		t.Fatal("List must not expose internal slices")
	}
}
