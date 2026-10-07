<script module lang="ts">
import { FileUpload, useFileUpload } from "@ark-ui/svelte/file-upload";
import { createToaster, Toaster } from "@ark-ui/svelte/toast";
import fileSaver from "file-saver";
import { extension } from "mime-types";
import { onMount } from "svelte";
import DropModal from "#lib/components/DropModal.svelte";
import Editor from "#lib/components/Editor.svelte";
import Footer from "#lib/components/Footer.svelte";
import HelpText from "#lib/components/HelpText.svelte";
import Logo from "#lib/components/Logo.svelte";
import UploadButton from "#lib/components/UploadButton.svelte";
import { luminance, type RgbU32 } from "#lib/utils/color.ts";
import { blob2url, resizeBlob, url2blob } from "#lib/utils/conversion.ts";
import {
  type CustomColor,
  loadCustoms,
  saveCustoms,
} from "#lib/utils/custom-colors.ts";
import { INKS_BY_ID, INKS_BY_RGB, RISO_DEFAULTS } from "#lib/utils/inks.ts";
import { LruMap } from "#lib/utils/lru.ts";
import type { MixingMode } from "#lib/utils/sep.ts";
import {
  type GridCell,
  genGrid,
  genPreviewAndSeparation,
  genSeparation,
} from "#lib/utils/separate.ts";
import type { Action, ColorState, Ordering } from "#lib/utils/types.ts";

const toaster = createToaster({
  placement: "top-end",
  duration: 6000,
});

interface Parsed {
  raw: File;
  preview: string;
}

function orderActive(
  colors: Map<RgbU32, ColorState>,
  ordering: Ordering,
): [RgbU32, ColorState][] {
  const actives = [...colors].filter(([, s]) => s.active);
  if (ordering === "manual") {
    actives.sort(([, a], [, b]) => a.order - b.order);
  } else {
    // light-to-dark; auto picks an order in the worker after racing, so the
    // baseline pool we send out uses this same sort.
    actives.sort(([a], [b]) => luminance(b) - luminance(a));
  }
  return actives;
}

// The reducer reuses ColorState references for entries it doesn't touch, so
// shallow tuple-equality is enough to detect "active subset unchanged" after
// an unrelated palette add / remove.
function sameActive(
  a: readonly [RgbU32, ColorState][],
  b: readonly [RgbU32, ColorState][],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}

// Ephemeral, in-memory only (never localStorage); cleared on every upload.
// Each entry is preview + grid data URLs at viewport resolution; posterized
// separations compress well, so ~1-2 MB/entry typical (grid-dominated). 64
// keeps the cache near ~100 MB worst-case — fine for a desktop tool, and a
// miss only costs a recompute.
const RENDER_CACHE_MAX = 64;

// A couple of ΔE00 buys a big drop in ink layers for nearly-invisible drift.
const DEFAULT_TOLERANCE = 2;

/**
 * Only press simulation makes an overprint care which ink went down first, and
 * subtractive never simulates a press.
 */
function isOrderIndependent(mixingMode: MixingMode, press: boolean): boolean {
  return mixingMode === "subtractive" || (mixingMode === "multiply" && !press);
}

interface RenderCacheEntry {
  readonly preview: string;
  readonly grid: string;
  readonly cell: GridCell;
  readonly autoChosen: readonly RgbU32[] | undefined;
}

// Captures everything the render output depends on; mirrors the render
// effect's dependency set (the image is constant per cache lifetime).
function renderKey(
  orderedActive: readonly [RgbU32, ColorState][],
  mixingMode: MixingMode,
  ordering: Ordering,
  increments: number,
  tolerance: number,
  press: boolean,
): string {
  const pool = orderedActive
    .map(([rgb, state]) => `${rgb}:${state.remap ?? ""}`)
    .join(",");
  return `${mixingMode}|${ordering}|${increments}|${tolerance}|${press}|${pool}`;
}
function reduceColors(
  existingColors: Map<RgbU32, ColorState>,
  action: Action,
): Map<RgbU32, ColorState> {
  if (action.action === "add") {
    const copy = new Map(existingColors);
    copy.set(action.color, {
      name: action.name,
      active: false,
      remap: undefined,
      order: 0,
    });
    return copy;
  } else if (action.action === "remove") {
    const copy = new Map(existingColors);
    copy.delete(action.color);
    return copy;
  } else if (action.action === "toggle") {
    const copy = new Map(existingColors);
    const state = copy.get(action.color)!;
    const nextActive = !state.active;
    // activating assigns the next print position; deactivating keeps the
    // prior order so re-activation pushes the color to the back
    const order = nextActive
      ? Math.max(0, ...[...existingColors.values()].map((s) => s.order)) + 1
      : state.order;
    copy.set(action.color, {
      ...state,
      active: nextActive,
      remap: undefined,
      order,
    });
    return copy;
  } else if (action.action === "remap") {
    const copy = new Map(existingColors);
    const state = copy.get(action.color)!;
    const remap = action.remap === action.color ? undefined : action.remap;
    copy.set(action.color, { ...state, remap });
    return copy;
  } else {
    return new Map(
      [...existingColors].map(([color, state]) => [
        color,
        { ...state, active: false, remap: undefined },
      ]),
    );
  }
}
</script>

