#!/usr/bin/env sh
# Screenshot of the connected phone, for UI review.
# Usage: scripts/android-shot.sh [name]   -> android-shots/<name>.png (default: timestamp)
# android-shots/ is git-ignored.
set -e
dir="$(dirname "$0")/../android-shots"
mkdir -p "$dir"
name="${1:-$(date +%Y%m%d-%H%M%S)}"
adb exec-out screencap -p > "$dir/$name.png"
echo "$dir/$name.png"
