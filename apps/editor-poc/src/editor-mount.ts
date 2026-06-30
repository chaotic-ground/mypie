// Direct mount of typie's Rust→WASM editor — no website view layer, no mearie,
// no @typie/ui, no styled-system. Only @typie/editor-ffi/browser + a canvas
// per page + a hidden textarea. Message/event shapes mirror the website wrapper
// (apps/website/src/lib/editor-ffi/editor.svelte.ts) and the editor_ffi.d.ts.

import { createInstance } from '@typie/editor-ffi/browser';
import icuUrl from '@typie/editor-ffi/browser/icu.zst?url';
import wasmUrl from '@typie/editor-ffi/browser/wasm?url';
import type { Editor, EditorHost, Message, PlainDoc, Viewport } from '@typie/editor-ffi/browser';

// A truly empty graph has no editable structure (insertion errors with
// "offset out of bounds (len 0)"), so seed a doc with one empty paragraph.
const EMPTY_DOC: PlainDoc = {
  root: {
    node: { type: 'root', layout_mode: { type: 'continuous', max_width: 800 } },
    modifiers: {} as PlainDoc['root']['modifiers'],
    children: [
      {
        node: { type: 'paragraph' },
        modifiers: {} as PlainDoc['root']['modifiers'],
        children: [{ node: { type: 'text', text: '' }, modifiers: {} as PlainDoc['root']['modifiers'], children: [] }],
      },
    ],
  },
};

export type Feedback = { start: string; end: string; category: string; feedback: string };
export type MountedFeedback = Feedback & { id: string; ok: boolean };

// typie's default font family is 'Pretendard'; text whose font_family resolves
// to an unregistered family renders no glyphs (and emits no font_data_missing).
// add_font_base() expects ZSTD-COMPRESSED font bytes — a raw .ttf fails with a
// zstd magic-number error. This bundled font is a Latin-only placeholder; swap
// in a real Pretendard/Korean .ttf.zst for Korean glyph coverage.
const DEFAULT_FAMILY = 'Pretendard';
const DEFAULT_FONT_URL = `${import.meta.env.BASE_URL}poc-font.ttf.zst`;

let hostPromise: Promise<EditorHost> | undefined;

function initHost(): Promise<EditorHost> {
  return (hostPromise ??= (async () => {
    const [mod, icu] = await Promise.all([
      WebAssembly.compileStreaming(fetch(wasmUrl)),
      fetch(icuUrl)
        .then((r) => r.arrayBuffer())
        .then((b) => new Uint8Array(b)),
    ]);
    const { EditorHost } = await createInstance(mod);
    return EditorHost.create(icu); // WASM decompresses icu internally
  })());
}

const SPECIAL_KEYS: Record<string, 'enter' | 'backspace' | 'delete' | 'tab' | 'escape'> = {
  Enter: 'enter',
  Backspace: 'backspace',
  Delete: 'delete',
  Tab: 'tab',
  Escape: 'escape',
};

export class EditorMount {
  #host!: EditorHost;
  #editor!: Editor;
  #surfaceEl: HTMLElement;
  #inputEl: HTMLTextAreaElement;
  #canvases: HTMLCanvasElement[] = [];
  #dpr = Math.max(1, window.devicePixelRatio || 1);
  #raf = 0;
  #destroyed = false;
  #resizeObserver?: ResizeObserver;
  #fontBytes?: Uint8Array;

  constructor(surfaceEl: HTMLElement, inputEl: HTMLTextAreaElement) {
    this.#surfaceEl = surfaceEl;
    this.#inputEl = inputEl;
  }

