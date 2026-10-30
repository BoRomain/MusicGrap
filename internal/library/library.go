// Package library scans a music folder, reads tags and caches the result.
package library

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/dhowden/tag"

	"musicplayer/internal/audio"
)

// tagsVersion is bumped when readTrack extracts new fields, so cached entries get re-read.
const tagsVersion = 2

type Track struct {
	ID          string `json:"id"`
	Path        string `json:"path"`
	Title       string `json:"title"`
	Artist      string `json:"artist"`
	AlbumArtist string `json:"albumArtist"`
	Album       string `json:"album"`
	DiscNo      int    `json:"discNo"`
	TrackNo     int    `json:"trackNo"`
	// Date is the release date as YYYY, YYYY-MM or YYYY-MM-DD, so it sorts as a string.
	Date     string  `json:"date"`
	Duration float64 `json:"duration"`
	ModTime  int64   `json:"modTime"`
	Size     int64   `json:"size"`
	TagsV    int     `json:"tagsV"`
	// Group is the artist the album is filed under (see groupArtist), computed on load.
	Group string `json:"group"`
}

// groupArtist is the artist an album is filed under, so featurings stay with their album.
// Without an album artist tag, it is the first artist credited ("Ziak, Lowonstage" → "Ziak").
func groupArtist(t Track) string {
	if t.AlbumArtist != "" {
		return t.AlbumArtist
	}
	if loc := artistSeparator.FindStringIndex(t.Artist); loc != nil && loc[0] > 0 {
		return strings.TrimSpace(t.Artist[:loc[0]])
	}
	return t.Artist
}

var artistSeparator = regexp.MustCompile(`(?i)\s*[,;/&]\s*|\s+(feat\.?|ft\.?|featuring|x|with)\s+`)

// leadingNumber matches a track number at the start of a file name ("01 - Title", "3. Title").
var leadingNumber = regexp.MustCompile(`^\s*(\d{1,3})\b`)

// dateTags are the raw tags holding a release date: ID3v2.4, ID3v2.3/2.2, Vorbis/ID3v1, MP4.
var dateTags = []string{"TDRC", "TDRL", "TYER", "TYE", "date", "year", "\xa9day"}

var datePrefix = regexp.MustCompile(`^\d{4}(-\d{2}(-\d{2})?)?`)

// releaseDate keeps the YYYY[-MM[-DD]] part of a date tag ("2021-05-14T00:00:00" → "2021-05-14").
func releaseDate(s string) string {
	return datePrefix.FindString(strings.TrimSpace(s))
}

// Library is safe for concurrent use.
type Library struct {
	cachePath string

	mu     sync.RWMutex
	tracks []Track
	byID   map[string]*Track
}

// New loads the cached library from cachePath, if any.
func New(cachePath string) *Library {
	l := &Library{cachePath: cachePath}
	var tracks []Track
	if b, err := os.ReadFile(cachePath); err == nil {
		json.Unmarshal(b, &tracks)
	}
	l.set(tracks)
	return l
}

func (l *Library) set(tracks []Track) {
	for i := range tracks {
		tracks[i].Group = groupArtist(tracks[i])
	}
	sort.SliceStable(tracks, func(i, j int) bool {
		a, b := tracks[i], tracks[j]
		if aa, ba := a.Group, b.Group; !strings.EqualFold(aa, ba) {
			return strings.ToLower(aa) < strings.ToLower(ba)
		}
		if !strings.EqualFold(a.Album, b.Album) {
			return strings.ToLower(a.Album) < strings.ToLower(b.Album)
		}
		if a.DiscNo != b.DiscNo {
			return a.DiscNo < b.DiscNo
		}
		if a.TrackNo != b.TrackNo {
			if a.TrackNo == 0 || b.TrackNo == 0 {
				return b.TrackNo == 0 // unnumbered tracks go last
			}
			return a.TrackNo < b.TrackNo
		}
		return a.Path < b.Path
	})
	byID := make(map[string]*Track, len(tracks))
	for i := range tracks {
		byID[tracks[i].ID] = &tracks[i]
	}
	l.mu.Lock()
	l.tracks, l.byID = tracks, byID
	l.mu.Unlock()
}

func (l *Library) Tracks() []Track {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return append([]Track(nil), l.tracks...)
}

func (l *Library) Get(id string) (Track, bool) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	t, ok := l.byID[id]
	if !ok {
		return Track{}, false
	}
	return *t, true
}

// Path resolves a track id to its file, for the player.
func (l *Library) Path(id string) (string, bool) {
	t, ok := l.Get(id)
	return t.Path, ok
}

func trackID(path string) string {
	h := sha1.Sum([]byte(path))
	return hex.EncodeToString(h[:8])
}

