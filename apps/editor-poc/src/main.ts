import { mount } from 'svelte';
import App from './App.svelte';

// Render-scale cap (perf lever, see chaotic-ground/mypie#3).
// typie's editor renders on the CPU and re-rasters + putImageData the whole
// visible canvas every keystroke, so cost ∝ pixels ∝ devicePixelRatio². On a
// hidpi (retina) screen a large document costs ~4× and typing lags. Capping the
// devicePixelRatio the editor sees trades text sharpness for responsiveness.
//   Infinity = full crispness (slow on hidpi+large docs)
//   1.5      = balanced (default; ~mild blur, meaningfully faster)
//   1        = fastest (~75% less raster at dpr2), noticeably soft on retina
// Override live via URL for hands-on comparison, e.g. ?scale=1 (fastest),
// ?scale=1.5 (default), ?scale=99 (full crispness). Falls back to 1.5.
const scaleParam = Number(new URLSearchParams(location.search).get('scale'));
const RENDER_SCALE_CAP = scaleParam > 0 ? scaleParam : 1.5;
const realDpr = window.devicePixelRatio || 1;
if (realDpr > RENDER_SCALE_CAP) {
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => Math.min(realDpr, RENDER_SCALE_CAP),
    });
  } catch {
    /* some engines forbid overriding devicePixelRatio; fall back to native */
  }
}

const app = mount(App, { target: document.getElementById('app')! });

export default app;
