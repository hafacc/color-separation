<script lang="ts">
import { Tooltip } from "@ark-ui/svelte/tooltip";
import GithubIcon from "~icons/fa6-brands/github";
import InfoIcon from "~icons/fa6-solid/circle-info";

const {
  helpDisabled,
  toggleHelp,
}: { helpDisabled: boolean; toggleHelp: () => void } = $props();
</script>

<div class="flex justify-center space-x-2 flex-shrink-0">
  <Tooltip.Root>
    <Tooltip.Trigger
      class="p-2 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none"
      aria-label="show help information"
      disabled={helpDisabled}
      onclick={toggleHelp}
      type="button"
    >
      <InfoIcon />
    </Tooltip.Trigger>
    <Tooltip.Positioner>
      <Tooltip.Content
        class="bg-slate-800 dark:bg-slate-700 text-white text-sm px-2 py-1 rounded shadow"
      >
        show help
      </Tooltip.Content>
    </Tooltip.Positioner>
  </Tooltip.Root>
  <a
    class="block p-2 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
    aria-label="view source on github"
    href="https://github.com/hafacc/color-separation"
    target="_blank"
    rel="noreferrer"
  >
    <GithubIcon />
  </a>
</div>