// Scan walks dir, reusing cached entries for unchanged files, and saves the cache.
// progress is called with (done, total) as files are processed.
func (l *Library) Scan(dir string, progress func(done, total int)) error {
	var files []string
	err := filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		if !d.IsDir() && audio.Supported(strings.ToLower(filepath.Ext(path))) {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return err
	}

	cached := map[string]Track{}
	for _, t := range l.Tracks() {
		cached[t.Path] = t
	}

	results := make([]*Track, len(files))
	jobs := make(chan int)
	var wg sync.WaitGroup
	var done int
	var doneMu sync.Mutex
	lastReport := time.Now()
	for range runtime.NumCPU() {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := range jobs {
				results[i] = readTrack(files[i], cached)
				doneMu.Lock()
				done++
				if progress != nil && (time.Since(lastReport) > 100*time.Millisecond || done == len(files)) {
					lastReport = time.Now()
					progress(done, len(files))
				}
				doneMu.Unlock()
			}
		}()
	}
	for i := range files {
		jobs <- i
	}
	close(jobs)
	wg.Wait()

	tracks := make([]Track, 0, len(files))
	for _, t := range results {
		if t != nil {
			tracks = append(tracks, *t)
		}
	}
	l.set(tracks)
	return l.save()
}

func readTrack(path string, cached map[string]Track) *Track {
	info, err := os.Stat(path)
	if err != nil {
		return nil
	}
	if c, ok := cached[path]; ok && c.ModTime == info.ModTime().Unix() && c.Size == info.Size() && c.TagsV == tagsVersion {
		return &c
	}
	dur, err := audio.Duration(path)
	if err != nil {
		return nil // not decodable: leave it out of the library
	}
	t := &Track{
		ID:       trackID(path),
		Path:     path,
		Title:    strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)),
		Duration: dur,
		ModTime:  info.ModTime().Unix(),
		Size:     info.Size(),
		TagsV:    tagsVersion,
	}
	if f, err := os.Open(path); err == nil {
		if m, err := tag.ReadFrom(f); err == nil {
			if s := strings.TrimSpace(m.Title()); s != "" {
				t.Title = s
			}
			t.Artist = strings.TrimSpace(m.Artist())
			if t.Artist == "" {
				t.Artist = strings.TrimSpace(m.AlbumArtist())
			}
			t.AlbumArtist = strings.TrimSpace(m.AlbumArtist())
			t.Album = strings.TrimSpace(m.Album())
			t.DiscNo, _ = m.Disc()
			t.TrackNo, _ = m.Track()
			for _, k := range dateTags {
				if v, ok := m.Raw()[k].(string); ok {
					if t.Date = releaseDate(v); t.Date != "" {
						break
					}
				}
			}
			if t.Date == "" && m.Year() > 0 {
				t.Date = fmt.Sprintf("%04d", m.Year())
			}
		}
		f.Close()
	}
	if t.TrackNo == 0 {
		if m := leadingNumber.FindStringSubmatch(filepath.Base(path)); m != nil {
			t.TrackNo, _ = strconv.Atoi(m[1])
		}
	}
	return t
}

func (l *Library) save() error {
	if err := os.MkdirAll(filepath.Dir(l.cachePath), 0o755); err != nil {
		return err
	}
	b, err := json.Marshal(l.Tracks())
	if err != nil {
		return err
	}
	return os.WriteFile(l.cachePath, b, 0o644)
}

var coverNames = []string{"cover.jpg", "cover.png", "folder.jpg", "folder.png", "front.jpg", "front.png", "album.jpg"}

var ErrNoCover = errors.New("no cover")

// Cover returns the embedded artwork of a track, or a cover image from its folder.
func (l *Library) Cover(id string) (data []byte, mime string, err error) {
	t, ok := l.Get(id)
	if !ok {
		return nil, "", ErrNoCover
	}
	if f, err := os.Open(t.Path); err == nil {
		m, err := tag.ReadFrom(f)
		f.Close()
		if err == nil && m.Picture() != nil && len(m.Picture().Data) > 0 {
			p := m.Picture()
			return p.Data, p.MIMEType, nil
		}
	}
	dir := filepath.Dir(t.Path)
	entries, _ := os.ReadDir(dir)
	for _, want := range coverNames {
		for _, e := range entries {
			if strings.EqualFold(e.Name(), want) {
				b, err := os.ReadFile(filepath.Join(dir, e.Name()))
				if err != nil {
					break
				}
				mime := "image/jpeg"
				if strings.HasSuffix(want, ".png") {
					mime = "image/png"
				}
				return b, mime, nil
			}
		}
	}
	return nil, "", ErrNoCover
}
