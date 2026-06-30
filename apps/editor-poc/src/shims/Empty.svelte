<script lang="ts">
  // Fallback stub for editor components that never render on a blank document
  // (ExternalElement/ContextMenu/LinkTooltip) but whose transitive deps would
  // otherwise bloat the build. Behavior-identical when there is no content.
  let {}: Record<string, unknown> = $props();
</script>
