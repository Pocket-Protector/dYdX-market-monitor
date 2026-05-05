<script lang="ts">
  import { useSWR } from 'sswr';
  import { page } from '$app/stores';
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import MarkoutInfoCard from '$lib/features/markout/MarkoutInfoCard.svelte';
  import MarkoutRangeSelector from '$lib/features/markout/MarkoutRangeSelector.svelte';
  import MarkoutViewToggle from '$lib/features/markout/MarkoutViewToggle.svelte';
  import MarkoutTimeSeriesChart from '$lib/features/markout/MarkoutTimeSeriesChart.svelte';
  import MarkoutHorizonChart from '$lib/features/markout/MarkoutHorizonChart.svelte';
  import { buildMarkoutGlobalCsv, buildMarkoutGlobalCsvFilename } from '$lib/features/markout/export.js';
  import {
    MARKOUT_HORIZONS,
    colorForSlug,
    isValidMarkoutHorizon,
    isValidMarkoutView,
    type MarkoutHorizon,
    type MarkoutOverviewResponse,
    type MarkoutSeriesResponse,
    type MarkoutView
  } from '$lib/features/markout/types';
  import { updateParams } from '$lib/utils/params';
  import { formatPct, formatUsd } from '$lib/utils/format';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';
  import ChartSkeleton from '$lib/shared/components/skeletons/ChartSkeleton.svelte';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  // --- URL-backed state ---
  const view = $derived<MarkoutView>(
    isValidMarkoutView($page.url.searchParams.get('view'))
      ? ($page.url.searchParams.get('view') as MarkoutView)
      : 'dydx'
  );
  const horizon = $derived<MarkoutHorizon>(
    isValidMarkoutHorizon($page.url.searchParams.get('horizon'))
      ? ($page.url.searchParams.get('horizon') as MarkoutHorizon)
      : data.meta.defaultHorizon
  );
  const tableFrom = $derived($page.url.searchParams.get('tableFrom') ?? data.tableFrom);
  const tableTo = $derived($page.url.searchParams.get('tableTo') ?? data.tableTo);

  // --- sswr ---
  const seriesKey = $derived(`/api/markout/series?view=${view}&horizon=${horizon}`);
  const { data: seriesData, isLoading: seriesLoading, error: seriesError } =
    useSWR<MarkoutSeriesResponse>(() => seriesKey, {
      refreshInterval: 300_000,
      dedupingInterval: 3_600_000
    });

  const overviewKey = $derived(`/api/markout/overview?view=${view}&from=${tableFrom}&to=${tableTo}`);
  const { data: overviewData, isLoading: overviewLoading, error: overviewError } =
    useSWR<MarkoutOverviewResponse>(() => overviewKey, {
      refreshInterval: 300_000,
      dedupingInterval: 1_800_000
    });

  // --- freshness ---
  const overviewFresh = $derived(
    Boolean(
      $overviewData &&
        $overviewData.view === view &&
        $overviewData.range.requestedFrom === tableFrom &&
        $overviewData.range.requestedTo === tableTo
    )
  );
  const showOverviewSkeleton = $derived(!overviewFresh && !$overviewError);

  // --- derived data ---
  const coloredRows = $derived(
    (overviewFresh ? $overviewData!.rows : []).map((row) => ({
      ...row,
      color: colorForSlug(row.slug)
    }))
  );

  const coloredSeries = $derived(
    ($seriesData?.series ?? []).map((s) => ({ ...s, color: colorForSlug(s.key) }))
  );

  const horizonChartSeries = $derived(
    coloredRows.map((row) => ({
      key: row.slug,
      label: row.name,
      color: row.color,
      points: MARKOUT_HORIZONS.map((h) => ({ horizon: h, value: row.horizons[h] ?? 0 }))
    }))
  );

  // --- sort ---
  type SortCol =
    | 'name'
    | 'fills'
    | 'avgOrderSize'
    | 'tickerCount'
    | 'totalVolume'
    | 'makerVolPct'
    | 'makerTakerRatio'
    | '5s';

  let sortCol = $state<SortCol>('5s');
  let sortDir = $state<'asc' | 'desc'>('desc');

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = col === 'name' ? 'asc' : 'desc';
    }
  }

  function sortValue(row: (typeof coloredRows)[number]): number | string {
    if (sortCol === 'name') return row.name;
    if (sortCol === '5s') return row.horizons['5s'] ?? -Infinity;
    if (sortCol === 'makerTakerRatio') return row.makerTakerRatio ?? -Infinity;
    return (row[sortCol] as number | null) ?? -Infinity;
  }

  const sortedRows = $derived(
    [...coloredRows].sort((a, b) => {
      const av = sortValue(a);
      const bv = sortValue(b);
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    })
  );

  function sortIndicator(col: SortCol): string {
    if (sortCol !== col) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  // --- summary cards ---
  const topRow = $derived(sortedRows[0]);
  const bestFiveSecond = $derived(
    [...coloredRows]
      .filter((r) => r.horizons['5s'] !== null)
      .sort((a, b) => (b.horizons['5s'] ?? 0) - (a.horizons['5s'] ?? 0))[0]
  );
  const detailCount = $derived(coloredRows.filter((r) => r.hasDetail).length);
  const tableViewLabel = $derived(view === 'dydx' ? 'dYdX Mid' : 'Index Mids');

  const effectiveRange = $derived(
    overviewFresh
      ? `${$overviewData!.range.effectiveFrom} – ${$overviewData!.range.effectiveTo}`
      : `${tableFrom} – ${tableTo}`
  );

  // --- info card content ---
  const introLines = [
    'All markout PnL is computed on maker fills only.',
    'For each fill, the dashboard tracks mid prices at 2s, 3s, 5s, 10s, 20s, 30s, 60s, and 300s.',
    'BUY fill PnL uses mid minus execution price; SELL fill PnL uses execution price minus mid.'
  ];

  const tableLines = [
    'dYdX Mid measures performance against dYdX v4 internal orderbook mids at fill time.',
    'Index Mids measures the same fills against the simple average of Binance, Bybit, and OKX mids.',
    'Total volume is exchange-agnostic and includes maker plus taker volume even though markout uses maker fills only.'
  ];

  // --- meta bounds for date picker ---
  const minDate = $derived(data.meta.availability[view].minDate);
  const maxDate = $derived(data.meta.availability[view].maxDate);

  // --- CSV download ---
  function downloadGlobalTableCsv() {
    const csv = buildMarkoutGlobalCsv(sortedRows, view);
    const filename = buildMarkoutGlobalCsvFilename(view);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
</script>

<PageShell>
  <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <h1 class="text-2xl font-semibold text-zinc-100">Markout PnL</h1>
      <p class="mt-1 max-w-3xl text-sm text-zinc-400">
        Compare market makers across cumulative markout, horizon curves, and per-MM drilldowns. The
        active view controls both the chart and the table.
      </p>
      {#if data.meta.lastUpdatedAt}
        <span class="mt-1 block text-xs text-zinc-500">
          Data through {data.meta.lastUpdatedAt.slice(0, 10)}
        </span>
      {/if}
    </div>
    <MarkoutViewToggle view={view} />
  </div>

  <div class="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
    <MarkoutInfoCard title="How Markout Works" lines={introLines} />
  </div>

  <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div class="text-[11px] uppercase tracking-wide text-zinc-500">View</div>
      <div class="mt-1 text-lg font-semibold text-zinc-100">
        {view === 'dydx' ? 'dYdX Mid' : 'Index Mids'}
      </div>
    </div>
    <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div class="text-[11px] uppercase tracking-wide text-zinc-500">MMs tracked</div>
      <div class="mt-1 text-lg font-semibold text-zinc-100">
        {overviewFresh ? coloredRows.length : '—'}
      </div>
    </div>
    <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div class="text-[11px] uppercase tracking-wide text-zinc-500">Best 5s markout</div>
      <div class="mt-1 text-lg font-semibold text-emerald-300">
        {bestFiveSecond
          ? `${bestFiveSecond.name} · ${formatUsd(bestFiveSecond.horizons['5s'] ?? 0)}`
          : '—'}
      </div>
    </div>
    <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div class="text-[11px] uppercase tracking-wide text-zinc-500">MMs with detail</div>
      <div class="mt-1 text-lg font-semibold text-zinc-100">
        {overviewFresh ? detailCount : '—'}
      </div>
    </div>
  </div>

  <section class="mt-6">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="text-lg font-semibold text-zinc-100">Cumulative markout to date</h2>
          <label class="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <span class="sr-only">Horizon</span>
            <span class="text-zinc-500">at</span>
            <div class="relative">
              <select
                class="appearance-none rounded-full border border-zinc-700 bg-zinc-950 px-4 py-1.5 pr-10 text-lg font-semibold text-zinc-100 outline-none transition-colors hover:border-zinc-500 focus:border-zinc-400"
                value={horizon}
                onchange={(e) =>
                  updateParams({ horizon: (e.currentTarget as HTMLSelectElement).value })}
              >
                {#each MARKOUT_HORIZONS as h}
                  <option value={h}>{h}</option>
                {/each}
              </select>
              <span
                class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 5.25 7 8.75l3.5-3.5"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </div>
          </label>
        </div>
      </div>
      {#if topRow}
        <div class="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
          Current sort leader: <span class="font-medium text-zinc-200">{topRow.name}</span>
        </div>
      {/if}
    </div>

    {#if $seriesError}
      <ErrorBanner message="Failed to load series data." />
    {:else if !$seriesData}
      <ChartSkeleton />
    {:else}
      <MarkoutTimeSeriesChart series={coloredSeries} />
    {/if}
  </section>

  <div class="mt-6">
    <MarkoutInfoCard title="Table Notes And Caveats" lines={tableLines} compact={true} />
  </div>

  <section class="mt-6">
    <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-zinc-100">Global MM table — {tableViewLabel}</h2>
        <p class="mt-1 text-sm text-zinc-500">
          Every row opens the MM detail page in the same active view.
        </p>
        {#if overviewFresh}
          <span class="text-xs text-zinc-400">{effectiveRange}</span>
        {/if}
      </div>
      <div class="flex flex-wrap items-end justify-end gap-3">
        <MarkoutRangeSelector
          from={tableFrom}
          to={tableTo}
          min={minDate}
          max={maxDate}
          paramFromKey="tableFrom"
          paramToKey="tableTo"
          label="Time duration"
          helperText="This date range updates only the Global MM table for the active view."
        />
        <button
          type="button"
          onclick={downloadGlobalTableCsv}
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
        >
          Download CSV
        </button>
      </div>
    </div>

    {#if $overviewError}
      <ErrorBanner message="Failed to load overview data." />
    {:else if showOverviewSkeleton}
      <TableSkeleton />
    {:else}
      <div class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs text-zinc-500">
              <th class="px-4 py-3">
                <button
                  type="button"
                  onclick={() => toggleSort('name')}
                  class="hover:text-zinc-300"
                >
                  MM {sortIndicator('name')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <button
                  type="button"
                  onclick={() => toggleSort('fills')}
                  class="hover:text-zinc-300"
                >
                  Fills {sortIndicator('fills')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <button
                  type="button"
                  onclick={() => toggleSort('avgOrderSize')}
                  class="hover:text-zinc-300"
                >
                  Avg Fill Size {sortIndicator('avgOrderSize')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <button
                  type="button"
                  onclick={() => toggleSort('tickerCount')}
                  class="hover:text-zinc-300"
                >
                  Tickers {sortIndicator('tickerCount')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <button
                  type="button"
                  onclick={() => toggleSort('totalVolume')}
                  class="hover:text-zinc-300"
                >
                  Total Volume {sortIndicator('totalVolume')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <button
                  type="button"
                  onclick={() => toggleSort('makerVolPct')}
                  class="hover:text-zinc-300"
                >
                  Maker Vol % {sortIndicator('makerVolPct')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <button
                  type="button"
                  onclick={() => toggleSort('makerTakerRatio')}
                  class="hover:text-zinc-300"
                >
                  Maker/Taker {sortIndicator('makerTakerRatio')}
                </button>
              </th>
              {#each MARKOUT_HORIZONS as h}
                <th class="px-4 py-3 text-right">
                  <button
                    type="button"
                    onclick={() => h === '5s' && toggleSort('5s')}
                    class="hover:text-zinc-300"
                  >
                    {h} PnL {h === '5s' ? sortIndicator('5s') : ''}
                  </button>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each sortedRows as row}
              <tr class="border-b border-zinc-800/70 transition-colors hover:bg-zinc-800/30">
                <td class="px-4 py-3">
                  {#if row.hasDetail}
                    <a
                      href={`/markoutPnL/${row.slug}?view=${view}&tableFrom=${tableFrom}&tableTo=${tableTo}`}
                      data-sveltekit-preload-data="hover"
                      class="font-medium text-violet-300 hover:text-violet-200"
                    >
                      {row.name}
                    </a>
                  {:else}
                    <span class="font-medium text-zinc-100">{row.name}</span>
                  {/if}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {row.fills !== null ? row.fills.toLocaleString() : '—'}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-100">
                  {row.avgOrderSize !== null ? formatUsd(row.avgOrderSize) : '—'}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {row.tickerCount !== null ? row.tickerCount : '—'}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-100">
                  {row.totalVolume !== null ? formatUsd(row.totalVolume) : '—'}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {row.makerVolPct !== null ? formatPct(row.makerVolPct) : '—'}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {row.makerTakerRatio !== null ? row.makerTakerRatio.toFixed(2) : '—'}
                </td>
                {#each MARKOUT_HORIZONS as h}
                  {@const val = row.horizons[h]}
                  <td
                    class="mono px-4 py-3 text-right {val === null
                      ? 'text-zinc-600'
                      : val >= 0
                        ? 'text-emerald-300'
                        : 'text-red-300'}"
                  >
                    {val !== null ? formatUsd(val) : '—'}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section class="mt-6">
    <div class="mb-3">
      <h2 class="text-lg font-semibold text-zinc-100">Markout curve by horizon</h2>
      <p class="text-sm text-zinc-500">
        Each line shows how cumulative markout evolves from 2 seconds to 5 minutes for the selected
        table range.
      </p>
    </div>
    {#if $overviewError}
      <ErrorBanner message="Failed to load overview data." />
    {:else if showOverviewSkeleton}
      <ChartSkeleton />
    {:else}
      <MarkoutHorizonChart series={horizonChartSeries} />
    {/if}
  </section>
</PageShell>
