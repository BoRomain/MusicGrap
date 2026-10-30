// Package core is the platform-independent backend shared by the desktop (Wails)
// and Android builds: library, playlists, settings and the audio player.
package core

import (
	"errors"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"musicplayer/internal/audio"
	"musicplayer/internal/library"
	"musicplayer/internal/palette"
	"musicplayer/internal/playlist"
	"musicplayer/internal/settings"
)

var errNoAudio = errors.New("aucune sortie audio disponible")

// NowPlaying describes the audible track and the theme derived from its cover.
type NowPlaying struct {
	Track    library.Track   `json:"track"`
	Palette  palette.Palette `json:"palette"`
	HasCover bool            `json:"hasCover"`
}

// InitState is everything the UI needs on load.
type InitState struct {
	Settings   settings.Settings      `json:"settings"`
	Tracks     []library.Track        `json:"tracks"`
	Playlists  []playlist.Playlist    `json:"playlists"`
	Presets    map[string][10]float64 `json:"presets"`
	Bands      [10]float64            `json:"bands"`
	AudioError string                 `json:"audioError"`
	Now        *NowPlaying            `json:"now"`
	State      audio.State            `json:"state"`
}

type ScanProgress struct {
	Done  int `json:"done"`
	Total int `json:"total"`
}

// Emitter sends an event with a JSON-serialisable payload to the UI.
type Emitter func(event string, data any)

// Core owns the backend state. Its exported methods form the API called by the UI.
type Core struct {
	emit      Emitter
	lib       *library.Library
	playlists *playlist.Store
	player    *audio.Player
	audioErr  string

	mu        sync.Mutex
	settings  settings.Settings
	scanning  bool
	now       *NowPlaying
	saveTimer *time.Timer

	themes sync.Map // track id -> NowPlaying (palette cache)
}

// New loads the library, playlists and settings. Call Start to open the audio device.
func New(emit Emitter) *Core {
	return &Core{
		emit:      emit,
		lib:       library.New(filepath.Join(settings.Dir(), "library.json")),
		playlists: playlist.New(filepath.Join(settings.Dir(), "playlists.json")),
		settings:  settings.Load(),
	}
}

// Start opens the audio device and applies the saved settings to the player.
func (a *Core) Start() {
	p, err := audio.NewPlayer(a.lib.Path, audio.Callbacks{
		TrackChanged: a.onTrackChanged,
		Progress:     func(s audio.State) { a.emit("playback:progress", s) },
		Ended:        func() { a.emit("playback:ended", nil) },
	})
	if err != nil {
		log.Printf("audio: %v", err)
		a.audioErr = err.Error()
		return
	}
	a.player = p

	s := a.settings
	p.SetVolume(s.Volume)
	p.SetEQGains(s.EQ)
	p.SetSpeed(s.Speed)
	p.SetReverb(s.ReverbWet, s.ReverbRoom)
	p.SetCrossfade(s.Crossfade)
	p.SetCrossfadeOnSkip(s.CrossfadeOnSkip)
	p.SetShuffle(s.Shuffle)
	p.SetRepeat(s.Repeat)
}

// Render gives the next audio frames to a platform output (see audio.PullOutput).
// It returns 0 when nothing is audible or the audio failed to start.
func (a *Core) Render(buf []byte) int {
	if a.player == nil {
		return 0
	}
	return a.player.Render(buf)
}

// Shutdown saves the settings.
func (a *Core) Shutdown() { a.saveSettings() }

func (a *Core) saveSettings() {
	a.mu.Lock()
	s := a.settings
	a.mu.Unlock()
	if err := settings.Save(s); err != nil {
		log.Printf("save settings: %v", err)
	}
}

func (a *Core) onTrackChanged(id string) {
	np := a.nowPlaying(id)
	a.mu.Lock()
	a.now = np
	a.mu.Unlock()
	a.emit("track:changed", np)
}

