// Package mobile is the Android entry point, built into an .aar with
// `gomobile bind`. gomobile only handles simple types, so calls and events
// carry their arguments and results as JSON strings.
package mobile

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"

	"musicplayer/internal/audio"
	"musicplayer/internal/core"
	"musicplayer/internal/settings"
)

// Listener receives backend events; payload is JSON ("null" when there is none).
// Implemented on the Kotlin side.
type Listener interface {
	OnEvent(name, payload string)
}

// Source is one file decoded by Android (MediaCodec), as interleaved stereo
// 16-bit little-endian PCM. Same contract as audio.PCMSource.
type Source interface {
	SampleRate() int
	Frames() int64
	Read(max int) ([]byte, error)
	SeekFrame(frame int64) error
	Close()
}

// Decoder opens the formats the Go decoders don't handle (AAC, ALAC, Opus).
// Implemented on the Java side (AndroidDecoder).
type Decoder interface {
	Open(path string) (Source, error)
	Duration(path string) (float64, error)
}

type decoderAdapter struct{ d Decoder }

func (a decoderAdapter) Open(path string) (audio.PCMSource, error) { return a.d.Open(path) }
func (a decoderAdapter) Duration(path string) (float64, error)     { return a.d.Duration(path) }

// SetDecoder installs the platform decoder. Call it before Start.
func SetDecoder(d Decoder) { audio.SetExternalDecoder(decoderAdapter{d}) }

var (
	mu       sync.Mutex
	c        *core.Core
	coverURL string
)

// Start creates the backend once per process. dataDir holds settings,
// playlists and the library cache. Later calls do nothing.
func Start(dataDir string, l Listener) error {
	mu.Lock()
	defer mu.Unlock()
	if c != nil {
		return nil
	}
	settings.SetDir(dataDir)

	// Covers are served over local HTTP so <img> tags can load them like on desktop.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return err
	}
	c = core.New(func(event string, data any) {
		b, err := json.Marshal(data)
		if err != nil {
			log.Printf("event %s: %v", event, err)
			return
		}
		l.OnEvent(event, string(b))
	})
	mux := http.NewServeMux()
	mux.HandleFunc("/cover/", c.CoverHandler)
	go http.Serve(ln, withCORS(mux))
	coverURL = fmt.Sprintf("http://%s/cover/", ln.Addr())

	c.Start()
	return nil
}

// withCORS lets the webview (served from another origin) read covers with fetch
// as well as <img>.
func withCORS(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		h.ServeHTTP(w, r)
	})
}

// CoverBaseURL returns the prefix to which a track id is appended to get its cover.
func CoverBaseURL() string {
	mu.Lock()
	defer mu.Unlock()
	return coverURL
}

// Save writes the settings now (the app may be killed while in the background).
func Save() {
	if b := get(); b != nil {
		b.Shutdown()
	}
}

func get() *core.Core {
	mu.Lock()
	defer mu.Unlock()
	return c
}

var errNotStarted = errors.New("backend not started")

// Call runs a backend method. args is a JSON array of positional arguments;
// the result is the JSON-encoded return value ("null" when there is none).
func Call(method, args string) (string, error) {
	b := get()
	if b == nil {
		return "", errNotStarted
	}
	var raw []json.RawMessage
	if args != "" {
		if err := json.Unmarshal([]byte(args), &raw); err != nil {
			return "", fmt.Errorf("%s: bad arguments: %w", method, err)
		}
	}
	res, err := dispatch(b, method, raw)
	if err != nil {
		return "", err
	}
	out, err := json.Marshal(res)
	return string(out), err
}

// arg decodes the i-th argument into a value of type T.
func arg[T any](raw []json.RawMessage, i int) (T, error) {
	var v T
	if i >= len(raw) {
		return v, fmt.Errorf("missing argument %d", i+1)
	}
	return v, json.Unmarshal(raw[i], &v)
}

