<script lang="ts">
import { Slider } from "@ark-ui/svelte/slider";
import { Switch } from "@ark-ui/svelte/switch";
import { Tooltip } from "@ark-ui/svelte/tooltip";
import type { Snippet } from "svelte";
import type { RgbU32 } from "#lib/utils/color.ts";
import type { CustomColor } from "#lib/utils/custom-colors.ts";
import type { MixingMode } from "#lib/utils/sep.ts";
import type { Action, ColorState, Ordering } from "#lib/utils/types.ts";
import DownloadIcon from "~icons/fa6-solid/file-arrow-down";
import ColorPicker from "./ColorPicker.svelte";
import PaletteInput from "./PaletteInput.svelte";

let {
  colors,
  modifyColors,
  customs,
  saveCustom,
  deleteCustom,
  positions,
  ordering = $bindable(),
  mixingMode = $bindable(),
  kmAvailable,
  kmIneligibleNames,
  increments = $bindable(),
  tolerance = $bindable(),
  press = $bindable(),
  orderIndependent,
  download,
  isDownloading,
  showRaw = $bindable(),
  showGrid = $bindable(),
  rendering,
}: {
  colors: Map<RgbU32, ColorState>;
  modifyColors: (action: Action) => void;
  customs: readonly CustomColor[];
  saveCustom: (color: CustomColor) => void;
  deleteCustom: (rgb: RgbU32) => void;
  positions: ReadonlyMap<RgbU32, number>;
  ordering: Ordering;
  mixingMode: MixingMode;
  kmAvailable: boolean;
  kmIneligibleNames: readonly string[];
  increments: number;
  tolerance: number;
  press: boolean;
  /** Whether the model composes the same however the inks are stacked. */
  orderIndependent: boolean;
  download: () => void;
  isDownloading: boolean;
  showRaw: boolean;
  showGrid: boolean;
  rendering: boolean;
} = $props();

// Capturing the pointer keeps the release on this button, so dragging off
// it mid-hold still ends the hold -- and makes it work under touch.
function onDown(event: PointerEvent & { currentTarget: HTMLButtonElement }) {
  event.currentTarget.setPointerCapture(event.pointerId);
  showRaw = true;
}
function onUp() {
  showRaw = false;
}

const subtractive = $derived(mixingMode === "subtractive");
const selected = $derived([...colors.values()].some(({ active }) => active));
const exportText = $derived(
  selected ? undefined : "must select at least one color to export",
);
// The slider only reports once a drag ends, so it keeps its own position.
const initialIncrements = increments;
</script>

