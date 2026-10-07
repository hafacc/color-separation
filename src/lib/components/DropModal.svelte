<script lang="ts">
const { show }: { show: boolean } = $props();
</script>

<div
  class="w-screen h-screen fixed backdrop-blur-sm z-10 flex flex-col items-center justify-center {show
    ? 'block'
    : 'hidden'}"
>
  <div
    class="w-96 p-4 space-y-2 rounded-md shadow-md dark:shadow-slate-800/50 bg-white dark:bg-slate-900"
  >
    <h1 class="font-bold text-lg">Drag & Drop an SVG to Upload</h1>
    <p class="text-slate-600 dark:text-slate-400">
      Drop a compatible SVG anywhere to begin separating its colors.
    </p>
  </div>
</div>
