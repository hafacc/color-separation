<script lang="ts">
import { Menu } from "@ark-ui/svelte/menu";
import { Tooltip } from "@ark-ui/svelte/tooltip";
import { type RgbU32, rgbToCss } from "#lib/utils/color.ts";

const {
  color,
  name,
  active,
  remap,
  palette,
  position,
  kmEligible = true,
  toggleColor,
  remapColor,
  muted = false,
}: {
  color: RgbU32;
  name: string;
  active: boolean;
  remap: RgbU32 | undefined;
  palette: readonly (readonly [RgbU32, string])[];
  position?: number | undefined;
  kmEligible?: boolean;
  toggleColor: (color: RgbU32) => void;
  remapColor: (color: RgbU32, remap: RgbU32) => void;
  muted?: boolean;
} = $props();

const colorCss = $derived(rgbToCss(color));
const fillCss = $derived(active ? rgbToCss(remap ?? color) : "transparent");
const buttonClass = $derived(
  `relative rounded-full transition-all m-1 focus:outline w-8 h-8 hover:scale-110 ${muted ? "opacity-50" : ""}`,
);
const buttonStyle = $derived(
  `border-width: ${active ? "0.2rem" : "1rem"}; border-color: ${colorCss}; outline-color: ${colorCss}; background-color: ${fillCss};`,
);
const tooltipLabel = $derived(
  kmEligible ? name : `${name} · no K-M calibration`,
);
</script>

{#snippet ineligible()}
  {#if !kmEligible}
    <span
      class="absolute w-1.5 h-1.5 rounded-full bg-white pointer-events-none"
      style="top: 50%; left: 50%; transform: translate(-50%, -50%); mix-blend-mode: difference;"
      aria-hidden="true"
    ></span>
  {/if}
{/snippet}

{#if active}
  <Menu.Root
    onSelect={(details) => remapColor(color, Number(details.value) as RgbU32)}
  >
    <Menu.ContextTrigger
      class={buttonClass}
      style={buttonStyle}
      onclick={() => toggleColor(color)}
      type="button"
      title={tooltipLabel}
    >
      <!-- When active the position number already occupies the center, so the
           KM-ineligible dot would just clutter it — show the number alone. -->
      {#if position !== undefined}
        <span
          class="absolute inset-0 flex items-center justify-center text-white text-sm font-bold pointer-events-none select-none"
          style:mix-blend-mode="difference"
        >
          {position}
        </span>
      {:else}
        {@render ineligible()}
      {/if}
    </Menu.ContextTrigger>
    <Menu.Positioner>
      <Menu.Content
        class="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded shadow-lg p-1 z-50 focus:outline-none"
      >
        {#each palette as [paletteColor, paletteName] (paletteColor)}
          <Menu.Item
            value={`${paletteColor}`}
            class="flex items-center gap-2 px-2 py-1 rounded cursor-pointer data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700"
          >
            <span
              class="inline-block w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600"
              style:background-color={rgbToCss(paletteColor)}
            ></span>
            <span class="text-sm">{paletteName}</span>
          </Menu.Item>
        {/each}
      </Menu.Content>
    </Menu.Positioner>
  </Menu.Root>
{:else}
  <Tooltip.Root>
    <Tooltip.Trigger
      class={buttonClass}
      style={buttonStyle}
      onclick={() => toggleColor(color)}
      type="button"
    >
      {@render ineligible()}
    </Tooltip.Trigger>
    <Tooltip.Positioner>
      <Tooltip.Content
        class="bg-slate-800 dark:bg-slate-700 text-white text-sm px-2 py-1 rounded shadow"
      >
        {tooltipLabel}
      </Tooltip.Content>
    </Tooltip.Positioner>
  </Tooltip.Root>
{/if}
