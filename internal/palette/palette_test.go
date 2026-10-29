package palette

import (
	"image"
	"image/color"
	"testing"
)

func TestDominantColorAndContrast(t *testing.T) {
	// 3/4 red, 1/4 blue.
	img := image.NewRGBA(image.Rect(0, 0, 200, 200))
	for y := range 200 {
		for x := range 200 {
			c := color.RGBA{220, 30, 30, 255}
			if x >= 150 {
				c = color.RGBA{30, 40, 220, 255}
			}
			img.Set(x, y, c)
		}
	}
	p := FromDecoded(img)

	var r, g, b int
	if _, err := fmtSscanf(p.Bg1, &r, &g, &b); err != nil {
		t.Fatal(err)
	}
	if r <= g || r <= b {
		t.Fatalf("Bg1 %s should be reddish", p.Bg1)
	}
	if p.Text != "#ffffff" {
		t.Fatalf("text on dark background should be white, got %s", p.Text)
	}
	if contrast(parse(p.Bg1), rgb{1, 1, 1}) < 4.5 {
		t.Fatalf("Bg1 %s not readable with white text", p.Bg1)
	}
}

func TestHSLRoundTrip(t *testing.T) {
	for _, c := range []rgb{{0.2, 0.4, 0.6}, {0.9, 0.1, 0.3}, {0.5, 0.5, 0.5}} {
		h, s, l := toHSL(c)
		got := fromHSL(h, s, l)
		if dist2(got, c) > 1e-9 {
			t.Fatalf("round trip %v -> %v", c, got)
		}
	}
}
