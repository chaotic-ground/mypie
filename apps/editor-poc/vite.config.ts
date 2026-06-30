import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const ffi = (p: string) =>
  fileURLToPath(new URL(`../../upstream/typie/crates/editor-ffi/pkg/browser/${p}`, import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: [
      // Regex finds tolerate (and re-append via $1) the ?url query, and the
      // exact bare match does not shadow the /wasm and /icu.zst subpaths.
      { find: /^@typie\/editor-ffi\/browser\/wasm(\?.*)?$/, replacement: `${ffi('editor_ffi_bg.wasm')}$1` },
      { find: /^@typie\/editor-ffi\/browser\/icu\.zst(\?.*)?$/, replacement: `${ffi('icu.zst')}$1` },
      { find: /^@typie\/editor-ffi\/browser$/, replacement: ffi('editor_ffi.js') },
    ],
  },
  server: {
    // The editor-ffi build artifacts live in the submodule, outside this app.
    fs: { allow: [repoRoot] },
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
});
