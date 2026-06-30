#!/usr/bin/env bash
# Build the @typie/editor-ffi browser WASM from the upstream/typie submodule.
#
# Produces upstream/typie/crates/editor-ffi/pkg/browser/{editor_ffi.js,
# editor_ffi_bg.wasm, editor_ffi.d.ts, icu.zst} — the package the editor PoC
# consumes. typie uses its OWN bindgen (crates/editor-bindgen), so neither
# wasm-pack nor a global wasm-bindgen is required.
#
# Prereqs: rustup (adds wasm32 target), zstd, and icu4x-datagen
#   cargo install icu4x-datagen
# wasm-opt is intentionally skipped (size-only optimization).
set -euo pipefail

root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
ffi="$root/upstream/typie/crates/editor-ffi"
profile="release-wasm"

[ -d "$ffi" ] || { echo "submodule missing: $ffi (git submodule update --init)" >&2; exit 1; }
command -v icu4x-datagen >/dev/null || { echo "need icu4x-datagen: cargo install icu4x-datagen" >&2; exit 1; }
command -v zstd >/dev/null || { echo "need zstd" >&2; exit 1; }

cd "$ffi"

echo "==> rust wasm32 target"
rustup target add wasm32-unknown-unknown

echo "==> cargo build ($profile, wasm-browser)"
cargo build --manifest-path Cargo.toml --profile "$profile" \
  --features wasm-browser --target wasm32-unknown-unknown

echo "==> wasm bindings (editor-bindgen)"
cargo run --quiet -p editor-bindgen --features bin --bin wasm-bindgen-cli -- \
  --target module --out-dir pkg/browser \
  "../../target/wasm32-unknown-unknown/$profile/editor_ffi.wasm"
cargo run --quiet -p editor-bindgen --features bin --bin editor-bindgen-js -- \
  pkg/browser/editor_ffi

echo "==> icu blob"
blob="$(mktemp --suffix=.blob)"
trap 'rm -f "$blob"' EXIT
RUST_LOG=off icu4x-datagen --markers-for-bin pkg/browser/editor_ffi_bg.wasm \
  --format blob --out "$blob"
zstd -19 -f -o pkg/browser/icu.zst "$blob"

echo "==> done:"
ls -lh pkg/browser/
