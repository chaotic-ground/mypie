// Register the locally-preprocessed Pretendard (base+chunks) against the same
// WASM singleton the editor uses. View's loadFonts([]) registers nothing (our
// mearie shim returns empty fontFamilies), so without this glyphs are invisible.
import { wasm } from '$lib/wasm-ffi.svelte';

const FONT_DIR = `${import.meta.env.BASE_URL}pretendard`;

type Manifest = { family: string; weight: number; hash: string; coverage: number[][] };

export async function registerLocalPretendard(): Promise<void> {
  const bytes = async (url: string) => new Uint8Array(await fetch(url).then((r) => r.arrayBuffer()));
  const m = (await fetch(`${FONT_DIR}/manifest.json`).then((r) => r.json())) as Manifest;

  wasm.set_fonts([{ name: m.family, source: 'DEFAULT', weights: [{ value: m.weight, hash: m.hash, chunks: m.coverage as never }] }]);
  wasm.add_font_base(m.family, m.weight, await bytes(`${FONT_DIR}/base.zst`));
  await Promise.all(m.coverage.map(async (_, i) => wasm.add_font_chunk(m.family, m.weight, i, await bytes(`${FONT_DIR}/chunk-${i}.zst`))));
}
