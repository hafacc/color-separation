<script lang="ts">
import type { RgbU32 } from "#lib/utils/color.ts";
import { INKS_BY_RGB } from "#lib/utils/inks.ts";
import type { ColorState } from "#lib/utils/types.ts";
import ColorButton from "./ColorButton.svelte";

const {
  colors,
  positions,
  toggleColor,
  remapColor,
  muted,
}: {
  colors: Map<RgbU32, ColorState>;
  positions: ReadonlyMap<RgbU32, number>;
  toggleColor: (color: RgbU32) => void;
  remapColor: (color: RgbU32, remap: RgbU32) => void;
  muted: boolean;
} = $props();

const palette: readonly (readonly [RgbU32, string])[] = $derived(
  [...colors].map(([rgb, { name }]) => [rgb, name]),
);
</script>

<div class="flex flex-wrap justify-center">
  {#each colors as [color, { name, active, remap }] (color)}
    <ColorButton
      {color}
      {name}
      {toggleColor}
      {remapColor}
      {remap}
      {palette}
      {active}
      position={positions.get(color)}
      kmEligible={INKS_BY_RGB.get(color)?.kmEligible ?? false}
      {muted}
    />
  {/each}
</div>
