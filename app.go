package main

import (
	"context"
	"net/http"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"musicplayer/internal/audio"
	"musicplayer/internal/core"
	"musicplayer/internal/library"
	"musicplayer/internal/playlist"
)

// App is bound to the frontend: its exported methods are callable from JS.
// It forwards to core.Core, which is shared with the Android build.
type App struct {
	ctx  context.Context
	core *core.Core
}

func NewApp() *App {
	a := &App{}
	// AAC/ALAC (.m4a) and Opus go through ffmpeg when it is installed.
	if dec, ok := audio.NewFFmpegDecoder(); ok {
		audio.SetExternalDecoder(dec)
	}
	// Nothing is emitted before startup: the player only exists from then on.
	a.core = core.New(func(event string, data any) {
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, event, data)
		}
	})
	return a
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.core.Start()
}

func (a *App) shutdown(ctx context.Context) { a.core.Shutdown() }

func (a *App) coverHandler(w http.ResponseWriter, r *http.Request) { a.core.CoverHandler(w, r) }

// ---- Bound methods ----

func (a *App) GetInitialState() core.InitState { return a.core.GetInitialState() }

// ChooseMusicFolder opens a folder picker and rescans the library from it.
func (a *App) ChooseMusicFolder() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Choisir le dossier musique"})
	if err != nil || dir == "" {
		return "", err
	}
	a.core.SetMusicFolder(dir)
	return dir, nil
}

func (a *App) ScanLibrary()                            { a.core.ScanLibrary() }
func (a *App) GetTracks() []library.Track              { return a.core.GetTracks() }
func (a *App) GetQueue() []library.Track               { return a.core.GetQueue() }
func (a *App) PlayQueue(ids []string, start int) error { return a.core.PlayQueue(ids, start) }
func (a *App) TogglePause()                            { a.core.TogglePause() }
func (a *App) Next() error                             { return a.core.Next() }
func (a *App) Prev() error                             { return a.core.Prev() }
func (a *App) Seek(sec float64) error                  { return a.core.Seek(sec) }
func (a *App) SetVolume(v float64)                     { a.core.SetVolume(v) }
func (a *App) SetEQBand(band int, db float64)          { a.core.SetEQBand(band, db) }
func (a *App) SetEQPreset(name string) [10]float64     { return a.core.SetEQPreset(name) }
func (a *App) SetSpeed(speed float64)                  { a.core.SetSpeed(speed) }
func (a *App) SetReverb(wet, room float64)             { a.core.SetReverb(wet, room) }
func (a *App) SetCrossfade(sec float64)                { a.core.SetCrossfade(sec) }
func (a *App) SetCrossfadeOnSkip(on bool)              { a.core.SetCrossfadeOnSkip(on) }
func (a *App) SetShuffle(on bool)                      { a.core.SetShuffle(on) }
func (a *App) SetRepeat(mode string)                   { a.core.SetRepeat(mode) }

func (a *App) CreatePlaylist(name string) (playlist.Playlist, error) {
	return a.core.CreatePlaylist(name)
}
func (a *App) RenamePlaylist(id, name string) error { return a.core.RenamePlaylist(id, name) }
func (a *App) DeletePlaylist(id string) error       { return a.core.DeletePlaylist(id) }
func (a *App) AddToPlaylist(id string, trackIDs []string) error {
	return a.core.AddToPlaylist(id, trackIDs)
}
func (a *App) RemoveFromPlaylist(id string, index int) error {
	return a.core.RemoveFromPlaylist(id, index)
}