{#snippet header(title: string, action?: Snippet)}
  <div class="flex items-center justify-between gap-2">
    <h2 class="font-bold text-lg">{title}</h2>
    {@render action?.()}
  </div>
{/snippet}

{#snippet sliderControl()}
  <Slider.Control class="relative flex items-center h-5">
    <Slider.Track
      class="relative h-2 w-full rounded bg-slate-300 dark:bg-slate-600"
    >
      <Slider.Range
        class="absolute h-full rounded bg-slate-400 dark:bg-slate-500"
      />
    </Slider.Track>
    <Slider.Thumb
      index={0}
      class="absolute w-5 h-5 bg-white dark:bg-slate-200 border-2 border-slate-400 dark:border-slate-400 rounded-full shadow cursor-pointer"
    />
  </Slider.Control>
{/snippet}

<!-- Rendered unconditionally and disabled, rather than only for the mixing
     modes it applies to: mounting and unmounting it as the mode changed
     restarted its transition every time. -->
{#snippet pressSwitch()}
  <Switch.Root
    checked={press && !subtractive}
    class="flex-shrink-0 data-[disabled]:opacity-50"
    disabled={subtractive}
    id="press-simulation"
    onCheckedChange={({ checked }) => (press = checked)}
  >
    <Switch.Control
      class="block w-9 h-5 rounded-full bg-slate-300 dark:bg-slate-600 data-[state=checked]:bg-slate-500 dark:data-[state=checked]:bg-slate-400 transition-colors p-0.5"
    >
      <Switch.Thumb
        class="block w-4 h-4 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4"
      />
    </Switch.Control>
    <Switch.Label class="sr-only">Simulate dot gain</Switch.Label>
    <Switch.HiddenInput />
  </Switch.Root>
{/snippet}

<div class="flex flex-col gap-2 flex-shrink-0">
  <button
    class="w-full px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-white rounded disabled:opacity-50 disabled:pointer-events-none"
    disabled={!selected}
    onpointercancel={onUp}
    onpointerdown={onDown}
    onpointerup={onUp}
    type="button"
  >
    Hold for Original
  </button>
  <button
    aria-pressed={showGrid}
    class="w-full px-4 py-2 rounded disabled:opacity-50 disabled:pointer-events-none {showGrid
      ? 'bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-300 dark:hover:bg-slate-200 dark:text-slate-900'
      : 'bg-slate-300 hover:bg-slate-400 text-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-white'}"
    disabled={!selected}
    onclick={() => (showGrid = !showGrid)}
    type="button"
  >
    {showGrid ? "Hide Channels" : "Show Channels"}
  </button>
  <Tooltip.Root>
    <Tooltip.Trigger
      class="w-full px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-white rounded disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
      disabled={!selected || isDownloading}
      onclick={download}
      type="button"
    >
      <DownloadIcon />
      {isDownloading ? "Exporting..." : "Export Separation"}
    </Tooltip.Trigger>
    {#if exportText}
      <Tooltip.Positioner>
        <Tooltip.Content
          class="bg-slate-800 dark:bg-slate-700 text-white text-sm px-2 py-1 rounded shadow"
        >
          {exportText}
        </Tooltip.Content>
      </Tooltip.Positioner>
    {/if}
  </Tooltip.Root>
</div>
<div
  class="relative flex flex-col gap-2 flex-grow min-h-0 overflow-y-auto pr-1 -mr-1"
>
  {@render header("Colors")}
  <p class="text-slate-600 dark:text-slate-400">
    Click a color to toggle its use in the separation
  </p>
  <ColorPicker
    {colors}
    {positions}
    toggleColor={(color) => modifyColors({ action: "toggle", color })}
    remapColor={(color, remap) =>
      modifyColors({ action: "remap", color, remap })}
    muted={rendering}
  />
  {@render header("Mixing")}
  <p class="text-slate-600 dark:text-slate-400">
    How overlapping inks combine. Subtractive is the fastest and most exact,
    Kubelka-Munk the most physical.
  </p>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet asChild(props)}
        <select
          {...props()}
          class="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-100"
          bind:value={mixingMode}
        >
          <option value="subtractive">Subtractive</option>
          <option value="multiply">Multiply</option>
          <option value="kubelka_munk" disabled={!kmAvailable}>
            Kubelka-Munk{kmAvailable ? "" : " (incompatible inks)"}
          </option>
        </select>
      {/snippet}
    </Tooltip.Trigger>
    {#if !kmAvailable}
      <Tooltip.Positioner>
        <Tooltip.Content
          class="bg-slate-800 dark:bg-slate-700 text-white text-sm px-2 py-1 rounded shadow max-w-xs"
        >
          Kubelka-Munk disabled: no calibrated K(λ) for
          {kmIneligibleNames.join(", ")}.
        </Tooltip.Content>
      </Tooltip.Positioner>
    {/if}
  </Tooltip.Root>
  {@render header("Ordering")}
  <p class="text-slate-600 dark:text-slate-400">
    Print order of selected colors. First is printed paper-adjacent; last is on
    top.{orderIndependent
      ? " This model only uses it to number the layers."
      : ""}
  </p>
  <select
    class="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-100"
    bind:value={ordering}
  >
    <option value="light-to-dark">Lightest to darkest</option>
    <option value="manual">Selection order</option>
    <option value="auto">Automatic</option>
  </select>
  {@render header("Palette")}
  <p class="text-slate-600 dark:text-slate-400">
    Add new colors or reset to a palette
  </p>
  <PaletteInput
    {colors}
    addColor={(color, name) => modifyColors({ action: "add", color, name })}
    removeColor={(color) => modifyColors({ action: "remove", color })}
    {customs}
    {saveCustom}
    {deleteCustom}
  />
  {@render header("Discretizations")}
  <p class="text-slate-600 dark:text-slate-400">
    Number of discrete opacities each layer is rounded to, for a posterized
    look.
  </p>
  <div class="px-4">
    <Slider.Root
      defaultValue={[initialIncrements]}
      onValueChangeEnd={(details) => (increments = details.value[0])}
      min={0}
      max={7}
      step={1}
    >
      {@render sliderControl()}
    </Slider.Root>
  </div>
  {@render header("Ink Minimization")}
  <p class="text-slate-600 dark:text-slate-400">
    How much color shift you'll accept to drop an ink layer.{subtractive
      ? " Doesn't apply to Subtractive."
      : ""}
  </p>
  <div class="px-4 {subtractive ? 'opacity-50' : ''}">
    <Slider.Root
      disabled={subtractive}
      value={[tolerance]}
      onValueChange={(details) => (tolerance = details.value[0])}
      min={0}
      max={8}
      step={0.5}
    >
      {@render sliderControl()}
    </Slider.Root>
  </div>
  {@render header("Press Simulation", pressSwitch)}
  <p class="text-slate-600 dark:text-slate-400">
    Spread screened dots the way paper does, so midtones print darker.{subtractive
      ? " Doesn't apply to Subtractive."
      : ""}
  </p>
</div>
