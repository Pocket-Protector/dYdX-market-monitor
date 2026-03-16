<script lang="ts">
  import { useSWR } from 'sswr';
  import { page } from '$app/stores';
  import { updateParams } from '$lib/utils/params';
  import { hasFreshFillsCache } from './db';
  import { loadFillsData } from './client';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import EmptyState from '$lib/shared/components/EmptyState.svelte';
  import UsdCell from '$lib/shared/components/UsdCell.svelte';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';
  import FillsChart from './FillsChart.svelte';
  import type { FillsApiResponse, FillTickerRow } from './types';
  import type { UptimeTicker } from '$lib/shared/sla/types';

  const { slug, address, subaccounts, from, to }: {
    slug: string;
    address: string;
    subaccounts: number[];
    from: string;
    to: string;
  } = $props();

  // Keep fills aligned with the page-wide calendar-day range.

  // Cache-aware SWR fetcher for the current page range.
  const fillsKey = $derived(`/api/fills?slug=${slug}&from=${from}&to=${to}`);

  // Real-time streaming progress (updated as pages arrive from the indexer)
  let fetchProgress = $state({ phase: 'idle' as 'idle' | 'streaming' | 'done', pages: 0, fills: 0 });

  async function fillsFetcher(key: string): Promise<FillsApiResponse> {
    return loadFillsData(key, {
      address,
      subaccounts,
      onProgress: (next) => {
        if (key === fillsKey) fetchProgress = next;
      }
    });
  }

  const { data, error, isLoading } = useSWR<FillsApiResponse>(
    () => fillsKey,
    { fetcher: fillsFetcher, refreshInterval: 60_000, dedupingInterval: 5 * 60_000 }
  );

  // ── Cache hint: check IndexedDB speculatively so we can show the right loader
  type CacheHint = 'checking' | 'cached' | 'fetching';
  let cacheHint = $state<CacheHint>('checking');

  $effect(() => {
    const key = fillsKey; // capture for async closure
    cacheHint = 'checking';
    fetchProgress = { phase: 'idle', pages: 0, fills: 0 };
    hasFreshFillsCache(key).then((exactHit) => {
      if (fillsKey !== key) return;
      cacheHint = exactHit ? 'cached' : 'fetching';
    });
  });

  // ── Fresh-data guards ────────────────────────────────────────────────────────
  const dataIsFresh = $derived(
    Boolean($data && $data.from === from && $data.to === to)
  );
  const showSkeleton = $derived(!dataIsFresh && !$error);
  const showRefreshOverlay = $derived(dataIsFresh && $isLoading);

  // ── SLA group data (uses global from/to) ────────────────────────────────────
  interface UptimePayload {
    mm: string;
    from: string;
    to: string;
    bpsLeeway: number;
    tickers: UptimeTicker[];
  }

  const { data: uptimeData, isLoading: uptimeLoading } = useSWR<UptimePayload>(
    () => `/api/uptime/${slug}?from=${from}&to=${to}&bpsLeeway=0`,
    { refreshInterval: 0, dedupingInterval: 1_800_000 }
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
  const groupEnabled = $derived(($page.url.searchParams.get('fillsGroup') ?? 'sla') === 'sla');
  const canEnableGrouping = $derived($uptimeLoading || hasGroups);
  const groupToggleDisabled = $derived(!groupEnabled && !canEnableGrouping);

  function toggleGrouping() {
    updateParams({ fillsGroup: groupEnabled ? 'none' : 'sla' });
  }

  // ── Table filters & sorting ─────────────────────────────────────────────────
  let tickerFilter = $state('');
  let showFees = $state(false);
  type SortCol = 'ticker' | 'makerVolume' | 'takerVolume' | 'totalVolume' | 'makerFees' | 'takerFees' | 'netFees' | 'totalFillCount';
  let sortCol = $state<SortCol>('totalVolume');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let collapsedGroups = $state<Record<string, boolean>>({});

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = col === 'ticker' ? 'asc' : 'desc';
    }
  }

  // ── Chart controls ──────────────────────────────────────────────────────────
  let chartMetric = $state<'volume' | 'fees' | 'count'>('volume');
  let chartBreakdown = $state<'total' | 'maker' | 'taker'>('total');

  // ── Derived rows ────────────────────────────────────────────────────────────
  const filteredRows = $derived.by(() => {
    if (!dataIsFresh || !$data) return [];
    const filter = tickerFilter.trim().toUpperCase();
    return $data.byTicker.filter((r) => !filter || r.ticker.includes(filter));
  });

  const sortedRows = $derived.by(() => {
    return [...filteredRows].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortCol === 'ticker') return mul * a.ticker.localeCompare(b.ticker);
      return mul * ((a[sortCol] as number) - (b[sortCol] as number));
    });
  });

  function groupRank(group: string): number {
    const match = group.match(/group\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
  }

  interface GroupedSection {
    group: string;
    rows: FillTickerRow[];
    totalVolume: number;
    makerVolume: number;
    takerVolume: number;
    netFees: number;
    totalFillCount: number;
  }

  function toggleGroup(group: string) {
    collapsedGroups = { ...collapsedGroups, [group]: !collapsedGroups[group] };
  }

  function isGroupCollapsed(group: string): boolean {
    return collapsedGroups[group] ?? true;
  }

  const groupedSections = $derived.by((): GroupedSection[] | null => {
    if (!groupEnabled || !hasGroups) return null;

    const map = new Map<string, FillTickerRow[]>();
    for (const row of sortedRows) {
      const group = tickerGroupMap.get(row.ticker) ?? 'Ungrouped';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(row);
    }

    const sortedGroups = [...map.keys()].sort((a, b) => {
      const rankDiff = groupRank(a) - groupRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.localeCompare(b);
    });

    return sortedGroups.map((group) => {
      const rows = map.get(group)!;
      return {
        group,
        rows,
        totalVolume: rows.reduce((s, r) => s + r.totalVolume, 0),
        makerVolume: rows.reduce((s, r) => s + r.makerVolume, 0),
        takerVolume: rows.reduce((s, r) => s + r.takerVolume, 0),
        netFees: rows.reduce((s, r) => s + r.netFees, 0),
        totalFillCount: rows.reduce((s, r) => s + r.totalFillCount, 0)
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

  // ── Summary card formatting ─────────────────────────────────────────────────
  function fmtVol(n: number): string {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }

  function fmtFee(n: number): string {
    const sign = n < 0 ? '-' : '+';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(2)}`;
  }
</script>

<!-- ── Controls ──────────────────────────────────────────────────────────── -->
<div class="mb-4 space-y-3">
  <div class="flex flex-wrap items-center gap-3">
    <label class="flex items-center gap-2 text-xs text-zinc-400">
      Ticker
      <input
        type="text"
        bind:value={tickerFilter}
        placeholder="all"
        class="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs uppercase text-zinc-200 focus:border-violet-500 focus:outline-none mono placeholder:normal-case placeholder:text-zinc-600"
      />
    </label>

    <span title={groupToggleDisabled ? ($uptimeLoading ? 'Loading SLA group data…' : 'No SLA groups available — check the Uptime tab') : ''}>
      <button
        disabled={groupToggleDisabled}
        onclick={toggleGrouping}
        class="rounded px-2.5 py-1 text-xs font-medium transition-colors
          {groupToggleDisabled
            ? 'cursor-not-allowed border border-zinc-800 text-zinc-600'
            : groupEnabled
              ? 'border border-violet-500/30 bg-violet-500/20 text-violet-400'
              : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}"
      >
        Group by SLA
      </button>
    </span>

    <button
      onclick={() => (showFees = !showFees)}
      class="rounded px-2.5 py-1 text-xs font-medium transition-colors
        {showFees
          ? 'border border-violet-500/30 bg-violet-500/20 text-violet-400'
          : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}"
    >
      View fees
    </button>
  </div>
</div>

<!-- ── Summary cards ─────────────────────────────────────────────────────── -->
{#if dataIsFresh && $data}
  <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="rounded border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <div class="text-[10px] uppercase tracking-wide text-zinc-500">Total Volume</div>
      <div class="mt-0.5 text-base font-semibold text-zinc-100 mono">{fmtVol($data.summary.totalVolume)}</div>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <div class="text-[10px] uppercase tracking-wide text-zinc-500">Maker Volume</div>
      <div class="mt-0.5 text-base font-semibold text-emerald-400 mono">{fmtVol($data.summary.makerVolume)}</div>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <div class="text-[10px] uppercase tracking-wide text-zinc-500">Taker Volume</div>
      <div class="mt-0.5 text-base font-semibold text-red-400 mono">{fmtVol($data.summary.takerVolume)}</div>
    </div>
    <div class="rounded border border-zinc-800 bg-zinc-800/30 px-3 py-2">
      <div class="text-[10px] uppercase tracking-wide text-zinc-500">Net Fees</div>
      <div class="mt-0.5 text-base font-semibold text-violet-400 mono">
        {fmtFee($data.summary.netFees)}
      </div>
    </div>
  </div>
{/if}

<!-- ── Cap warning ───────────────────────────────────────────────────────── -->
{#if dataIsFresh && $data?.isCapped}
  <div class="mb-4 rounded border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs text-amber-300">
    Results are capped at 10,000 fills per subaccount (20 pages × 500). Totals may be incomplete for large ranges.
  </div>
{/if}

<!-- ── Table ─────────────────────────────────────────────────────────────── -->
{#if $error && !dataIsFresh}
  <ErrorBanner message="Failed to load fills data" />
{:else if showSkeleton}
  <!-- Streaming progress -->
  <div class="mb-4 rounded border border-zinc-800 bg-zinc-900/60 px-4 py-3">
    <div class="mb-2 flex items-center justify-between text-xs">
      {#if cacheHint === 'cached'}
        <span class="text-violet-300">Loading from cache…</span>
        <span class="text-zinc-600">instant</span>
      {:else if fetchProgress.phase === 'streaming'}
        <span class="text-zinc-300">Fetching from indexer</span>
        <span class="mono text-zinc-400">{fetchProgress.fills.toLocaleString()} fills · page {fetchProgress.pages}</span>
      {:else}
        <span class="text-zinc-500">Connecting to indexer…</span>
        <span class="mono text-zinc-600">{from} to {to}</span>
      {/if}
    </div>
    <div class="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        class="h-full rounded-full bg-violet-500 transition-all duration-300"
        style="width: {cacheHint === 'cached' ? 100 : fetchProgress.phase === 'streaming' ? Math.max(5, Math.min(95, fetchProgress.pages * 6)) : 2}%"
      ></div>
    </div>
    {#if fetchProgress.phase === 'streaming'}
      <p class="mt-1.5 text-[10px] text-zinc-600">
        Streaming from dYdX indexer in parallel across subaccounts
      </p>
    {/if}
  </div>
  <TableSkeleton rows={8} columns={showFees ? 8 : 5} />
{:else if sortedRows.length === 0}
  <EmptyState message="No fills found for this range." />
{:else}
  <div class="relative mb-6">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-zinc-800 text-left text-xs text-zinc-500">
            <th class="pb-2 pr-4 font-medium">
              <button type="button" onclick={() => toggleSort('ticker')} class="flex items-center gap-1 hover:text-zinc-300 transition-colors">
                Ticker{#if sortCol === 'ticker'}<span class="ml-1 text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="ml-1 text-zinc-700">↕</span>{/if}
              </button>
            </th>
            <th class="pb-2 pr-4 text-right font-medium">
              <button type="button" onclick={() => toggleSort('makerVolume')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'makerVolume'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Maker Vol
              </button>
            </th>
            <th class="pb-2 pr-4 text-right font-medium">
              <button type="button" onclick={() => toggleSort('takerVolume')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'takerVolume'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Taker Vol
              </button>
            </th>
            <th class="pb-2 pr-4 text-right font-medium border-r border-zinc-800">
              <button type="button" onclick={() => toggleSort('totalVolume')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'totalVolume'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Total Vol
              </button>
            </th>
            {#if showFees}
              <th class="pb-2 pr-4 text-right font-medium">
                <button type="button" onclick={() => toggleSort('makerFees')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                  {#if sortCol === 'makerFees'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Maker Fees
                </button>
              </th>
              <th class="pb-2 pr-4 text-right font-medium">
                <button type="button" onclick={() => toggleSort('takerFees')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                  {#if sortCol === 'takerFees'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Taker Fees
                </button>
              </th>
              <th class="pb-2 pr-4 text-right font-medium border-r border-zinc-800">
                <button type="button" onclick={() => toggleSort('netFees')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                  {#if sortCol === 'netFees'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}Net Fees
                </button>
              </th>
            {/if}
            <th class="pb-2 pr-4 text-right font-medium">
              <button type="button" onclick={() => toggleSort('totalFillCount')} class="flex w-full items-center justify-end gap-1 hover:text-zinc-300 transition-colors">
                {#if sortCol === 'totalFillCount'}<span class="text-violet-400">{sortDir === 'asc' ? '↑' : '↓'}</span>{:else}<span class="text-zinc-700">↕</span>{/if}#Fills
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
                <td class="py-1.5 pr-4 text-right"><UsdCell value={section.makerVolume} /></td>
                <td class="py-1.5 pr-4 text-right"><UsdCell value={section.takerVolume} /></td>
                <td class="py-1.5 pr-4 text-right border-r border-zinc-800"><UsdCell value={section.totalVolume} /></td>
                {#if showFees}
                  <td class="py-1.5 pr-4 text-right text-zinc-500">—</td>
                  <td class="py-1.5 pr-4 text-right text-zinc-500">—</td>
                  <td class="py-1.5 pr-4 text-right border-r border-zinc-800"><UsdCell value={section.netFees} /></td>
                {/if}
                <td class="py-1.5 pr-4 text-right mono text-zinc-300">{section.totalFillCount.toLocaleString()}</td>
              </tr>
              {#if !isGroupCollapsed(section.group)}
                {#each section.rows as row}
                  <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td class="py-2 pl-4 pr-4 font-medium text-zinc-200">{row.ticker}</td>
                    <td class="py-2 pr-4 text-right text-emerald-400/80 mono text-xs"><UsdCell value={row.makerVolume} /></td>
                    <td class="py-2 pr-4 text-right text-red-400/80 mono text-xs"><UsdCell value={row.takerVolume} /></td>
                    <td class="py-2 pr-4 text-right border-r border-zinc-800/60"><UsdCell value={row.totalVolume} /></td>
                    {#if showFees}
                      <td class="py-2 pr-4 text-right mono text-xs text-violet-400">
                        {fmtFee(row.makerFees)}
                      </td>
                      <td class="py-2 pr-4 text-right mono text-xs text-violet-400">
                        {fmtFee(row.takerFees)}
                      </td>
                      <td class="py-2 pr-4 text-right border-r border-zinc-800/60 mono text-xs text-violet-400">
                        {fmtFee(row.netFees)}
                      </td>
                    {/if}
                    <td class="py-2 pr-4 text-right mono text-xs text-zinc-400">{row.totalFillCount.toLocaleString()}</td>
                  </tr>
                {/each}
              {/if}
            {/each}
          {:else}
            {#each sortedRows as row}
              <tr class="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td class="py-2 pr-4 font-medium text-zinc-200">{row.ticker}</td>
                <td class="py-2 pr-4 text-right text-emerald-400/80 mono text-xs"><UsdCell value={row.makerVolume} /></td>
                <td class="py-2 pr-4 text-right text-red-400/80 mono text-xs"><UsdCell value={row.takerVolume} /></td>
                <td class="py-2 pr-4 text-right border-r border-zinc-800/60"><UsdCell value={row.totalVolume} /></td>
                {#if showFees}
                  <td class="py-2 pr-4 text-right mono text-xs text-violet-400">
                    {fmtFee(row.makerFees)}
                  </td>
                  <td class="py-2 pr-4 text-right mono text-xs text-violet-400">
                    {fmtFee(row.takerFees)}
                  </td>
                  <td class="py-2 pr-4 text-right border-r border-zinc-800/60 mono text-xs text-violet-400">
                    {fmtFee(row.netFees)}
                  </td>
                {/if}
                <td class="py-2 pr-4 text-right mono text-xs text-zinc-400">{row.totalFillCount.toLocaleString()}</td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    {#if showRefreshOverlay}
      <div class="pointer-events-none absolute inset-0 rounded bg-zinc-900/40">
        <div class="absolute right-3 top-3 rounded bg-zinc-900/90 px-2 py-1 text-xs text-violet-300">
          Refreshing...
        </div>
      </div>
    {/if}
  </div>

  <!-- ── Chart ──────────────────────────────────────────────────────────── -->
  {#if dataIsFresh && $data && $data.timeSeries.length > 0}
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-1">
          <span class="text-xs text-zinc-500">Metric:</span>
          {#each (['volume', 'fees', 'count'] as const) as m}
            <button
              onclick={() => (chartMetric = m)}
              class="rounded px-2 py-1 text-xs transition-colors capitalize {chartMetric === m
                ? 'bg-violet-500/20 text-violet-400'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
            >
              {m === 'count' ? 'Fill Count' : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          {/each}
        </div>
        {#if chartMetric === 'volume'}
          <div class="flex items-center gap-1">
            {#each (['total', 'maker', 'taker'] as const) as b}
              <button
                onclick={() => (chartBreakdown = b)}
                class="rounded px-2 py-1 text-xs capitalize transition-colors {chartBreakdown === b
                  ? 'bg-violet-500/20 text-violet-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
              >
                {b}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <FillsChart data={$data.timeSeries} metric={chartMetric} breakdown={chartBreakdown} />
    </div>
  {/if}
{/if}
