// Package playlist stores user playlists as JSON.
package playlist

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
)

var ErrNotFound = errors.New("playlist introuvable")

type Playlist struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	TrackIDs []string `json:"trackIds"`
	Created  int64    `json:"created"`
}

// Store is safe for concurrent use. Every change is saved to disk.
type Store struct {
	path string

	mu        sync.Mutex
	playlists []Playlist
}

// New loads the playlists saved at path, if any.
func New(path string) *Store {
	s := &Store{path: path}
	if b, err := os.ReadFile(path); err == nil {
		json.Unmarshal(b, &s.playlists)
	}
	return s
}

// List returns a copy of all playlists, in creation order.
func (s *Store) List() []Playlist {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.list()
}

func (s *Store) list() []Playlist {
	out := make([]Playlist, len(s.playlists))
	for i, p := range s.playlists {
		p.TrackIDs = slices.Clone(p.TrackIDs)
		if p.TrackIDs == nil {
			p.TrackIDs = []string{}
		}
		out[i] = p
	}
	return out
}

func (s *Store) Create(name string) (Playlist, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := Playlist{ID: newID(), Name: cleanName(name), TrackIDs: []string{}, Created: time.Now().Unix()}
	s.playlists = append(s.playlists, p)
	return p, s.save()
}

func (s *Store) Rename(id, name string) error {
	return s.edit(id, func(p *Playlist) { p.Name = cleanName(name) })
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := s.index(id)
	if i < 0 {
		return ErrNotFound
	}
	s.playlists = slices.Delete(s.playlists, i, i+1)
	return s.save()
}

// Add appends tracks at the end of the playlist.
func (s *Store) Add(id string, trackIDs ...string) error {
	return s.edit(id, func(p *Playlist) { p.TrackIDs = append(p.TrackIDs, trackIDs...) })
}

// RemoveAt removes the track at index, so one copy of a duplicated track can be removed.
func (s *Store) RemoveAt(id string, index int) error {
	return s.edit(id, func(p *Playlist) {
		if index >= 0 && index < len(p.TrackIDs) {
			p.TrackIDs = slices.Delete(p.TrackIDs, index, index+1)
		}
	})
}

func (s *Store) edit(id string, fn func(p *Playlist)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	i := s.index(id)
	if i < 0 {
		return ErrNotFound
	}
	fn(&s.playlists[i])
	return s.save()
}

func (s *Store) index(id string) int {
	return slices.IndexFunc(s.playlists, func(p Playlist) bool { return p.ID == id })
}

func (s *Store) save() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	b, err := json.Marshal(s.list())
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, b, 0o644)
}

func cleanName(name string) string {
	if name = strings.TrimSpace(name); name == "" {
		return "Nouvelle playlist"
	}
	return name
}

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
