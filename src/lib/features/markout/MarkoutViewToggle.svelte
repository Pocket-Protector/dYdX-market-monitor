<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type { MarkoutView } from './types';

  const { view }: { view: MarkoutView } = $props();

  const views: { value: MarkoutView; label: string; copy: string }[] = [
    { value: 'dydx', label: 'dYdX Mid', copy: "PnL against dYdX's internal mid." },
    { value: 'index', label: 'Index Mids', copy: 'PnL against Binance + Bybit + OKX mids.' }
  ];

  function changeView(newView: MarkoutView) {
    const params = new URLSearchParams($page.url.searchParams);
    params.set('view', newView);
    goto(`?${params.toString()}`, { replaceState: true, noScroll: true, keepFocus: true });
  }
</script>

<div class="flex flex-wrap gap-2">
  {#each views as option}
    <button
      type="button"
      onclick={() => changeView(option.value)}
      class="rounded-lg border px-3 py-2 text-left text-xs transition-colors {view === option.value
        ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'}"
    >
      <div class="font-medium">{option.label}</div>
      <div class="mt-1 text-[11px] text-zinc-500">{option.copy}</div>
    </button>
  {/each}
</div>
