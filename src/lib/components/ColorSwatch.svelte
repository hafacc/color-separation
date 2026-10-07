<!--
@component
The circular color chip shared by every palette swatch: the Riso and custom
toggle buttons and the add-form's live preview. `selected` draws the ring;
`children` is for overlays like the KM-ineligible dot.
-->
<script lang="ts">
import type { Snippet } from "svelte";
import { type RgbU32, rgbToCss } from "#lib/utils/color.ts";

const {
  color,
  selected = false,
  children,
}: {
  color: RgbU32 | string;
  selected?: boolean;
  children?: Snippet;
} = $props();

const css = $derived(typeof color === "string" ? color : rgbToCss(color));
</script>

<span
  class="relative block w-9 h-9 rounded-full"
  style:background-color={css}
  style:box-shadow={selected
    ? `0 0 0 2px var(--palette-bg), 0 0 0 4px ${css}`
    : "inset 0 0 0 1px rgba(0,0,0,0.15)"}
>
  {@render children?.()}
</span>
