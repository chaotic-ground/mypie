import { defineConfig } from '@pandacss/dev';
// preset lives in the submodule; panda's config loader (esbuild) resolves the .ts
import { preset } from '../../upstream/typie/packages/styled-system/src';

// Must match the styled-system package's codegen config (eject/hash/separator)
// so extracted atomic class names hash-match the runtime css() output.
export default defineConfig({
  importMap: '@typie/styled-system',
  include: [
    '../../upstream/typie/apps/website/src/**/*.{js,ts,svelte}',
    '../../upstream/typie/packages/ui/src/**/*.{js,ts,svelte}',
    './src/**/*.{js,ts,svelte}',
  ],
  eject: true,
  presets: [preset],
  separator: '-',
  hash: true,
  minify: true,
});
