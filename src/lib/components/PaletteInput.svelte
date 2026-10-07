<script lang="ts">
import { Dialog } from "@ark-ui/svelte/dialog";
import type { RgbU32 } from "#lib/utils/color.ts";
import type { CustomColor } from "#lib/utils/custom-colors.ts";
import { INKS_BY_RGB, type Ink } from "#lib/utils/inks.ts";
import type { ColorState } from "#lib/utils/types.ts";
import PlusIcon from "~icons/fa6-solid/plus";
import CustomAddForm from "./CustomAddForm.svelte";
import Swatch from "./Swatch.svelte";

// INKS_BY_RGB is module-constant, so the displayed swatch list never changes.
const INK_LIST: readonly Ink[] = [...INKS_BY_RGB.values()];

// A focused native color input means its picker is open. This is the
// deterministic "is the picker open" signal — no timing involved.
function isColorInput(el: EventTarget | null): boolean {
  return el instanceof HTMLInputElement && el.type === "color";
}

const {
  colors,
  addColor,
  removeColor,
  customs,
  saveCustom,
  deleteCustom,
}: {
  colors: Map<RgbU32, ColorState>;
  addColor: (color: RgbU32, name: string) => void;
  removeColor: (color: RgbU32) => void;
  customs: readonly CustomColor[];
  saveCustom: (color: CustomColor) => void;
  deleteCustom: (rgb: RgbU32) => void;
} = $props();

let adding = $state(false);
// Whether a color input was focused (its native picker open) at the instant
// of the last outside pointerdown. zag fires the modal's interact-outside
// deferred (raf), by which point focus has moved — so we record the fact
// synchronously here and read it in the deferred handler. No timing guesses.
let pickerOpenAtPointerDown = false;
$effect(() => {
  if (!adding) return;
  const onPointerDownCapture = () => {
    pickerOpenAtPointerDown = isColorInput(document.activeElement);
  };
  document.addEventListener("pointerdown", onPointerDownCapture, true);
  return () =>
    document.removeEventListener("pointerdown", onPointerDownCapture, true);
});

function toggleInk(rgb: RgbU32, name: string) {
  if (colors.has(rgb)) {
    removeColor(rgb);
  } else {
    addColor(rgb, name);
  }
}

const selectedCount = $derived(
  INK_LIST.reduce((count, ink) => count + (colors.has(ink.rgb) ? 1 : 0), 0),
);
</script>

<!-- Close the add modal whenever the palette dialog opens / closes so we
     don't leave it hanging over a stale state. -->
<Dialog.Root onOpenChange={() => (adding = false)}>
  <Dialog.Trigger
    type="button"
    class="w-full px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-white rounded"
  >
    Edit Palette ({selectedCount} / {INK_LIST.length})
  </Dialog.Trigger>
  <Dialog.Backdrop class="fixed inset-0 bg-black/50 z-40" />
  <Dialog.Positioner
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
  >
    <Dialog.Content
      class="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto p-6 [--palette-bg:white] dark:[--palette-bg:rgb(30_41_59)]"
    >
      <Dialog.Title class="text-xl font-bold mb-1">Palette</Dialog.Title>
      <Dialog.Description class="text-slate-600 dark:text-slate-400 mb-4">
        Click a color to add or remove it from your palette.
      </Dialog.Description>
      <h3 class="font-semibold mb-2">Riso inks</h3>
      <div
        class="grid gap-3 mb-6"
        style:grid-template-columns="repeat(auto-fill, minmax(2.75rem, 1fr))"
      >
        {#each INK_LIST as ink (ink.id)}
          <Swatch
            rgb={ink.rgb}
            selected={colors.has(ink.rgb)}
            label={ink.kmEligible
              ? ink.name
              : `${ink.name} · no K-M calibration`}
            kmEligible={ink.kmEligible}
            onToggle={() => toggleInk(ink.rgb, ink.name)}
          />
        {/each}
      </div>
      <h3 class="font-semibold mb-2">Custom colors</h3>
      <div
        class="grid gap-3"
        style:grid-template-columns="repeat(auto-fill, minmax(2.75rem, 1fr))"
      >
        {#each customs as color (color.rgb)}
          <Swatch
            rgb={color.rgb}
            selected={colors.has(color.rgb)}
            label={color.name}
            kmEligible={false}
            onToggle={() => toggleInk(color.rgb, color.name)}
            oncontextmenu={(evt) => {
              evt.preventDefault();
              deleteCustom(color.rgb);
            }}
          />
        {/each}
        <Dialog.Root
          open={adding}
          onOpenChange={(details) => (adding = details.open)}
          onInteractOutside={(event) => {
            // Keep the modal open only when this interaction is the native
            // color picker being dismissed: a pointerdown made while the
            // color input was focused, or focus leaving the color input.
            const original = event.detail.originalEvent;
            const fromPicker =
              original.type === "focusin" || original.type === "focusout"
                ? isColorInput((original as FocusEvent).relatedTarget)
                : pickerOpenAtPointerDown;
            if (fromPicker) event.preventDefault();
          }}
          lazyMount
          unmountOnExit
        >
          <Dialog.Trigger
            type="button"
            aria-label="Add custom color"
            class="w-9 h-9 rounded-full mx-auto border-2 border-dashed border-slate-400 dark:border-slate-500 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center"
          >
            <PlusIcon aria-hidden="true" />
          </Dialog.Trigger>
          <Dialog.Backdrop class="fixed inset-0 bg-black/50 z-[60]" />
          <Dialog.Positioner
            class="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <Dialog.Content
              class="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-xs p-6"
            >
              <Dialog.Title class="text-xl font-bold mb-4">
                Add Custom Color
              </Dialog.Title>
              <CustomAddForm
                {customs}
                onSave={(color) => {
                  saveCustom(color);
                  adding = false;
                }}
              />
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </div>
      <div class="flex justify-end mt-6">
        <Dialog.CloseTrigger
          type="button"
          class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white rounded"
        >
          Close
        </Dialog.CloseTrigger>
      </div>
    </Dialog.Content>
  </Dialog.Positioner>
</Dialog.Root>