<script lang="ts">
  let showRaw = $state(false);
  let showGrid = $state(false);
  let showHelp = $state(false);
  let rendering = $state(false);
  let renderProgress = $state(0);
  let isDownloading = $state(false);
  let downloadProgress = $state(0);
  let imgBox: HTMLDivElement | undefined = $state();
  const renderCache = new LruMap<string, RenderCacheEntry>(RENDER_CACHE_MAX);

  // Starts empty so the prerendered markup matches; the palette dialog is
  // closed by default, so nobody sees the list fill in.
  let customs = $state.raw<readonly CustomColor[]>([]);
  onMount(() => {
    customs = loadCustoms();
  });

  let parsed = $state.raw<Parsed | undefined | null>();
  let ordering = $state<Ordering>("light-to-dark");
  let mixingMode = $state<MixingMode>("subtractive");
  // Replaced wholesale on every change, never mutated: the checks below
  // compare entries by reference.
  let colors = $state.raw(
    new Map<RgbU32, ColorState>(
      RISO_DEFAULTS.map((id) => {
        const ink = INKS_BY_ID.get(id)!;
        return [
          ink.rgb,
          { name: ink.name, active: false, remap: undefined, order: 0 },
        ];
      }),
    ),
  );

  let preview = $state<string | undefined>();
  let grid = $state<string | undefined>();
  let cell = $state.raw<GridCell | undefined>();
  let increments = $state(0);
  let tolerance = $state(DEFAULT_TOLERANCE);
  // On by default: without it midtones come out roughly 10 ΔE00 too light.
  let press = $state(true);
  // The most recent worker-chosen print order, used to drive badge numbers
  // and filename indices under `auto` ordering. Stays in sync with whichever
  // render last completed; reset whenever the baseline pool changes.
  let autoChosen = $state.raw<readonly RgbU32[] | undefined>();

  // Handing back the previous array when nothing active changed keeps an
  // unrelated palette edit from starting a new render.
  let previousOrdered: [RgbU32, ColorState][] | undefined;
  const orderedActive = $derived.by(() => {
    const next = orderActive(colors, ordering);
    if (previousOrdered && sameActive(previousOrdered, next)) {
      return previousOrdered;
    } else {
      previousOrdered = next;
      return next;
    }
  });
  // Active colors that can't be rendered in KM mode — either a known ink
  // whose calibration failed, or a custom color with no spectral data.
  const kmIneligibleNames = $derived(
    orderedActive
      .filter(([rgb]) => !(INKS_BY_RGB.get(rgb)?.kmEligible ?? false))
      .map(([, state]) => state.name),
  );
  const kmAvailable = $derived(kmIneligibleNames.length === 0);
  function modifyColors(action: Action) {
    colors = reduceColors(colors, action);
    // If the user has KM selected and activates an incompatible ink, fall back
    // to multiply so we don't keep rendering with a mode the worker can't
    // honor. A toast informs the user.
    if (mixingMode === "kubelka_munk" && !kmAvailable) {
      mixingMode = "multiply";
      toaster.create({
        title: `Switched to Multiply: no Kubelka-Munk calibration for ${kmIneligibleNames.join(", ")}`,
        type: "error",
      });
    }
  }
  // Display order = auto-chosen if it covers the current active set, else
  // the baseline ordering. Active rendering always sends the baseline pool
  // to the worker; the worker either keeps it (non-auto) or reorders
  // internally and reports back via chosenOrder.
  const displayOrdered = $derived.by(() => {
    if (ordering !== "auto" || !autoChosen) return orderedActive;
    const baseline = new Map(orderedActive);
    if (
      autoChosen.length !== baseline.size ||
      autoChosen.some((rgb) => !baseline.has(rgb))
    ) {
      return orderedActive;
    }
    return autoChosen.map(
      (rgb) => [rgb, baseline.get(rgb)!] as [RgbU32, ColorState],
    );
  });
  const positions = $derived(
    new Map<RgbU32, number>(
      displayOrdered.map(([color], index) => [color, index + 1]),
    ),
  );

  function clearRender() {
    preview = undefined;
    grid = undefined;
    cell = undefined;
  }

  $effect(() => {
    const source = parsed;
    const pool = orderedActive.map(([color]) => color);
    if (!source || !pool.length) {
      clearRender();
      rendering = false;
      return;
    }
    const renderPool = orderedActive.map(
      ([color, state]) => state.remap ?? color,
    );
    // Read here, before the first await, so the effect reruns on them.
    const mode = mixingMode;
    const steps = increments;
    const shift = tolerance;
    const simulatePress = press;
    const key = renderKey(
      orderedActive,
      mode,
      ordering,
      steps,
      shift,
      simulatePress,
    );
    const cached = renderCache.get(key);
    if (cached) {
      preview = cached.preview;
      grid = cached.grid;
      cell = cached.cell;
      autoChosen = cached.autoChosen;
      rendering = false;
      return;
    }
    // Every permutation ties under an order-independent model, so the search
    // can only hand back the fallback order it started from.
    const autoOrder =
      ordering === "auto" && !isOrderIndependent(mode, simulatePress);
    let cancelled = false;
    // Skip sub-1% deltas so the bar isn't redrawn on every per-color worker
    // progress message.
    let lastReported = -1;
    const reportProgress = (frac: number) => {
      if (cancelled) return;
      if (frac < 1 && frac - lastReported < 0.01) return;
      lastReported = frac;
      renderProgress = frac;
    };
    rendering = true;
    renderProgress = 0;
    void (async () => {
      try {
        const blob = await url2blob(source.preview);
        const {
          preview: previewBlob,
          separations,
          chosenOrder,
        } = await genPreviewAndSeparation(
          blob,
          pool,
          renderPool,
          mode,
          autoOrder,
          steps,
          shift,
          simulatePress,
          reportProgress,
        );
        // separations come back in chosen order; tint with the corresponding
        // (potentially-remapped) render colors.
        const tintColors = chosenOrder.map((idx) => renderPool[idx]);
        const { blob: gridBlob, cell: gridCell } = await genGrid(
          previewBlob,
          separations,
          tintColors,
        );
        const [previewUrl, gridUrl] = await Promise.all([
          blob2url(previewBlob),
          blob2url(gridBlob),
        ]);
        const entry: RenderCacheEntry = {
          preview: previewUrl,
          grid: gridUrl,
          cell: gridCell,
          autoChosen: autoOrder
            ? chosenOrder.map((idx) => pool[idx])
            : undefined,
        };
        // Cache even when cancelled: the worker ran to completion regardless,
        // so banking the result lets the user return to this config instantly.
        renderCache.set(key, entry);
        if (!cancelled) {
          preview = entry.preview;
          grid = entry.grid;
          cell = entry.cell;
          autoChosen = entry.autoChosen;
        }
      } catch (ex) {
        console.error(ex);
        if (!cancelled) {
          clearRender();
          toaster.create({
            title: "Couldn't separate image",
            type: "error",
          });
        }
      } finally {
        if (!cancelled) {
          rendering = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  async function download() {
    if (!parsed) return;
    try {
      isDownloading = true;
      const fileName = parsed.raw.name;
      const baseName = fileName.slice(0, fileName.lastIndexOf(".")) || fileName;
      const pool = displayOrdered.map(([color]) => color);
      const names = displayOrdered.map(([, state]) => state.name);

      downloadProgress = 0;
      let lastReported = -1;
      const reportProgress = (frac: number) => {
        if (frac < 1 && frac - lastReported < 0.01) return;
        lastReported = frac;
        downloadProgress = frac;
      };
      const { separations, chosenOrder } = await genSeparation(
        parsed.raw,
        pool,
        mixingMode,
        false,
        increments,
        tolerance,
        press,
        true,
        reportProgress,
      );
      // Filenames follow the chosen print order so the prefix matches the
      // numbered badge in the UI.
      for (let printIdx = 0; printIdx < chosenOrder.length; printIdx++) {
        const poolIdx = chosenOrder[printIdx];
        const blob = separations[printIdx];
        const ext = extension(blob.type);
        const name = names[poolIdx];
        fileSaver.saveAs(
          blob,
          `${baseName}_${printIdx + 1}_${name.replaceAll(" ", "_")}.${ext}`,
        );
      }
    } catch (ex) {
      console.error(ex);
      toaster.create({
        title: "Couldn't separate image",
        type: "error",
      });
    } finally {
      isDownloading = false;
    }
  }

  function saveCustom(color: CustomColor) {
    // The add form already rejects colors that collide with a Riso ink or an
    // existing custom, so the rgb is guaranteed new here.
    customs = [...customs, color];
    saveCustoms(customs);
    modifyColors({ action: "add", color: color.rgb, name: color.name });
  }
  function deleteCustom(rgb: RgbU32) {
    customs = customs.filter((color) => color.rgb !== rgb);
    saveCustoms(customs);
    if (colors.has(rgb)) modifyColors({ action: "remove", color: rgb });
  }

  async function onUpload(file: File) {
    try {
      parsed = null;
      showHelp = false;
      modifyColors({ action: "clear" });
      renderCache.clear();

      const { clientWidth, clientHeight } = imgBox!;
      const blob = await resizeBlob(file, clientWidth, clientHeight);
      parsed = { raw: file, preview: await blob2url(blob) };
    } catch (ex) {
      console.error(ex);
      toaster.create({
        title: "Couldn't load file",
        type: "error",
      });
      parsed = undefined;
    }
  }

  const fileUpload = useFileUpload({
    accept: ["image/svg+xml", "image/png", "image/jpeg", "image/webp"],
    maxFiles: 1,
    // Held empty so choosing the same file twice in a row still counts as a
    // change.
    acceptedFiles: [],
    onFileAccept: ({ files }) => {
      const [file] = files;
      if (file) void onUpload(file);
    },
    onFileReject: ({ files }) => {
      if (files.length) {
        toaster.create({
          title: "Dropped file was not an SVG, PNG, JPEG, or WebP",
          type: "error",
        });
        fileUpload().clearRejectedFiles();
      }
    },
  });

  // Holding shows the uploaded image; with the channels up that swaps only the
  // lead cell, so the channels stay put to compare against.
  const lead = $derived(
    showRaw ? parsed?.preview : (preview ?? parsed?.preview),
  );
</script>

<FileUpload.RootProvider value={fileUpload} class="contents">
  <FileUpload.Dropzone
    disableClick
    role="none"
    class="h-screen w-screen flex flex-row overflow-hidden"
  >
    <FileUpload.HiddenInput />
    <DropModal show={fileUpload().dragging} />
    <div
      class="w-72 h-full min-h-0 p-2 flex flex-col flex-shrink-0 gap-2 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700"
    >
      <div class="flex flex-col gap-2 flex-shrink-0">
        <h1 class="flex items-center justify-center gap-2 font-bold text-xl">
          <Logo size={26} class="flex-shrink-0" />
          Spot Color Separator
        </h1>
        <UploadButton
          onclick={() => fileUpload().openFilePicker()}
          loading={parsed === null}
        />
      </div>
      {#if parsed && !showHelp}
        <Editor
          {colors}
          {modifyColors}
          {customs}
          {saveCustom}
          {deleteCustom}
          {positions}
          bind:ordering
          bind:mixingMode
          {kmAvailable}
          {kmIneligibleNames}
          bind:increments
          bind:tolerance
          bind:press
          orderIndependent={isOrderIndependent(mixingMode, press)}
          {download}
          {isDownloading}
          bind:showRaw
          bind:showGrid
          {rendering}
        />
      {:else}
        <HelpText closeable={!!parsed} />
      {/if}
      <Footer
        helpDisabled={!parsed}
        toggleHelp={() => (showHelp = !showHelp)}
      />
    </div>
    <div class="h-full w-full overflow-hidden relative" bind:this={imgBox}>
      <!-- One shared coordinate system for the tiling and the cell drawn into
           it, so the browser fits both at once and nothing here measures
           anything. -->
      {#if showGrid && grid && cell}
        <svg
          viewBox="0 0 {cell.width} {cell.height}"
          preserveAspectRatio="xMidYMid meet"
          class="h-full w-full select-none"
          role="img"
          aria-label="rendered separation"
        >
          <image href={grid} width={cell.width} height={cell.height} />
          {#if lead}
            <image
              href={lead}
              width={cell.cellWidth}
              height={cell.cellHeight}
              preserveAspectRatio="xMidYMid meet"
            />
          {/if}
        </svg>
      {:else if lead}
        <img
          src={lead}
          alt="rendered separation"
          class="h-full w-full object-contain select-none"
          draggable="false"
        />
      {/if}
      {#if rendering || isDownloading}
        <div
          class="absolute top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 pointer-events-none overflow-hidden"
        >
          <div
            class="progress-sweep absolute inset-y-0 left-0 w-1/5 bg-slate-400/60 dark:bg-slate-400/40"
          ></div>
          <div
            class="relative h-full bg-slate-400 dark:bg-slate-500 transition-all duration-100"
            style:width="{(isDownloading ? downloadProgress : renderProgress) *
              100}%"
          ></div>
        </div>
      {/if}
    </div>
  </FileUpload.Dropzone>
</FileUpload.RootProvider>
<Toaster {toaster}>
  {#snippet children(toast)}
    <div
      class="bg-red-100 text-red-900 border border-red-300 dark:bg-red-900 dark:text-red-100 dark:border-red-700 px-4 py-3 rounded shadow-lg"
    >
      <p class="font-medium">{toast().title}</p>
    </div>
  {/snippet}
</Toaster>
