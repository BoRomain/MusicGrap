// Package palette extracts a background color scheme from album artwork.
package palette

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"sort"

	"golang.org/x/image/draw"
)

// Palette holds CSS hex colors for the UI theme.
type Palette struct {
	Bg1    string `json:"bg1"`    // main background, dark enough for white text
	Bg2    string `json:"bg2"`    // gradient partner of Bg1
	Accent string `json:"accent"` // sliders, buttons
	Text   string `json:"text"`   // readable on Bg1
}

// Default is used when a track has no artwork.
var Default = Palette{Bg1: "#1b2030", Bg2: "#3a2350", Accent: "#b388ff", Text: "#ffffff"}

const (
	sampleSize = 64
	clusters   = 5
	iterations = 12
)

type rgb struct{ r, g, b float64 } // components in [0, 1]

// FromImage decodes an image and derives a palette from its dominant colors.
func FromImage(data []byte) (Palette, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return Default, err
	}
	return FromDecoded(img), nil
}

func FromDecoded(img image.Image) Palette {
	small := image.NewRGBA(image.Rect(0, 0, sampleSize, sampleSize))
	draw.ApproxBiLinear.Scale(small, small.Bounds(), img, img.Bounds(), draw.Src, nil)

	var all, usable []rgb
	for y := range sampleSize {
		for x := range sampleSize {
			c := small.RGBAAt(x, y)
			p := rgb{float64(c.R) / 255, float64(c.G) / 255, float64(c.B) / 255}
			all = append(all, p)
			if l := luminance(p); l > 0.03 && l < 0.92 {
				usable = append(usable, p)
			}
		}
	}
	if len(usable) < len(all)/10 {
		usable = all // mostly black/white artwork: use it as is
	}

	groups := kmeans(usable)
	dominant := groups[0].center
	// Vibrant: most saturated color that is not a speck.
	vibrant := dominant
	best := -1.0
	for _, g := range groups {
		share := float64(g.size) / float64(len(usable))
		if share < 0.03 {
			continue
		}
		_, s, _ := toHSL(g.center)
		if score := s * (0.4 + share); score > best {
			best, vibrant = score, g.center
		}
	}

	bg1 := clampLightness(dominant, 0.10, 0.28)
	bg2 := clampLightness(vibrant, 0.18, 0.38)
	accent := vibrant
	h, s, l := toHSL(accent)
	accent = fromHSL(h, math.Max(s, 0.45), math.Max(0.58, math.Min(l, 0.72)))

	text := "#ffffff"
	if contrast(bg1, rgb{1, 1, 1}) < 4.5 {
		text = "#111111"
	}
	return Palette{Bg1: hex(bg1), Bg2: hex(bg2), Accent: hex(accent), Text: text}
}

type group struct {
	center rgb
	size   int
}

// kmeans clusters the pixels and returns groups sorted by size, largest first.
func kmeans(px []rgb) []group {
	k := min(clusters, len(px))
	// Deterministic init: spread seeds across pixels sorted by luminance.
	sorted := append([]rgb(nil), px...)
	sort.Slice(sorted, func(i, j int) bool { return luminance(sorted[i]) < luminance(sorted[j]) })
	centers := make([]rgb, k)
	for i := range centers {
		centers[i] = sorted[(2*i+1)*len(sorted)/(2*k)]
	}

	assign := make([]int, len(px))
	sizes := make([]int, k)
	for range iterations {
		sums := make([]rgb, k)
		clear(sizes)
		for i, p := range px {
			bestD, best := math.Inf(1), 0
			for c, ctr := range centers {
				if d := dist2(p, ctr); d < bestD {
					bestD, best = d, c
				}
			}
			assign[i] = best
			sums[best].r += p.r
			sums[best].g += p.g
			sums[best].b += p.b
			sizes[best]++
		}
		for c := range centers {
			if n := float64(sizes[c]); n > 0 {
				centers[c] = rgb{sums[c].r / n, sums[c].g / n, sums[c].b / n}
			}
		}
	}

	groups := make([]group, k)
	for c := range groups {
		groups[c] = group{centers[c], sizes[c]}
	}
	sort.SliceStable(groups, func(i, j int) bool { return groups[i].size > groups[j].size })
	return groups
}

func dist2(a, b rgb) float64 {
	dr, dg, db := a.r-b.r, a.g-b.g, a.b-b.b
	// Weighted RGB distance, roughly matches perceived differences.
	return 2*dr*dr + 4*dg*dg + 3*db*db
}

func linear(c float64) float64 {
	if c <= 0.03928 {
		return c / 12.92
	}
	return math.Pow((c+0.055)/1.055, 2.4)
}

// luminance is the WCAG relative luminance.
func luminance(c rgb) float64 {
	return 0.2126*linear(c.r) + 0.7152*linear(c.g) + 0.0722*linear(c.b)
}

func contrast(a, b rgb) float64 {
	la, lb := luminance(a), luminance(b)
	if la < lb {
		la, lb = lb, la
	}
	return (la + 0.05) / (lb + 0.05)
}

func clampLightness(c rgb, lo, hi float64) rgb {
	h, s, l := toHSL(c)
	return fromHSL(h, s, math.Max(lo, math.Min(hi, l)))
}

func toHSL(c rgb) (h, s, l float64) {
	mx := math.Max(c.r, math.Max(c.g, c.b))
	mn := math.Min(c.r, math.Min(c.g, c.b))
	l = (mx + mn) / 2
	if mx == mn {
		return 0, 0, l
	}
	d := mx - mn
	if l > 0.5 {
		s = d / (2 - mx - mn)
	} else {
		s = d / (mx + mn)
	}
	switch mx {
	case c.r:
		h = (c.g - c.b) / d
		if c.g < c.b {
			h += 6
		}
	case c.g:
		h = (c.b-c.r)/d + 2
	default:
		h = (c.r-c.g)/d + 4
	}
	return h / 6, s, l
}

func fromHSL(h, s, l float64) rgb {
	if s == 0 {
		return rgb{l, l, l}
	}
	var q float64
	if l < 0.5 {
		q = l * (1 + s)
	} else {
		q = l + s - l*s
	}
	p := 2*l - q
	return rgb{hue(p, q, h+1.0/3), hue(p, q, h), hue(p, q, h-1.0/3)}
}

func hue(p, q, t float64) float64 {
	if t < 0 {
		t++
	}
	if t > 1 {
		t--
	}
	switch {
	case t < 1.0/6:
		return p + (q-p)*6*t
	case t < 0.5:
		return q
	case t < 2.0/3:
		return p + (q-p)*(2.0/3-t)*6
	}
	return p
}

func hex(c rgb) string {
	to := func(v float64) int { return int(math.Round(math.Max(0, math.Min(1, v)) * 255)) }
	return fmt.Sprintf("#%02x%02x%02x", to(c.r), to(c.g), to(c.b))
}
