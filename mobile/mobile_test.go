package mobile

import (
	"encoding/json"
	"testing"
)

func TestArg(t *testing.T) {
	var raw []json.RawMessage
	if err := json.Unmarshal([]byte(`["a", 2, true, ["x","y"]]`), &raw); err != nil {
		t.Fatal(err)
	}
	if v, err := arg[string](raw, 0); err != nil || v != "a" {
		t.Errorf("string: %q %v", v, err)
	}
	if v, err := arg[float64](raw, 1); err != nil || v != 2 {
		t.Errorf("number: %v %v", v, err)
	}
	if v, err := arg[[]string](raw, 3); err != nil || len(v) != 2 {
		t.Errorf("strings: %v %v", v, err)
	}
	if _, err := arg[string](raw, 4); err == nil {
		t.Error("missing argument accepted")
	}
	if _, err := arg[string](raw, 1); err == nil {
		t.Error("wrong type accepted")
	}
}

func TestCallBeforeStart(t *testing.T) {
	if _, err := Call("Next", "[]"); err != errNotStarted {
		t.Errorf("got %v, want errNotStarted", err)
	}
}
