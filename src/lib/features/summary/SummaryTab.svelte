<script lang="ts">
  import { useSWR } from 'sswr';
  import { page } from '$app/stores';
  import { updateParams } from '$lib/utils/params';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import EmptyState from '$lib/shared/components/EmptyState.svelte';
  import PctCell from '$lib/shared/components/PctCell.svelte';
  import BpsCell from '$lib/shared/components/BpsCell.svelte';
  import UsdCell from '$lib/shared/components/UsdCell.svelte';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';
  import type { SummaryRow } from './types';
  import type { UptimeTicker } from '$lib/shared/sla/types';

  const { slug, from, to }: { slug: string; from: string; to: string } = $props();

  let ticker = $state($page.url.searchParams.get('ticker') ?? '');
  let collapsedGroups = $state<Record<string, boolean>>({});
  let sortCol = $state<'ticker' | 'uptimePct' | 'medianBidOuterBps' | 'medianAskOuterBps' | 'medianBidTotalUsd' | 'medianAskTotalUsd'>('uptimePct');
  let sortDir = $state<'asc' | 'desc'>('desc');

  let filterUptimeMin = $state('');
  let filterUptimeMax = $state('');
  let filterBpsMin = $state('');
  let filterBpsMax = $state('');
  let filterTotalMin = $state('');
  let filterTotalMax = $state('');

  let filtersOpen = $state(false);

  const activeFilterCount = $derived(
    [filterUptimeMin, filterUptimeMax, filterBpsMin, filterBpsMax, filterTotalMin, filterTotalMax]
      .filter((v) => v !== '').length
  );

  function clearFilters() {
    filterUptimeMin = '';
    filterUptimeMax = '';
    filterBpsMin = '';
    filterBpsMax = '';
    filterTotalMin = '';
    filterTotalMax = '';
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = col === 'ticker' ? 'asc' : 'desc';
    }
  }

  function applyTicker(e: Event) {
    const val = (e.target as HTMLInputElement).value.trim().toUpperCase();
    ticker = val;
    updateParams({ ticker: val || null });
  }

  const appliedTicker = $derived(($page.url.searchParams.get('ticker') ?? '').trim().toUpperCase());
  const summaryKey = $derived(
    `/api/summary?slug=${slug}&from=${from}&to=${to}${appliedTicker ? '&ticker=' + appliedTicker : ''}`
  );

  interface SummaryPayload {
    request: { ticker: string };
    rows: SummaryRow[];
  }

  const { data, error, isLoading } = useSWR<SummaryPayload>(
    () => summaryKey,
    { refreshInterval: 60_000, dedupingInterval: 1_800_000 }
  );

  const hasMatchingPayload = $derived(Boolean($data && $data.request.ticker === appliedTicker));
  const isPending = $derived($isLoading || !hasMatchingPayload);

  // Fetch uptime data in background for SLA group information
  interface UptimePayload {
    mm: string;
    from: string;
    to: string;
    bpsLeeway: number;
    tickers: UptimeTicker[];
  }

  const activeLeeway = $derived(parseFloat($page.url.searchParams.get('leeway') ?? '0'));

  const { data: uptimeData, isLoading: uptimeLoading } = useSWR<UptimePayload>(
    () => `/api/uptime/${slug}?from=${from}&to=${to}&bpsLeeway=${activeLeeway}`,
    { refreshInterval: 60_000, dedupingInterval: 1_800_000 }
  );

  const tickerGroupMap = $derived.by(() => {
    if (!$uptimeData?.tickers) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const t of $uptimeData.tickers) {
      map.set(t.ticker, t.group);
    }
    return map;
  });

  const hasGroups = $derived(tickerGroupMap.size > 0);
  const groupEnabled = $derived(($page.url.searchParams.get('summaryGroup') ?? 'sla') === 'sla');
  const canEnableGrouping = $derived($uptimeLoading || hasGroups);
  const groupToggleDisabled = $derived(!groupEnabled && !canEnableGrouping);

  function toggleGrouping() {
    updateParams({ summaryGroup: groupEnabled ? 'none' : 'sla' });
  }

  const groupTooltip = $derived.by(() => {
    if ($uptimeLoading) return 'Loading SLA group data…';
    if (!hasGroups) return 'No SLA groups available — check the Uptime tab';
    return '';
  });

  const sorted = $derived.by(() => {
    if (!$data) return [];
    return [...$data.rows].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortCol === 'ticker') return mul * a.ticker.localeCompare(b.ticker);
      const av = (a[sortCol] as number | null) ?? -Infinity;
      const bv = (b[sortCol] as number | null) ?? -Infinity;
      return mul * (av - bv);
    });
  });

  const filteredSorted = $derived.by(() => {
    const uptimeMin = filterUptimeMin !== '' ? parseFloat(filterUptimeMin) : null;
    const uptimeMax = filterUptimeMax !== '' ? parseFloat(filterUptimeMax) : null;
    const bpsMin = filterBpsMin !== '' ? parseFloat(filterBpsMin) : null;
    const bpsMax = filterBpsMax !== '' ? parseFloat(filterBpsMax) : null;
    const totalMin = filterTotalMin !== '' ? parseFloat(filterTotalMin) * 1000 : null;
    const totalMax = filterTotalMax !== '' ? parseFloat(filterTotalMax) * 1000 : null;

    return sorted.filter((row) => {
      if (uptimeMin !== null && (row.uptimePct ?? 0) < uptimeMin) return false;
      if (uptimeMax !== null && (row.uptimePct ?? 0) > uptimeMax) return false;
      if (bpsMin !== null && (row.medianBidOuterBps ?? 0) < bpsMin && (row.medianAskOuterBps ?? 0) < bpsMin) return false;
      if (bpsMax !== null && (row.medianBidOuterBps ?? Infinity) > bpsMax && (row.medianAskOuterBps ?? Infinity) > bpsMax) return false;
      if (totalMin !== null && (row.medianBidTotalUsd ?? 0) < totalMin && (row.medianAskTotalUsd ?? 0) < totalMin) return false;
      if (totalMax !== null && (row.medianBidTotalUsd ?? Infinity) > totalMax && (row.medianAskTotalUsd ?? Infinity) > totalMax) return false;
      return true;
    });
  });

  function groupRank(group: string): number {
    const match = group.match(/group\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
  }

  interface GroupedSection {
    group: string;
    rows: SummaryRow[];
    avgUptime: number | null;
    avgBidBps: number | null;
    avgAskBps: number | null;
    totalBidUsd: number | null;
    totalAskUsd: number | null;
  }

  function toggleGroup(group: string) {
    collapsedGroups = { ...collapsedGroups, [group]: !collapsedGroups[group] };
  }

  function isGroupCollapsed(group: string): boolean {
    return Boolean(collapsedGroups[group]);
  }

  const groupedSections = $derived.by((): GroupedSection[] | null => {
    if (!groupEnabled || !hasGroups) return null;

    const map = new Map<string, SummaryRow[]>();
    for (const row of filteredSorted) {
      const group = tickerGroupMap.get(row.ticker) ?? 'Ungrouped';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(row);
    }

    const sortedGroups = [...map.keys()].sort((a, b) => {
      const rankDiff = groupRank(a) - groupRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.localeCompare(b);
    });

    function sortRows(rows: SummaryRow[]) {
      return [...rows].sort((a, b) => {
        const mul = sortDir === 'asc' ? 1 : -1;
        if (sortCol === 'ticker') return mul * a.ticker.localeCompare(b.ticker);
        const av = (a[sortCol] as number | null) ?? -Infinity;
        const bv = (b[sortCol] as number | null) ?? -Infinity;
        return mul * (av - bv);
      });
    }

    return sortedGroups.map((group) => {
      const rows = sortRows(map.get(group)!);
      const withUptime = rows.filter((r) => r.uptimePct != null);
      const withBid = rows.filter((r) => r.medianBidOuterBps != null);
      const withAsk = rows.filter((r) => r.medianAskOuterBps != null);

      return {
        group,
        rows,
        avgUptime: withUptime.length > 0
          ? withUptime.reduce((s, r) => s + r.uptimePct!, 0) / withUptime.length
          : null,
        avgBidBps: withBid.length > 0
          ? withBid.reduce((s, r) => s + r.medianBidOuterBps!, 0) / withBid.length
          : null,
        avgAskBps: withAsk.length > 0
          ? withAsk.reduce((s, r) => s + r.medianAskOuterBps!, 0) / withAsk.length
          : null,
        totalBidUsd: rows.reduce((s, r) => s + (r.medianBidTotalUsd ?? 0), 0) || null,
        totalAskUsd: rows.reduce((s, r) => s + (r.medianAskTotalUsd ?? 0), 0) || null
      };
    });
  });

  $effect(() => {
    if (!groupedSections) { collapsedGroups = {}; return; }
    const groups = groupedSections.map((s) => s.group);
    const next: Record<string, boolean> = {};
    for (const group of groups) {
      next[group] = collapsedGroups[group] ?? true;
    }
    const keys = Object.keys(next);
    const prevKeys = Object.keys(collapsedGroups);
    const sameShape = keys.length === prevKeys.length && keys.every((k) => prevKeys.includes(k));
    const sameValues = sameShape && keys.every((k) => next[k] === collapsedGroups[k]);
    if (!sameValues) collapsedGroups = next;
  });
</script>

<div class="mb-4">
  <div class="flex flex-wrap items-center gap-4">
    <label class="flex items-center gap-2 text-xs text-zinc-400">
      Ticker
      <input
        type="text"
        value={ticker}
        onchange={applyTicker}
        placeholder="all"
        class="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 uppercase focus:border-violet-500 focus:outline-none mono placeholder:normal-case placeholder:text-zinc-600"
      />
    </label>

    <span title={groupTooltip}>
      <button
        disabled={groupToggleDisabled}
        onclick={toggleGrouping}
        class="rounded px-2.5 py-1 text-xs font-medium transition-colors
          {groupToggleDisabled
            ? 'text-zinc-600 cursor-not-allowed border border-zinc-800'
            : groupEnabled
              ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700'}"
      >
        Group by SLA
      </button>
    </span>

    <button
      type="button"
      onclick={() => (filtersOpen = !filtersOpen)}
      class="flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition-colors
        {filtersOpen
          ? 'border-violet-500/30 bg-violet-500/20 text-violet-400'
          : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}"
    >
      Filters
      {#if activeFilterCount > 0}
        <span class="rounded bg-violet-500/30 px-1 py-0.5 text-[10px] text-violet-300">{activeFilterCount}</span>
      {/if}
    </button>
  </div>

  {#if filtersOpen}
    <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2">
      <!-- Uptime filter -->
      <div class="flex items-center gap-1.5 text-xs text-zinc-400">
        <span class="w-14 shrink-0">Uptime %</span>
        <input type="number" bind:value={filterUptimeMin} placeholder="min" min="0" max="100"
          class="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono placeholder:text-zinc-600" />
        <span class="text-zinc-600">–</span>
        <input type="number" bind:value={filterUptimeMax} placeholder="max" min="0" max="100"
          class="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono placeholder:text-zinc-600" />
      </div>

      <!-- BPS filter -->
      <div class="flex items-center gap-1.5 text-xs text-zinc-400">
        <span class="w-14 shrink-0">Bps outer</span>
        <input type="number" bind:value={filterBpsMin} placeholder="min" min="0"
          class="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono placeholder:text-zinc-600" />
        <span class="text-zinc-600">–</span>
        <input type="number" bind:value={filterBpsMax} placeholder="max" min="0"
          class="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono placeholder:text-zinc-600" />
      </div>

      <!-- Total USD filter -->
      <div class="flex items-center gap-1.5 text-xs text-zinc-400">
        <span class="w-14 shrink-0">Total ($k)</span>
        <input type="number" bind:value={filterTotalMin} placeholder="min" min="0"
          class="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono placeholder:text-zinc-600" />
        <span class="text-zinc-600">–</span>
        <input type="number" bind:value={filterTotalMax} placeholder="max" min="0"
          class="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono placeholder:text-zinc-600" />
      </div>

      {#if activeFilterCount > 0}
        <button type="button" onclick={clearFilters}
          class="text-xs text-zinc-500 hover:text-red-400 transition-colors">
          Clear filters
        </button>
      {/if}
    </div>
  {/if}
</div>

{#if $error && sorted.length === 0}
  <ErrorBanner message="Failed to load summary data" />
{:else if $isLoading && sorted.length === 0}
  <TableSkeleton rows={8} columns={6} />
{:else if filteredSorted.length === 0}
  <EmptyState />
{:else}
  <div class="relative">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <!-- Row 1: group labels -->
          <tr class="text-left text-xs text-zinc-500">
            <th rowspan="2" class="pb-2 pr-4 font-medium align-bottom">
              <button type="button" onclick={() => toggleSort('ticker')} class="flex items-center gap-1 hover:text-zinc-300 transition-colors">
                Ticker{#if sortCol === 'ticker'}<span class="ml-1 text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="ml-1 text-zinc-700">↕</span>{/if}
              </button>
            </th>
            <th rowspan="2" class="pb-2 pr-6 font-medium text-right align-bottom border-r border-zinc-800">
              <button type="button" onclick={() => toggleSort('uptimePct')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'uptimePct'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Uptime
              </button>
            </th>
            <th colspan="2" class="pb-1 pr-6 text-center font-semibold tracking-wide text-zinc-400 border-b border-zinc-700/60">Bid</th>
            <th colspan="2" class="pb-1 text-center font-semibold tracking-wide text-zinc-400 border-b border-zinc-700/60">Ask</th>
          </tr>
          <!-- Row 2: sortable sub-headers -->
          <tr class="border-b border-zinc-800 text-left text-xs text-zinc-500">
            <th class="pb-2 pr-4 font-medium text-right">
              <button type="button" onclick={() => toggleSort('medianBidOuterBps')} title="Median of the max bps quoted — the furthest price level at which liquidity is still posted (see Total Liq. for the size at that level)" class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'medianBidOuterBps'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Spread (bps)
              </button>
            </th>
            <th class="pb-2 pr-6 font-medium text-right border-r border-zinc-800">
              <button type="button" onclick={() => toggleSort('medianBidTotalUsd')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'medianBidTotalUsd'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Total Liq.
              </button>
            </th>
            <th class="pb-2 pr-4 font-medium text-right">
              <button type="button" onclick={() => toggleSort('medianAskOuterBps')} title="Median of the max bps quoted — the furthest price level at which liquidity is still posted (see Total Liq. for the size at that level)" class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'medianAskOuterBps'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Spread (bps)
              </button>
            </th>
            <th class="pb-2 pr-4 font-medium text-right">
              <button type="button" onclick={() => toggleSort('medianAskTotalUsd')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'medianAskTotalUsd'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Total Liq.
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {#if groupedSections}
            {#each groupedSections as section}
              <tr class="border-b border-zinc-700/60 bg-zinc-800/25">
                <td class="py-1.5 pl-2 text-xs font-semibold tracking-wide text-zinc-500">
                  <button
                    type="button"
                    onclick={() => toggleGroup(section.group)}
                    class="flex w-full items-center gap-2 text-left hover:text-zinc-300"
                  >
                    <span class="mono inline-block w-3 text-zinc-400">{isGroupCollapsed(section.group) ? '+' : '-'}</span>
                    <span>{section.group}</span>
                    <span class="text-[10px] text-zinc-600">({section.rows.length})</span>
                  </button>
                </td>
                <td class="py-1.5 pr-6 text-right border-r border-zinc-800"><PctCell value={section.avgUptime} /></td>
                <td class="py-1.5 pr-4 text-right"><BpsCell value={section.avgBidBps} /></td>
                <td class="py-1.5 pr-6 text-right border-r border-zinc-800"><UsdCell value={section.totalBidUsd} /></td>
                <td class="py-1.5 pr-4 text-right"><BpsCell value={section.avgAskBps} /></td>
                <td class="py-1.5 pr-4 text-right"><UsdCell value={section.totalAskUsd} /></td>
              </tr>
              {#if !isGroupCollapsed(section.group)}
                {#each section.rows as row}
                  <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td class="py-2 pr-4 pl-4 font-medium text-zinc-200">{row.ticker}</td>
                    <td class="py-2 pr-6 text-right border-r border-zinc-800/60"><PctCell value={row.uptimePct} /></td>
                    <td class="py-2 pr-4 text-right"><BpsCell value={row.medianBidOuterBps} /></td>
                    <td class="py-2 pr-6 text-right border-r border-zinc-800/60"><UsdCell value={row.medianBidTotalUsd} /></td>
                    <td class="py-2 pr-4 text-right"><BpsCell value={row.medianAskOuterBps} /></td>
                    <td class="py-2 pr-4 text-right"><UsdCell value={row.medianAskTotalUsd} /></td>
                  </tr>
                {/each}
              {/if}
            {/each}
          {:else}
            {#each filteredSorted as row}
              <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td class="py-2 pr-4 font-medium text-zinc-200">{row.ticker}</td>
                <td class="py-2 pr-6 text-right border-r border-zinc-800/60"><PctCell value={row.uptimePct} /></td>
                <td class="py-2 pr-4 text-right"><BpsCell value={row.medianBidOuterBps} /></td>
                <td class="py-2 pr-6 text-right border-r border-zinc-800/60"><UsdCell value={row.medianBidTotalUsd} /></td>
                <td class="py-2 pr-4 text-right"><BpsCell value={row.medianAskOuterBps} /></td>
                <td class="py-2 text-right"><UsdCell value={row.medianAskTotalUsd} /></td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    {#if isPending}
      <div class="pointer-events-none absolute inset-0 rounded bg-zinc-900/55">
        <div class="absolute right-3 top-3 rounded bg-zinc-900/90 px-2 py-1 text-xs text-violet-300">
          Refreshing...
        </div>
      </div>
    {/if}
  </div>
{/if}
