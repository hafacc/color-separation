<script lang="ts">
import "../app.css";
import type { Snippet } from "svelte";

const { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <title>Spot Color Separation</title>
</svelte:head>

{@render children()}
