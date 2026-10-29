package palette

import "fmt"

func fmtSscanf(hex string, r, g, b *int) (int, error) {
	return fmt.Sscanf(hex, "#%02x%02x%02x", r, g, b)
}

func parse(hex string) rgb {
	var r, g, b int
	fmtSscanf(hex, &r, &g, &b)
	return rgb{float64(r) / 255, float64(g) / 255, float64(b) / 255}
}
