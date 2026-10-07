<script lang="ts">
import FileUploadIcon from "~icons/fa6-solid/file-arrow-up";

const { onclick, loading = false }: { onclick: () => void; loading?: boolean } =
  $props();
</script>

<button
  class="w-full px-4 py-2 bg-slate-300 hover:bg-slate-400 text-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 dark:text-white rounded disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
  disabled={loading}
  {onclick}
  type="button"
>
  <FileUploadIcon />
  {loading ? "Loading..." : "Upload"}
</button>
