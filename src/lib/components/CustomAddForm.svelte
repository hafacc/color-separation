<script lang="ts">
import { Tooltip } from "@ark-ui/svelte/tooltip";
import { hexToRgb } from "#lib/utils/color.ts";
import type { CustomColor } from "#lib/utils/custom-colors.ts";
import { INKS_BY_RGB } from "#lib/utils/inks.ts";
import ColorSwatch from "./ColorSwatch.svelte";

const {
  customs,
  onSave,
}: {
  customs: readonly CustomColor[];
  onSave: (color: CustomColor) => void;
} = $props();

let hex = $state("#ff0000");
let name = $state("");

const trimmedName = $derived(name.trim());
const rgb = $derived(hexToRgb(hex));
// Reject a name or color that already belongs to any color — Riso ink or
// saved custom — so two swatches can't collide. `reason` doubles as the
// disabled-Save tooltip text; undefined means the form is valid.
const reason = $derived.by(() => {
  const colorOwner =
    INKS_BY_RGB.get(rgb)?.name ??
    customs.find((color) => color.rgb === rgb)?.name;
  const lowerName = trimmedName.toLowerCase();
  const nameTaken =
    [...INKS_BY_RGB.values()].some(
      (ink) => ink.name.toLowerCase() === lowerName,
    ) || customs.some((color) => color.name.toLowerCase() === lowerName);
  if (!trimmedName) {
    return "Enter a name";
  } else if (colorOwner) {
    return `That color is already used by ${colorOwner}`;
  } else if (nameTaken) {
    return `The name "${trimmedName}" is already in use`;
  } else {
    return undefined;
  }
});

function onsubmit(evt: SubmitEvent) {
  evt.preventDefault();
  if (reason === undefined) onSave({ rgb, name: trimmedName });
}
</script>

{#snippet saveButton()}
  <button
    type="submit"
    disabled={reason !== undefined}
    class="px-3 py-1 text-sm bg-slate-300 hover:bg-slate-400 text-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-white rounded disabled:opacity-50 disabled:pointer-events-none"
  >
    Save
  </button>
{/snippet}

<form {onsubmit} class="flex items-center gap-2">
  <label
    class="flex-shrink-0 cursor-pointer rounded-full transition-transform hover:scale-110"
  >
    <ColorSwatch color={hex} />
    <input
      type="color"
      bind:value={hex}
      class="sr-only"
      aria-label="Pick color"
    />
  </label>
  <!-- data-autofocus is what the dialog looks for when it opens -->
  <input
    type="text"
    data-autofocus
    bind:value={name}
    placeholder="Name"
    class="flex-grow min-w-0 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-slate-100"
  />
  {#if reason}
    <Tooltip.Root>
      <!-- Wrap in a span: a disabled button (pointer-events-none) can't be a
           hover target, so the span carries the tooltip instead. -->
      <Tooltip.Trigger>
        {#snippet asChild(props)}
          <span {...props()} class="inline-flex">{@render saveButton()}</span>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content
          class="bg-slate-800 dark:bg-slate-700 text-white text-sm px-2 py-1 rounded shadow z-[80] max-w-xs"
        >
          {reason}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  {:else}
    {@render saveButton()}
  {/if}
</form>
