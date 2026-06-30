<script lang="ts">
  // Localized seam (the ONE accepted fork-free seam): mirrors DocumentPanel's
  // tab switch but renders only the editor-only tabs we reuse — `settings`
  // (typie's DocumentPanelSettings, verbatim) and `ai` (our localized AiPanel).
  // Other tabs (note/timeline/info/spellcheck/comment) are GraphQL-bound → skipped.
  import { getEditorContext } from '$lib/editor-ffi/editor.svelte';
  import DocumentPanelSettings from '@doc-panel-settings';
  import AiPanel from './AiPanel.svelte';
  import { getPane, getPaneGroup } from './shims/pane-context.svelte';

  const ctx = getEditorContext();
  const paneId = getPane().id;
  const paneGroup = getPaneGroup();

  const expanded = $derived(paneGroup.state.current.panelExpandedByPaneId[paneId] === true);
  const tab = $derived(paneGroup.state.current.panelTabByPaneId[paneId]);
</script>

{#if expanded && ctx.editor}
  <div class="panel">
    {#if tab === 'settings'}
      <DocumentPanelSettings editor={ctx.editor} />
    {:else if tab === 'ai'}
      <AiPanel editor={ctx.editor} />
    {/if}
  </div>
{/if}

<style>
  .panel {
    flex: 0 0 320px;
    width: 320px;
    height: 100%;
    overflow-y: auto;
    border-left: 1px solid #e4e4e7;
    background: #fff;
  }
</style>
