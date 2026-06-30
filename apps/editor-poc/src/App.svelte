<script lang="ts">
  import { onMount } from 'svelte';
  import { EditorMount, type MountedFeedback } from './editor-mount';

  const BRIDGE_URL = 'http://127.0.0.1:4319/feedback';

  let surfaceEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;
  let mount: EditorMount | undefined;

  let status = $state('에디터 로딩 중…');
  let busy = $state(false);
  let feedback = $state<MountedFeedback[]>([]);

  onMount(() => {
    mount = new EditorMount(surfaceEl, inputEl);
    mount
      .init()
      .then(() => {
        status = '준비됨. 본문을 클릭하고 입력해 보세요.';
      })
      .catch((err) => {
        status = `에디터 초기화 실패: ${err.message}`;
        console.error(err);
      });
    return () => mount?.destroy();
  });

  async function proofread() {
    if (!mount || busy) return;
    busy = true;
    status = '검사 중… (Claude Code)';
    try {
      const text = mount.proseText();
      if (!text.trim()) {
        status = '본문이 비어 있습니다.';
        feedback = [];
        return;
      }
      const res = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`bridge ${res.status}`);
      const data = (await res.json()) as { feedback: { start: string; end: string; category: string; feedback: string }[] };
      feedback = mount.applyFeedback(data.feedback);
      const placed = feedback.filter((f) => f.ok).length;
      status = `지적 ${feedback.length}건 (본문 표시 ${placed}건)`;
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
    <div class="scroll">
      <div class="surface" bind:this={surfaceEl}></div>
    </div>

    <aside>
      <h2>지적사항 <span class="count">{feedback.length}</span></h2>
      {#if feedback.length === 0}
        <p class="empty">검사를 실행하면 여기에 표시됩니다.</p>
      {:else}
        {#each feedback as fb, i (fb.id)}
          <div class="card" class:miss={!fb.ok}>
            <div class="card-top"><span class="num">{i + 1}</span><span class="type">{fb.category}</span>{#if !fb.ok}<span class="warn">위치 못 찾음</span>{/if}</div>
            <div class="quote">{fb.start}{fb.end && fb.end !== fb.start ? ` … ${fb.end}` : ''}</div>
            <div class="note">{fb.feedback}</div>
          </div>
        {/each}
      {/if}
    </aside>
  </main>

  <!-- hidden input sink for keyboard + IME (Korean) -->
  <textarea
    bind:this={inputEl}
    class="input-sink"
    autocapitalize="off"
    autocomplete="off"
    autocorrect="off"
    spellcheck={false}
  ></textarea>
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
  .scroll {
    flex: 1;
    overflow: auto;
    background: #fafafa;
    display: flex;
    justify-content: center;
  }
  .surface {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 0 120px;
    width: 100%;
    user-select: none;
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
  .input-sink {
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
    resize: none;
  }
</style>
