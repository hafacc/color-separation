<script lang="ts">
import { Tooltip } from "@ark-ui/svelte/tooltip";
import type { RgbU32 } from "#lib/utils/color.ts";
import ColorSwatch from "./ColorSwatch.svelte";

const {
  rgb,
  selected,
  label,
  kmEligible,
  onToggle,
  oncontextmenu,
}: {
  rgb: RgbU32;
  selected: boolean;
  label: string;
  kmEligible: boolean;
  onToggle: () => void;
  oncontextmenu?: (evt: MouseEvent) => void;
} = $props();
</script>

<Tooltip.Root>
  <Tooltip.Trigger
    type="button"
    aria-pressed={selected}
    class="mx-auto flex p-0 rounded-full transition-transform hover:scale-110"
    onclick={onToggle}
    {oncontextmenu}
  >
    <ColorSwatch color={rgb} {selected}>
      {#if !kmEligible}
        <span
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <span
            class="w-1.5 h-1.5 rounded-full bg-white"
            style:mix-blend-mode="difference"
          ></span>
        </span>
      {/if}
    </ColorSwatch>
  </Tooltip.Trigger>
  <Tooltip.Positioner>
    <Tooltip.Content
      class="bg-slate-800 dark:bg-slate-700 text-white text-sm px-2 py-1 rounded shadow z-50"
    >
      {label}
    </Tooltip.Content>
  </Tooltip.Positioner>
</Tooltip.Root>
