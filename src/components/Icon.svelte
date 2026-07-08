<script lang="ts">
  import { ICON_PATHS } from '../content/iconPaths';
  import { RESOURCE_BY_ID } from '../content/resources';

  // Renders a resource's game-icons.net silhouette, tinted by tier via the
  // --tier-N theme variables. Falls back to the emoji from ResourceDef for
  // ids without a mapped icon. `tint={false}` inherits the parent color
  // (used e.g. inside greyed-out locked rows).
  let { id, tint = true }: { id: string; tint?: boolean } = $props();

  const paths = $derived(ICON_PATHS[id]);
  const res = $derived(RESOURCE_BY_ID[id]);
</script>

{#if paths}
  <svg
    class="gi"
    style={tint ? `color: var(--tier-${res?.tier ?? 0})` : undefined}
    viewBox="0 0 512 512"
    aria-hidden="true"
  >
    {#each paths as d (d)}
      <path {d} />
    {/each}
  </svg>
{:else}
  <span aria-hidden="true">{res?.icon ?? '❔'}</span>
{/if}

<style>
  .gi {
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: -0.125em;
    fill: currentColor;
    filter: drop-shadow(0 1px 0 color-mix(in srgb, currentColor 25%, transparent));
  }
</style>
