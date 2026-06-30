<script lang="ts">
  // Localized AI panel: same card concept as typie's DocumentPanelAi, but the
  // data source is our Claude Code bridge (App.proofread → editor.addAiFeedback),
  // not typie's GraphQL subscription. Reuses the editor wrapper's AI feedback
  // state (aiFeedbacks / activeAiFeedbackId / setActiveAiFeedback).
  import type { Editor } from '$lib/editor-ffi/editor.svelte';

  let { editor }: { editor: Editor } = $props();
  const feedbacks = $derived(editor?.aiFeedbacks ?? []);
</script>

<div class="ai">
  <h2>지적사항 <span class="count">{feedbacks.length}</span></h2>
  {#if feedbacks.length === 0}
    <p class="empty">상단 검사 버튼을 누르면 여기에 표시됩니다.</p>
  {:else}
    {#each feedbacks as fb, i (fb.id)}
      <button
        class="card"
        class:active={editor.activeAiFeedbackId === fb.id}
        onmouseenter={() => editor.setActiveAiFeedback(fb.id)}
        onmouseleave={() => editor.setActiveAiFeedback(null)}
        onclick={() => editor.setActiveAiFeedback(fb.id)}
        type="button"
      >
        <div class="top">
          <span class="num">{i + 1}</span>
          {#if fb.category}<span class="type">{fb.category}</span>{/if}
        </div>
        <div class="quote">{fb.startText}{fb.endText && fb.endText !== fb.startText ? ` … ${fb.endText}` : ''}</div>
        <div class="note">{fb.feedback}</div>
      </button>
    {/each}
  {/if}
</div>

<style>
  .ai { padding: 16px; width: 100%; }
  h2 { font-size: 15px; margin: 0 0 12px; }
  .count { color: #6b7280; font-weight: 400; }
  .empty { color: #6b7280; font-size: 13px; }
  .card {
    display: block; width: 100%; text-align: left;
    border: 1px solid #e4e4e7; border-radius: 8px;
    padding: 10px 12px; margin-bottom: 10px; cursor: pointer; background: #fff;
  }
  .card.active { border-color: #2563eb; box-shadow: 0 0 0 3px #dbeafe; }
  .top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .num { font-size: 12px; font-weight: 700; color: #fff; background: #2563eb; border-radius: 999px; padding: 1px 7px; }
  .type { font-size: 12px; font-weight: 600; color: #1d4ed8; background: #dbeafe; border-radius: 5px; padding: 1px 7px; }
  .quote { font-size: 13px; color: #6b7280; border-left: 3px solid #e4e4e7; padding-left: 8px; margin-bottom: 6px; white-space: pre-wrap; }
  .note { font-size: 13px; line-height: 1.5; }
</style>
