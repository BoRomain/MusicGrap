package audio

import (
	"os/exec"
	"syscall"
)

// hideWindow keeps the ffmpeg console window from flashing over the GUI.
func hideWindow(cmd *exec.Cmd) {
	const createNoWindow = 0x08000000
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
}