func dispatch(b *core.Core, method string, raw []json.RawMessage) (any, error) {
	// Each case decodes its arguments, then calls the matching Core method.
	// Errors from arg are collected in err and checked once before calling.
	var err error
	str := func(i int) string { v, e := arg[string](raw, i); err = errors.Join(err, e); return v }
	num := func(i int) float64 { v, e := arg[float64](raw, i); err = errors.Join(err, e); return v }
	boolean := func(i int) bool { v, e := arg[bool](raw, i); err = errors.Join(err, e); return v }
	strs := func(i int) []string { v, e := arg[[]string](raw, i); err = errors.Join(err, e); return v }

	var call func() (any, error)
	switch method {
	case "GetInitialState":
		call = func() (any, error) { return b.GetInitialState(), nil }
	case "SetMusicFolder":
		dir := str(0)
		call = func() (any, error) { b.SetMusicFolder(dir); return nil, nil }
	case "ScanLibrary":
		call = func() (any, error) { b.ScanLibrary(); return nil, nil }
	case "GetTracks":
		call = func() (any, error) { return b.GetTracks(), nil }
	case "GetQueue":
		call = func() (any, error) { return b.GetQueue(), nil }
	case "PlayQueue":
		ids, start := strs(0), int(num(1))
		call = func() (any, error) { return nil, b.PlayQueue(ids, start) }
	case "TogglePause":
		call = func() (any, error) { b.TogglePause(); return nil, nil }
	case "SetPaused":
		p := boolean(0)
		call = func() (any, error) { b.SetPaused(p); return nil, nil }
	case "Next":
		call = func() (any, error) { return nil, b.Next() }
	case "Prev":
		call = func() (any, error) { return nil, b.Prev() }
	case "Seek":
		sec := num(0)
		call = func() (any, error) { return nil, b.Seek(sec) }
	case "SetVolume":
		v := num(0)
		call = func() (any, error) { b.SetVolume(v); return nil, nil }
	case "SetEQBand":
		band, db := int(num(0)), num(1)
		call = func() (any, error) { b.SetEQBand(band, db); return nil, nil }
	case "SetEQPreset":
		name := str(0)
		call = func() (any, error) { return b.SetEQPreset(name), nil }
	case "SetSpeed":
		s := num(0)
		call = func() (any, error) { b.SetSpeed(s); return nil, nil }
	case "SetReverb":
		wet, room := num(0), num(1)
		call = func() (any, error) { b.SetReverb(wet, room); return nil, nil }
	case "SetCrossfade":
		sec := num(0)
		call = func() (any, error) { b.SetCrossfade(sec); return nil, nil }
	case "SetCrossfadeOnSkip":
		on := boolean(0)
		call = func() (any, error) { b.SetCrossfadeOnSkip(on); return nil, nil }
	case "SetShuffle":
		on := boolean(0)
		call = func() (any, error) { b.SetShuffle(on); return nil, nil }
	case "SetRepeat":
		mode := str(0)
		call = func() (any, error) { b.SetRepeat(mode); return nil, nil }
	case "CreatePlaylist":
		name := str(0)
		call = func() (any, error) { return b.CreatePlaylist(name) }
	case "RenamePlaylist":
		id, name := str(0), str(1)
		call = func() (any, error) { return nil, b.RenamePlaylist(id, name) }
	case "DeletePlaylist":
		id := str(0)
		call = func() (any, error) { return nil, b.DeletePlaylist(id) }
	case "AddToPlaylist":
		id, ids := str(0), strs(1)
		call = func() (any, error) { return nil, b.AddToPlaylist(id, ids) }
	case "RemoveFromPlaylist":
		id, index := str(0), int(num(1))
		call = func() (any, error) { return nil, b.RemoveFromPlaylist(id, index) }
	default:
		return nil, fmt.Errorf("unknown method %q", method)
	}
	if err != nil {
		return nil, fmt.Errorf("%s: %w", method, err)
	}
	return call()
}
