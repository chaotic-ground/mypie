<script lang="ts">
  import './app.css';
  import { BottomToolbar, Editor as EditorComponent, TopToolbar } from '$lib/editor-ffi/components';
  import { browserScaleFactor, Editor, getEditorContext, setupEditorContext } from '$lib/editor-ffi/editor.svelte';
  import { HorizontalDivider } from '@typie/ui/components';
  import { setupAppContext, setupThemeContext } from '@typie/ui/context';
  import { onMount } from 'svelte';
  import PanelHost from './PanelHost.svelte';
  import { registerLocalPretendard } from './shims/fonts-local';
  import { getPane, getPaneGroup } from './shims/pane-context.svelte';
  import type { PlainDoc } from '@typie/editor-ffi/browser';

  const BRIDGE_URL = 'http://127.0.0.1:4319/feedback';

  // Contexts must exist before editor components call
  // getThemeContext()/getAppContext()/getEditorContext().
  const theme = setupThemeContext();
  setupAppContext('local');
  setupEditorContext();
  const ctx = getEditorContext();
  const paneGroup = getPaneGroup();
  const paneId = getPane().id;

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.variantLight = 'white';
    document.documentElement.dataset.variantDark = 'black';
  }

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

  const localDoc = {}; // opaque fragment key; the mearie shim ignores it

  let status = $state('에디터 로딩 중…');
  let busy = $state(false);

  // localized title/subtitle: plain $state (no updateDocument mutation),
  // navigation keydown kept verbatim from DocumentEditor.
  let localTitle = $state('');
  let localSubtitle = $state('');
  let titleEl = $state<HTMLTextAreaElement>();
  let subtitleEl = $state<HTMLTextAreaElement>();

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

  function openAiPanel() {
    paneGroup.state.current.panelTabByPaneId = { ...paneGroup.state.current.panelTabByPaneId, [paneId]: 'ai' };
    paneGroup.state.current.panelExpandedByPaneId = { ...paneGroup.state.current.panelExpandedByPaneId, [paneId]: true };
  }

  async function proofread() {
    const editor = ctx.editor;
    if (!editor || busy) return;
    busy = true;
    openAiPanel();
    status = '검사 중… (Claude Code)';
    try {
      const text = editor.proseText();
      editor.clearAiFeedbacks();
      if (!text.trim()) {
        status = '본문이 비어 있습니다.';
        return;
      }
      const res = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`bridge ${res.status}`);
      const data = (await res.json()) as { feedback: { start: string; end: string; category: string; feedback: string }[] };
      let placed = 0;
      data.feedback.forEach((fb, i) => {
        const s = text.indexOf(fb.start);
        if (s < 0) return;
        const e = fb.end ? text.indexOf(fb.end, s) : -1;
        const end = e >= 0 ? e + fb.end.length : s + fb.start.length;
        const selection = editor.proseToSelection(s, end);
        if (selection) {
          editor.addAiFeedback({ id: `ai-feedback:${i}`, selection, startText: fb.start, endText: fb.end, feedback: fb.feedback, category: fb.category });
          placed++;
        }
      });
      status = `지적 ${data.feedback.length}건 (본문 표시 ${placed}건)`;
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
    <strong>mypie</strong> · editor
    <button onclick={proofread} disabled={busy}>검사</button>
    <span class="status">{status}</span>
  </header>

  <HorizontalDivider color="secondary" />
  <!-- editor-related panel tabs only (AI + 본문 설정); see app.css .toptoolbar rule -->
  <div class="toptoolbar"><TopToolbar /></div>

  <div class="body">
    <div class="editor-col">
      <BottomToolbar
        fontFamilies={[{ id: 'pretendard', familyName: 'Pretendard', displayName: 'Pretendard', state: 'ACTIVE', fonts: [{ weight: 400, state: 'ACTIVE' }] }]}
        onSearchClick={() => {}}
        onFontUploadClick={() => {}}
      />
      <EditorComponent active document$key={localDoc}>
        {#snippet header()}
          <div class="doc-header">
            <textarea
              bind:this={titleEl}
              class="title"
              maxlength={100}
              placeholder="제목을 입력하세요"
              rows={1}
              spellcheck="false"
              bind:value={localTitle}
              onkeydown={(e) => {
                if (e.isComposing) return;
                if (e.key === 'Enter' || (!e.altKey && e.key === 'ArrowDown')) {
                  e.preventDefault();
                  subtitleEl?.focus();
                }
              }}
            ></textarea>
            <textarea
              bind:this={subtitleEl}
              class="subtitle"
              maxlength={100}
              placeholder="부제목을 입력하세요"
              rows={1}
              spellcheck="false"
              bind:value={localSubtitle}
              onkeydown={(e) => {
                if (e.isComposing) return;
                if ((!e.altKey && e.key === 'ArrowUp') || (e.key === 'Backspace' && !localSubtitle)) {
                  e.preventDefault();
                  titleEl?.focus();
                }
                if (e.key === 'Enter' || (!e.altKey && e.key === 'ArrowDown') || (e.key === 'Tab' && !e.shiftKey)) {
                  e.preventDefault();
                  ctx.editor?.focus();
                  ctx.editor?.enqueue({ type: 'navigation', op: { type: 'move', movement: { type: 'document', direction: 'backward' }, extend: false } });
                }
              }}
            ></textarea>
            <HorizontalDivider style={{ marginTop: '10px' }} />
          </div>
        {/snippet}
      </EditorComponent>
    </div>

    <PanelHost />
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
  }
  .app { display: flex; flex-direction: column; height: 100vh; }
  header { display: flex; align-items: center; gap: 12px; padding: 8px 14px; font-size: 14px; }
  header button { padding: 5px 14px; border: 1px solid #c1272d; background: #e5484d; color: #fff; border-radius: 6px; cursor: pointer; font-size: 13px; }
  header button:disabled { opacity: 0.5; cursor: default; }
  .status { color: #6b7280; font-size: 13px; }
  .body { display: flex; flex: 1; min-height: 0; }
  .editor-col { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; }
  .doc-header { display: flex; flex-direction: column; align-items: center; padding-top: 40px; width: 100%; }
  .title { border: 0; outline: 0; width: 100%; max-width: 800px; font-size: 28px; font-weight: 700; resize: none; }
  .subtitle { border: 0; outline: 0; width: 100%; max-width: 800px; margin-top: 4px; font-size: 16px; font-weight: 500; resize: none; overflow: hidden; }
</style>
