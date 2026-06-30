<script lang="ts">
  import '@typie/ui/styles.css';
  import { setupThemeContext } from '@typie/ui/context';
  import { onMount } from 'svelte';
  import { browserScaleFactor, Editor, getEditorContext, setupEditorContext } from '$lib/editor-ffi/editor.svelte';
  import View from '$lib/editor-ffi/components/View.svelte';
  import { registerLocalPretendard } from './shims/fonts-local';
  import type { PlainDoc } from '@typie/editor-ffi/browser';

  const BRIDGE_URL = 'http://127.0.0.1:4319/feedback';

  // Contexts must exist before View's getThemeContext()/getEditorContext() run.
  const theme = setupThemeContext();
  setupEditorContext();
  const ctx = getEditorContext();

  // Theme attrs so styled-system color tokens resolve.
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.variantLight = 'white';
    document.documentElement.dataset.variantDark = 'black';
  }

  // Blank doc seeded with root font_family=Pretendard so unstyled text resolves
  // to a registered family (else it falls back to a glyphless placeholder).
  const EMPTY_DOC = {
    root: {
      node: { type: 'root', layout_mode: { type: 'continuous', max_width: 800 } },
      modifiers: { font_family: { type: 'font_family', value: 'Pretendard' } },
      children: [
        {
          node: { type: 'paragraph' },
          modifiers: {},
          children: [{ node: { type: 'text', text: '' }, modifiers: {}, children: [] }],
        },
      ],
    },
  } as unknown as PlainDoc;

  type Card = { id: string; ok: boolean; start: string; end: string; category: string | null; feedback: string };
  let status = $state('에디터 로딩 중…');
  let busy = $state(false);
  let cards = $state<Card[]>([]);

  const localDoc = {}; // opaque fragment key; the mearie shim ignores it

  onMount(() => {
    let editor: Editor | undefined;
    (async () => {
      editor = await Editor.createFromDoc(EMPTY_DOC, { width: 1, height: 1, scale_factor: browserScaleFactor() }, theme.currentThemeVariant);
      ctx.editor = editor;
      ctx.liveEditor = editor;
      editor.installAiFeedbackDecorations();
      await registerLocalPretendard();
      editor.enqueue({ type: 'system', event: { type: 'fonts_changed' } });
      status = '준비됨. 본문을 클릭하고 입력해 보세요.';
    })().catch((err) => {
      status = `에디터 초기화 실패: ${err.message}`;
      console.error(err);
    });
    return () => editor?.destroy();
  });

  async function proofread() {
    const editor = ctx.editor;
    if (!editor || busy) return;
    busy = true;
    status = '검사 중… (Claude Code)';
    try {
      const text = editor.proseText();
      if (!text.trim()) {
        status = '본문이 비어 있습니다.';
        cards = [];
        return;
      }
      editor.clearAiFeedbacks();
      const res = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`bridge ${res.status}`);
      const data = (await res.json()) as { feedback: { start: string; end: string; category: string; feedback: string }[] };
      cards = data.feedback.map((fb, i) => {
        const id = `ai-feedback:${i}`;
        const s = text.indexOf(fb.start);
        let ok = false;
        if (s >= 0) {
          const e = fb.end ? text.indexOf(fb.end, s) : -1;
          const end = e >= 0 ? e + fb.end.length : s + fb.start.length;
          const selection = editor.proseToSelection(s, end);
          if (selection) {
            editor.addAiFeedback({ id, selection, startText: fb.start, endText: fb.end, feedback: fb.feedback, category: fb.category });
            ok = true;
          }
        }
        return { id, ok, start: fb.start, end: fb.end, category: fb.category, feedback: fb.feedback };
      });
      const placed = cards.filter((c) => c.ok).length;
      status = `지적 ${cards.length}건 (본문 표시 ${placed}건)`;
    } catch (err) {
      status = `검사 실패: ${(err as Error).message} — ai-bridge 서버가 떠 있나요?`;
      console.error(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="app">
  <header>
    <strong>mypie</strong> · editor PoC
    <button onclick={proofread} disabled={busy}>검사</button>
    <span class="status">{status}</span>
  </header>

  <main>
    <div class="editor">
      <View document$key={localDoc} active useWindowScroll={false} style={{ flexGrow: '1' }} />
    </div>

    <aside>
      <h2>지적사항 <span class="count">{cards.length}</span></h2>
      {#if cards.length === 0}
        <p class="empty">검사를 실행하면 여기에 표시됩니다.</p>
      {:else}
        {#each cards as c, i (c.id)}
          <div class="card" class:miss={!c.ok}>
            <div class="card-top"><span class="num">{i + 1}</span>{#if c.category}<span class="type">{c.category}</span>{/if}{#if !c.ok}<span class="warn">위치 못 찾음</span>{/if}</div>
            <div class="quote">{c.start}{c.end && c.end !== c.start ? ` … ${c.end}` : ''}</div>
            <div class="note">{c.feedback}</div>
          </div>
        {/each}
      {/if}
    </aside>
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
  }
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 14px;
    border-bottom: 1px solid #e4e4e7;
    font-size: 14px;
  }
  header button {
    padding: 5px 14px;
    border: 1px solid #c1272d;
    background: #e5484d;
    color: #fff;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  header button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .status {
    color: #6b7280;
    font-size: 13px;
  }
  main {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .editor {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
  }
  aside {
    flex: 0 0 360px;
    border-left: 1px solid #e4e4e7;
    overflow-y: auto;
    padding: 16px;
  }
  aside h2 {
    font-size: 15px;
    margin: 0 0 12px;
  }
  .count {
    color: #6b7280;
    font-weight: 400;
  }
  .empty {
    color: #6b7280;
    font-size: 13px;
  }
  .card {
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .card.miss {
    opacity: 0.6;
  }
  .card-top {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  .num {
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    background: #e5484d;
    border-radius: 999px;
    padding: 1px 7px;
  }
  .type {
    font-size: 12px;
    font-weight: 600;
    color: #c1272d;
    background: #fde8e8;
    border-radius: 5px;
    padding: 1px 7px;
  }
  .warn {
    font-size: 11px;
    color: #92400e;
    background: #fef3c7;
    border-radius: 5px;
    padding: 1px 6px;
  }
  .quote {
    font-size: 13px;
    color: #6b7280;
    border-left: 3px solid #e4e4e7;
    padding-left: 8px;
    margin-bottom: 6px;
    white-space: pre-wrap;
  }
  .note {
    font-size: 13px;
    line-height: 1.5;
  }
</style>