func (a *Core) nowPlaying(id string) *NowPlaying {
	if v, ok := a.themes.Load(id); ok {
		np := v.(NowPlaying)
		return &np
	}
	t, _ := a.lib.Get(id)
	np := NowPlaying{Track: t, Palette: palette.Default}
	if data, _, err := a.lib.Cover(id); err == nil {
		if p, err := palette.FromImage(data); err == nil {
			np.Palette, np.HasCover = p, true
		}
	}
	a.themes.Store(id, np)
	return &np
}

// CoverHandler serves /cover/{trackID} to the webview.
func (a *Core) CoverHandler(w http.ResponseWriter, r *http.Request) {
	id, ok := strings.CutPrefix(r.URL.Path, "/cover/")
	if !ok {
		http.NotFound(w, r)
		return
	}
	data, mime, err := a.lib.Cover(id)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "max-age=86400")
	w.Write(data)
}

// update changes the settings and saves them shortly after the last change,
// so they survive a crash or a killed process.
func (a *Core) update(fn func(s *settings.Settings)) {
	a.mu.Lock()
	defer a.mu.Unlock()
	fn(&a.settings)
	if a.saveTimer != nil {
		a.saveTimer.Stop()
	}
	a.saveTimer = time.AfterFunc(time.Second, a.saveSettings)
}

func (a *Core) withPlayer(fn func(p *audio.Player) error) error {
	if a.player == nil {
		return errNoAudio
	}
	return fn(a.player)
}

// ---- API ----

func (a *Core) GetInitialState() InitState {
	a.mu.Lock()
	st := InitState{
		Settings:   a.settings,
		Tracks:     a.lib.Tracks(),
		Playlists:  a.playlists.List(),
		Presets:    audio.EQPresets,
		Bands:      audio.EQBands,
		AudioError: a.audioErr,
		Now:        a.now,
	}
	a.mu.Unlock()
	if a.player != nil {
		st.State = a.player.State()
	}
	return st
}

// SetMusicFolder changes the music folder and rescans the library from it.
func (a *Core) SetMusicFolder(dir string) {
	a.update(func(s *settings.Settings) { s.MusicDir = dir })
	a.ScanLibrary()
}

// ScanLibrary rescans the music folder in the background.
// Emits library:scan-progress then library:updated.
func (a *Core) ScanLibrary() {
	a.mu.Lock()
	dir := a.settings.MusicDir
	if a.scanning || dir == "" {
		a.mu.Unlock()
		return
	}
	a.scanning = true
	a.mu.Unlock()

	go func() {
		defer func() {
			a.mu.Lock()
			a.scanning = false
			a.mu.Unlock()
		}()
		err := a.lib.Scan(dir, func(done, total int) {
			a.emit("library:scan-progress", ScanProgress{done, total})
		})
		if err != nil {
			log.Printf("scan: %v", err)
		}
		a.emit("library:updated", a.lib.Tracks())
	}()
}

func (a *Core) GetTracks() []library.Track { return a.lib.Tracks() }

// GetQueue returns the tracks still to play, current one first.
func (a *Core) GetQueue() []library.Track {
	if a.player == nil {
		return nil
	}
	var out []library.Track
	for _, id := range a.player.Upcoming() {
		if t, ok := a.lib.Get(id); ok {
			out = append(out, t)
		}
	}
	return out
}

func (a *Core) PlayQueue(ids []string, start int) error {
	return a.withPlayer(func(p *audio.Player) error { return p.PlayQueue(ids, start) })
}

func (a *Core) TogglePause() {
	a.withPlayer(func(p *audio.Player) error { p.TogglePause(); return nil })
}

// SetPaused pauses or resumes explicitly (media buttons, audio focus loss).
func (a *Core) SetPaused(paused bool) {
	a.withPlayer(func(p *audio.Player) error { p.SetPaused(paused); return nil })
}

