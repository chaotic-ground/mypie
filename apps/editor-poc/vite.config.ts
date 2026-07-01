import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { FileSystemIconLoader } from 'unplugin-icons/loaders';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';

// upstream/typie submodule + local shim path helpers
const up = (p: string) => fileURLToPath(new URL(`../../upstream/typie/${p}`, import.meta.url));
const shim = (p: string) => fileURLToPath(new URL(`./src/shims/${p}`, import.meta.url));
const ffi = (p: string) => up(`crates/editor-ffi/pkg/browser/${p}`);
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// Redirect any import of the route's @pane/context.svelte (relative paths of
// varying depth, so a string alias can't catch them) to our singleton shim.
const shimPaneContext = {
  name: 'shim-pane-context',
  enforce: 'pre' as const,
  resolveId(source: string) {
    if (source.includes('@pane/context.svelte')) return shim('pane-context.svelte.ts');
    return null;
  },
};

export default defineConfig({
  plugins: [
    shimPaneContext,
    svelte(),
    Icons({
      compiler: 'svelte',
      scale: 1,
      customCollections: {
        typie: FileSystemIconLoader(up('apps/website/src/icons')),
      },
    }),
  ],
  resolve: {
    // One Svelte 5 runtime across editor-poc + submodule, or context/runes break.
    dedupe: ['svelte'],
    alias: [
      // built editor-ffi wasm/icu (regex tolerate ?url via $1)
      { find: /^@typie\/editor-ffi\/browser\/wasm(\?.*)?$/, replacement: `${ffi('editor_ffi_bg.wasm')}$1` },
      { find: /^@typie\/editor-ffi\/browser\/icu\.zst(\?.*)?$/, replacement: `${ffi('icu.zst')}$1` },
      { find: /^@typie\/editor-ffi\/browser$/, replacement: ffi('editor_ffi.js') },

      // local shims (data layer + sveltekit runtime)
      { find: '$mearie', replacement: shim('mearie.ts') },
      { find: '@mearie/svelte', replacement: shim('mearie.ts') },
      { find: '$app/navigation', replacement: shim('app-navigation.ts') },
      { find: '$app/state', replacement: shim('app-state.ts') },
      { find: '$app/environment', replacement: shim('app-environment.ts') },
      { find: '$env/dynamic/public', replacement: shim('env-dynamic-public.ts') },
      { find: 'mixpanel-browser', replacement: shim('mixpanel.ts') },
      // reused settings panel (absolute alias avoids brittle (dashboard)/[slug] relative resolution)
      { find: '@doc-panel-settings', replacement: up('apps/website/src/routes/website/(dashboard)/[slug]/v2/@document-panel/DocumentPanelSettings.svelte') },

      // typie website source (View subtree)
      { find: '$lib', replacement: up('apps/website/src/lib') },

      // @typie workspace packages -> source/generated (anchored regex per exports map)
      { find: /^@typie\/ui\/styles\.css$/, replacement: up('packages/ui/styles/index.css') },
      { find: /^@typie\/ui\/(.+)$/, replacement: up('packages/ui/src/$1/index.ts') },
      { find: /^@typie\/styled-system\/(css|patterns|tokens|types)$/, replacement: up('packages/styled-system/styled-system/$1/index.js') },
      { find: /^@typie\/styled-system$/, replacement: up('packages/styled-system/src/index.ts') },
      { find: /^@typie\/lib\/(dayjs|svelte)$/, replacement: up('packages/lib/src/$1/index.ts') },
      { find: /^@typie\/lib\/postcss$/, replacement: up('packages/lib/src/postcss/index.js') },
      { find: /^@typie\/lib\/(const|enums|errors|validation)$/, replacement: up('packages/lib/src/$1.ts') },
      { find: /^@typie\/lib$/, replacement: up('packages/lib/src/index.ts') },
    ],
  },
  server: {
    fs: { allow: [repoRoot, up('.')] },
    // Same-origin proxy to the ai-bridge so the browser never makes a
    // cross-origin request (avoids CORS + Firefox loopback quirks). App fetches
    // /ai-bridge/feedback -> 127.0.0.1:4319/feedback.
    proxy: {
      '/ai-bridge': {
        target: 'http://127.0.0.1:4319',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ai-bridge/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['@typie/editor-ffi'],
  },
  // Submodule tsconfigs extend a SvelteKit-generated .svelte-kit/tsconfig.json
  // that we never sync; force an inline tsconfig so the transform doesn't try
  // to load (missing) per-file project configs.
  esbuild: {
    tsconfigRaw: { compilerOptions: { target: 'esnext', useDefineForClassFields: true } },
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
});
