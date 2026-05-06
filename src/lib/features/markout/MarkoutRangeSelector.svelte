
<script lang="ts">
  import { updateParams } from '$lib/utils/params';

  const {
    from,
    to,
    min,
    max,
    paramFromKey = 'from',
    paramToKey = 'to',
    clearOnApply = [] as string[],
    label = 'Time duration',
    summary = `${from} to ${to}`,
    helperText = 'This calendar range updates the current view only.'
  }: {
    from: string;
    to: string;
    min: string;
    max: string;
    paramFromKey?: string;
    paramToKey?: string;
    clearOnApply?: string[];
    label?: string;
    summary?: string;
    helperText?: string;
  } = $props();

  let draftFrom = $state('');
  let draftTo = $state('');
  let isOpen = $state(false);

  $effect(() => {
    draftFrom = from.slice(0, 10);
    draftTo = to.slice(0, 10);
  });

  function applyRange() {
    if (!draftFrom || !draftTo) return;
    const nextFrom = draftFrom <= draftTo ? draftFrom : draftTo;
    const nextTo = draftTo >= draftFrom ? draftTo : draftFrom;
    const patch: Record<string, string | null> = { [paramFromKey]: nextFrom, [paramToKey]: nextTo };
    for (const key of clearOnApply) patch[key] = null;
    updateParams(patch);
    isOpen = false;
  }
</script>

<div class="relative">
  <button
    type="button"
    onclick={() => (isOpen = !isOpen)}
    class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
  >
    <span class="whitespace-nowrap">
      <span class="text-[11px] uppercase tracking-wide text-zinc-500">{label}</span>
      <span class="mx-2 text-zinc-600">·</span>
      <span>{summary}</span>
    </span>
  </button>

  {#if isOpen}
    <div class="absolute right-0 z-10 mt-2 w-[320px] rounded-xl border border-zinc-800 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur">
      <div class="flex flex-wrap items-end gap-3">
        <label class="text-xs text-zinc-400">
          From
          <input
            type="date"
            bind:value={draftFrom}
            min={min}
            max={max}
            class="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
          />
        </label>
        <label class="text-xs text-zinc-400">
          To
          <input
            type="date"
            bind:value={draftTo}
            min={min}
            max={max}
            class="mt-1 block rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
          />
        </label>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onclick={applyRange}
          class="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500"
        >
          Apply
        </button>
      </div>
      <p class="mt-2 text-[11px] text-zinc-500">{helperText}</p>
    </div>
  {/if}
</div>
