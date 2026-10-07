<script lang="ts">
import { TILES } from "#lib/utils/logo.ts";

const {
  size = 24,
  mono = false,
  class: className,
}: { size?: number; mono?: boolean; class?: string } = $props();
</script>

<svg
  class={className}
  width={size}
  height={size}
  viewBox="0 0 64 64"
  role="img"
  aria-label="Spot Color Separator"
>
  {#each TILES as [x, y, width, height, color, grey] (`${x}-${y}`)}
    <rect {x} {y} {width} {height} fill={mono ? grey : color} />
  {/each}
</svg>