  async init(): Promise<void> {
    this.#host = await initHost();

    const viewport = this.#viewport();
    this.#editor = this.#host.create_editor_from_doc(EMPTY_DOC, viewport);
    this.#host.set_theme_variant('light-white');

    this.#enqueue({ type: 'system', event: { type: 'theme_variant_changed' } });
    this.#enqueue({ type: 'system', event: { type: 'initialize' } });

    await this.#loadDefaultFont();

    // AI feedback decoration: red wavy underline (token resolved inside WASM).
    this.#enqueue({
      type: 'tracked_range',
      op: {
        type: 'set_group_decoration',
        group: 'ai-feedback',
        style: { background: undefined, underline: { color: 'text.red', style: 'wavy', thickness: 1.5 } },
        enabled: true,
        z_index: 0,
      },
    });

    this.#wireInput();
    this.#observeResize();
    this.#resize();
    this.#loop();
  }

  // Register the default family and supply its (zstd-compressed) base font so
  // typed text has glyphs to render.
  async #loadDefaultFont(): Promise<void> {
    try {
      this.#fontBytes = new Uint8Array(await fetch(DEFAULT_FONT_URL).then((r) => r.arrayBuffer()));
      this.#host.set_fonts([{ name: DEFAULT_FAMILY, source: 'DEFAULT', weights: [{ value: 400, hash: 'local', chunks: [] }] }]);
      this.#host.add_font_base(DEFAULT_FAMILY, 400, this.#fontBytes);
      this.#enqueue({ type: 'system', event: { type: 'fonts_changed' } });
      this.#enqueue({ type: 'system', event: { type: 'font_base_loaded', family: DEFAULT_FAMILY, weight: 400 } });
    } catch (err) {
      console.warn('default font load failed:', err);
    }
  }

  #viewport(): Viewport {
    const rect = this.#surfaceEl.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width) || 800),
      height: Math.max(1, Math.round(rect.height) || 600),
      scale_factor: this.#dpr,
    };
  }

  #enqueue(message: Message): void {
    this.#editor.enqueue(message);
  }

  #loop = (): void => {
    if (this.#destroyed) return;

    const events = this.#editor.tick();
    let pagesChanged = false;
    let repaint = false;
    for (const e of events) {
      if (e.type === 'state_changed' && e.fields.includes('page_sizes')) pagesChanged = true;
      if (e.type === 'render_invalidated') repaint = true;
      // Best-effort: satisfy any font request with the bundled base font.
      if (e.type === 'font_data_missing' && this.#fontBytes) {
        try {
          this.#host.add_font_base(e.family, e.weight, this.#fontBytes);
          this.#enqueue({ type: 'system', event: { type: 'font_base_loaded', family: e.family, weight: e.weight } });
          repaint = true;
        } catch {
          /* font may already be present */
        }
      }
    }
    if (pagesChanged) this.#reconcilePages();
    if (repaint || pagesChanged) this.#renderAll();

    this.#raf = requestAnimationFrame(this.#loop);
  };

  #reconcilePages(): void {
    const sizes = this.#editor.page_sizes();

    // Drop surplus canvases.
    while (this.#canvases.length > sizes.length) {
      const canvas = this.#canvases.pop()!;
      const page = this.#canvases.length;
      try {
        this.#editor.detach_surface(page);
      } catch {
        /* ignore */
      }
      canvas.remove();
    }

    sizes.forEach((size, i) => {
      let canvas = this.#canvases[i];
      const isNew = !canvas;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        canvas.style.background = '#fff';
        canvas.addEventListener('pointerdown', (ev) => this.#onPointerDown(ev, i));
        this.#surfaceEl.appendChild(canvas);
        this.#canvases[i] = canvas;
      }
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
      if (isNew) {
        this.#editor.attach_surface(i, canvas, size.width, size.height, this.#dpr);
      } else {
        this.#editor.resize_surface(i, size.width, size.height, this.#dpr);
      }
    });
  }

  #renderAll(): void {
    for (let i = 0; i < this.#canvases.length; i++) {
      try {
        this.#editor.render_surface(i);
      } catch {
        /* page may be detaching */
      }
    }
  }

  #onPointerDown(ev: PointerEvent, page: number): void {
    const rect = this.#canvases[page].getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    this.#enqueue({ type: 'selection', op: { type: 'set_at', page, x, y } });
    this.#inputEl.focus();
  }

  #wireInput(): void {
    const el = this.#inputEl;

    el.addEventListener('focus', () => this.#enqueue({ type: 'system', event: { type: 'set_focused', focused: true } }));
    el.addEventListener('blur', () => this.#enqueue({ type: 'system', event: { type: 'set_focused', focused: false } }));

    el.addEventListener('keydown', (e) => {
      const key = SPECIAL_KEYS[e.key];
      if (!key) return;
      e.preventDefault();
      this.#enqueue({
        type: 'key',
        event: { key, modifiers: { shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey } },
      });
    });

    // Printable text (incl. composed Korean) lands in the textarea; flush it on
    // input/compositionend and clear, so the textarea never accumulates.
    // typed/committed text goes through the IME text_input path (replace_selection),
    // same as the website's ime-input-adapter — NOT insertion/text.
    const flush = () => {
      const text = el.value;
      el.value = '';
      if (text) this.#enqueue({ type: 'text_input', ops: [{ type: 'replace_selection', text }] });
    };

    el.addEventListener('input', (e) => {
      if ((e as InputEvent).isComposing) return; // wait for compositionend
      flush();
    });
    el.addEventListener('compositionend', () => flush());
  }

  #observeResize(): void {
    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(this.#surfaceEl);
  }

  #resize(): void {
    const v = this.#viewport();
    this.#enqueue({ type: 'system', event: { type: 'resize', width: v.width, height: v.height, scale_factor: v.scale_factor } });
  }

  proseText(): string {
    this.#editor.tick();
    return this.#editor.prose_text();
  }

  clearFeedback(): void {
    this.#enqueue({ type: 'tracked_range', op: { type: 'clear_group', group: 'ai-feedback' } });
  }

  /** Map text-anchor feedback to prose offsets and add WASM tracked ranges. */
  applyFeedback(items: Feedback[]): MountedFeedback[] {
    const text = this.proseText();
    this.clearFeedback();

    return items.map((fb, idx) => {
      const id = `ai-feedback:${idx}`;
      const startOff = text.indexOf(fb.start);
      let ok = false;
      if (startOff >= 0) {
        const endAnchor = fb.end ? text.indexOf(fb.end, startOff) : -1;
        const endOff = endAnchor >= 0 ? endAnchor + fb.end.length : startOff + fb.start.length;
        const selection = this.#editor.prose_to_selection(startOff, endOff);
        if (selection) {
          this.#enqueue({ type: 'tracked_range', op: { type: 'add', id, group: 'ai-feedback', selection, metadata: '' } });
          ok = true;
        }
      }
      return { ...fb, id, ok };
    });
  }

  destroy(): void {
    this.#destroyed = true;
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver?.disconnect();
  }
}
