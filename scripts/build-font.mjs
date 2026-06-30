// Preprocess a .ttf into typie's base+chunks font format using editor-ffi's
// wasm-server build (get_font_codepoints + build_font), emitting
// apps/editor-poc/public/pretendard/{manifest.json, base.zst, chunk-N.zst}.
//
// Prereq: the SERVER wasm must be built first:
//   scripts/build-editor-ffi.sh   (builds both browser + server pkg)
//
// Usage: node scripts/build-font.mjs
import { execSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = execSync('git rev-parse --show-toplevel', { cwd: dirname(fileURLToPath(import.meta.url)) }).toString().trim();
const PKG = resolve(ROOT, 'upstream/typie/crates/editor-ffi/pkg/server');
const TTF = resolve(ROOT, 'upstream/typie/assets/Pretendard-Regular.ttf');
const OUT = resolve(ROOT, 'apps/editor-poc/public/pretendard');
const FAMILY = 'Pretendard';
const WEIGHT = 400;
const CHUNK_SIZE = 200;

const { createInstance } = await import(pathToFileURL(`${PKG}/editor_ffi.js`).href);
const mod = await WebAssembly.compile(await readFile(`${PKG}/editor_ffi_bg.wasm`));
const { EditorServer } = await createInstance(mod);
const server = EditorServer.create();

const ttf = new Uint8Array(await readFile(TTF));
const codepoints = [...server.get_font_codepoints(ttf)].sort((a, b) => a - b);
const chunks = [];
for (let i = 0; i < codepoints.length; i += CHUNK_SIZE) chunks.push(codepoints.slice(i, i + CHUNK_SIZE));

const out = server.build_font(ttf, { chunks });
console.log(`codepoints=${codepoints.length} chunks=${out.chunks.length} hash=${out.hash}`);

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/base.zst`, Buffer.from(out.base));
await Promise.all(out.chunks.map((c, i) => writeFile(`${OUT}/chunk-${i}.zst`, Buffer.from(c))));
await writeFile(`${OUT}/manifest.json`, JSON.stringify({ family: FAMILY, weight: WEIGHT, hash: out.hash, coverage: out.coverage }));
console.log('wrote', OUT);
