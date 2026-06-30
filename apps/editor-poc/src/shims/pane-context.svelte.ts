// Shim for the route's @pane/context.svelte — a single local pane, no dnd/tree.
// Module-singleton reactive state so the toolbar tab buttons (which mutate
// panelTabByPaneId/panelExpandedByPaneId) drive our PanelHost re-render.
export type PanelTab = 'settings' | 'ai' | 'note' | 'timeline' | 'info' | 'spellcheck' | 'comment';

const groupState = $state({
  current: {
    root: null as unknown,
    focusedPaneId: 'local',
    panelExpandedByPaneId: {} as Record<string, boolean>,
    panelTabByPaneId: {} as Record<string, PanelTab>,
  },
});

const paneGroup = { state: groupState };
const pane = { id: 'local' };

export function getPane() {
  return pane;
}
export function getPaneGroup() {
  return paneGroup;
}
export function setupPane() {
  return pane;
}
export function setupPaneGroup() {
  return paneGroup;
}
