#!/usr/bin/env bash
# Prepare the upstream/typie submodule so editor-poc can reuse its Svelte view
# layer (View/Page/Input + editor.svelte.ts) via vite aliases.
#
# Does NOT build the WASM — run scripts/build-editor-ffi.sh (and build-font.mjs)
# separately for that.
set -euo pipefail

root="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
sub="$root/upstream/typie"

echo "==> submodule checkout"
git -C "$root" submodule update --init upstream/typie

echo "==> pnpm install (typie workspace)"
( cd "$sub" && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install )

echo "==> panda codegen (@typie/styled-system -> styled-system/)"
( cd "$sub" && COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @typie/styled-system codegen )

# The website/ui tsconfigs extend the SvelteKit-generated .svelte-kit/tsconfig.json,
# which only exists after `svelte-kit sync`. We don't run SvelteKit, so write a
# minimal stub each package can extend.
echo "==> .svelte-kit/tsconfig.json stubs"
stub='{
  "compilerOptions": {
    "target": "esnext", "module": "esnext", "moduleResolution": "bundler",
    "lib": ["esnext", "DOM", "DOM.Iterable"],
    "verbatimModuleSyntax": true, "isolatedModules": true, "useDefineForClassFields": true,
    "allowJs": true, "checkJs": false, "esModuleInterop": true, "skipLibCheck": true,
    "resolveJsonModule": true, "strict": true
  }
}'
for pkg in apps/website packages/ui; do
  mkdir -p "$sub/$pkg/.svelte-kit"
  printf '%s\n' "$stub" > "$sub/$pkg/.svelte-kit/tsconfig.json"
done

echo "==> done. Next: scripts/build-editor-ffi.sh && node scripts/build-font.mjs"
