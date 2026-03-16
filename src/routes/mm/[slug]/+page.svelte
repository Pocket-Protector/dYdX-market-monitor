<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { updateParams } from '$lib/utils/params';
  import { isCurrent24hRange } from '$lib/utils/dates';
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import MmHeader from '$lib/components/mm/MmHeader.svelte';
  import TimeRangeSelector from '$lib/components/mm/TimeRangeSelector.svelte';
  import LoadingSpinner from '$lib/shared/components/LoadingSpinner.svelte';
  import SummaryTab from '$lib/features/summary/SummaryTab.svelte';
  import UptimeTab from '$lib/features/uptime/UptimeTab.svelte';
  import LiquidityTab from '$lib/features/liquidity/LiquidityTab.svelte';
  import DepthTab from '$lib/features/depth/DepthTab.svelte';
  import FillsTab from '$lib/features/fills/FillsTab.svelte';
  import TabPrefetcher from '$lib/components/mm/TabPrefetcher.svelte';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const tabs = ['summary', 'uptime', 'liquidity', 'depth', 'fills'] as const;
  type Tab = (typeof tabs)[number];

  const activeTab = $derived(($page.url.searchParams.get('tab') ?? 'summary') as Tab);
  const bps = $derived.by(() => {
    const raw = parseFloat($page.url.searchParams.get('bps') ?? '50');
    return Number.isFinite(raw) && raw > 0 ? raw : 50;
  });
  const usd = $derived.by(() => {
    const raw = parseInt($page.url.searchParams.get('usd') ?? '100000', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 100000;
  });
  const isSupportedRange = $derived(isCurrent24hRange(data.from, data.to));

  function setTab(tab: Tab) {
    updateParams({ tab });
  }

</script>

<PageShell>
  <MmHeader address={data.mm.address} from={data.from} to={data.to} />

  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <nav class="flex gap-1">
      {#each tabs as tab}
        <button
          onclick={() => setTab(tab)}
          class="rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors {activeTab ===
          tab
            ? 'bg-violet-500/20 text-violet-400'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
        >
          {tab}
        </button>
      {/each}
    </nav>
    <TimeRangeSelector from={data.from} to={data.to} />
  </div>

  <div class="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
    {#if !browser}
      <LoadingSpinner />
    {:else if !isSupportedRange}
      <div class="rounded border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-300">
        <div class="font-medium text-amber-200">Coming soon</div>
        <p class="mt-1">
          Only the current 24h range is enabled for MM Performance right now. 7d, 30d, and custom date selection are temporarily disabled.
        </p>
      </div>
    {:else if activeTab === 'fills'}
      <FillsTab
        slug={data.mm.slug}
        address={data.mm.address}
        subaccounts={data.mm.subaccounts}
        from={data.from}
        to={data.to}
      />
    {:else if activeTab === 'summary'}
      <SummaryTab slug={data.mm.slug} from={data.from} to={data.to} />
    {:else if activeTab === 'uptime'}
      <UptimeTab slug={data.mm.slug} from={data.from} to={data.to} bpsLeeway={data.bpsLeeway} />
    {:else if activeTab === 'liquidity'}
      <LiquidityTab slug={data.mm.slug} from={data.from} to={data.to} {bps} />
    {:else if activeTab === 'depth'}
      <DepthTab slug={data.mm.slug} from={data.from} to={data.to} {usd} />
    {/if}
  </div>

  {#if browser}
    <TabPrefetcher
      slug={data.mm.slug}
      address={data.mm.address}
      subaccounts={data.mm.subaccounts}
      from={data.from}
      to={data.to}
      bpsLeeway={data.bpsLeeway}
      {bps}
      {usd}
      {activeTab}
    />
  {/if}
</PageShell>