func (a *Core) Next() error { return a.withPlayer((*audio.Player).Next) }
func (a *Core) Prev() error { return a.withPlayer((*audio.Player).Prev) }

func (a *Core) Seek(sec float64) error {
	return a.withPlayer(func(p *audio.Player) error {
		if err := p.Seek(sec); err != nil {
			return err
		}
		// Send the new position now rather than at the next tick, so the seek bar doesn't jump back.
		a.emit("playback:progress", p.State())
		return nil
	})
}

func (a *Core) SetVolume(v float64) {
	a.update(func(s *settings.Settings) { s.Volume = v })
	a.withPlayer(func(p *audio.Player) error { p.SetVolume(v); return nil })
}

func (a *Core) SetEQBand(band int, db float64) {
	var gains [10]float64
	a.update(func(s *settings.Settings) {
		if band >= 0 && band < len(s.EQ) {
			s.EQ[band] = db
		}
		s.EQPreset = "Custom"
		gains = s.EQ
	})
	a.withPlayer(func(p *audio.Player) error { p.SetEQGains(gains); return nil })
}

// SetEQPreset applies a named preset and returns its gains.
func (a *Core) SetEQPreset(name string) [10]float64 {
	gains, ok := audio.EQPresets[name]
	if !ok {
		a.mu.Lock()
		defer a.mu.Unlock()
		return a.settings.EQ
	}
	a.update(func(s *settings.Settings) { s.EQ, s.EQPreset = gains, name })
	a.withPlayer(func(p *audio.Player) error { p.SetEQGains(gains); return nil })
	return gains
}

func (a *Core) SetSpeed(speed float64) {
	a.update(func(s *settings.Settings) { s.Speed = speed })
	a.withPlayer(func(p *audio.Player) error { p.SetSpeed(speed); return nil })
}

func (a *Core) SetReverb(wet, room float64) {
	a.update(func(s *settings.Settings) { s.ReverbWet, s.ReverbRoom = wet, room })
	a.withPlayer(func(p *audio.Player) error { p.SetReverb(wet, room); return nil })
}

func (a *Core) SetCrossfade(sec float64) {
	a.update(func(s *settings.Settings) { s.Crossfade = sec })
	a.withPlayer(func(p *audio.Player) error { p.SetCrossfade(sec); return nil })
}

func (a *Core) SetCrossfadeOnSkip(on bool) {
	a.update(func(s *settings.Settings) { s.CrossfadeOnSkip = on })
	a.withPlayer(func(p *audio.Player) error { p.SetCrossfadeOnSkip(on); return nil })
}

func (a *Core) SetShuffle(on bool) {
	a.update(func(s *settings.Settings) { s.Shuffle = on })
	a.withPlayer(func(p *audio.Player) error { p.SetShuffle(on); return nil })
}

func (a *Core) SetRepeat(mode string) {
	a.update(func(s *settings.Settings) { s.Repeat = mode })
	a.withPlayer(func(p *audio.Player) error { p.SetRepeat(mode); return nil })
}

// ---- Playlists ----
// Every change emits playlists:updated with the full list.

func (a *Core) playlistsChanged(err error) error {
	if err == nil {
		a.emit("playlists:updated", a.playlists.List())
	}
	return err
}

func (a *Core) CreatePlaylist(name string) (playlist.Playlist, error) {
	p, err := a.playlists.Create(name)
	return p, a.playlistsChanged(err)
}

func (a *Core) RenamePlaylist(id, name string) error {
	return a.playlistsChanged(a.playlists.Rename(id, name))
}

func (a *Core) DeletePlaylist(id string) error {
	return a.playlistsChanged(a.playlists.Delete(id))
}

func (a *Core) AddToPlaylist(id string, trackIDs []string) error {
	return a.playlistsChanged(a.playlists.Add(id, trackIDs...))
}

func (a *Core) RemoveFromPlaylist(id string, index int) error {
	return a.playlistsChanged(a.playlists.RemoveAt(id, index))
}
