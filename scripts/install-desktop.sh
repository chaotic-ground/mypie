#!/usr/bin/env bash
# Install a desktop launcher for the built mypie app.
#
# Points at the AppImage if one was bundled, otherwise the raw release binary.
# The Exec runs through `bash -lc` so the app inherits the login shell PATH —
# the bundled ai-bridge spawns `node` (asdf shim) which spawns `claude`
# (~/.local/bin), neither of which is on the bare desktop-session PATH.
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
APP_DIR="$REPO_ROOT/apps/editor-poc"
BUNDLE_DIR="$APP_DIR/src-tauri/target/release/bundle"
RAW_BIN="$APP_DIR/src-tauri/target/release/mypie"

target=""
appimage=$(ls -1 "$BUNDLE_DIR"/appimage/*.AppImage 2>/dev/null | head -n1 || true)
if [[ -n "$appimage" ]]; then
  chmod +x "$appimage"
  target="$appimage"
elif [[ -x "$RAW_BIN" ]]; then
  target="$RAW_BIN"
else
  echo "error: no built app found. Build it first:  (cd $APP_DIR && pnpm tauri build)" >&2
  exit 1
fi

apps_dir="$HOME/.local/share/applications"
icon_dir="$HOME/.local/share/icons/hicolor/128x128/apps"
mkdir -p "$apps_dir" "$icon_dir"
cp "$APP_DIR/src-tauri/icons/128x128.png" "$icon_dir/mypie.png"

desktop_file="$apps_dir/mypie.desktop"
cat > "$desktop_file" <<EOF
[Desktop Entry]
Type=Application
Name=mypie
Comment=Local writing editor with Claude Code proofreading
Exec=bash -lc "exec $target"
Icon=mypie
Terminal=false
Categories=Utility;TextEditor;
StartupWMClass=mypie
EOF

update-desktop-database "$apps_dir" 2>/dev/null || true
gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo "installed: $desktop_file"
echo "   -> $target"
