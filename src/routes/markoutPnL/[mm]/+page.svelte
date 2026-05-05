<script lang="ts">
  import { useSWR } from 'sswr';
  import { page } from '$app/stores';
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import MarkoutInfoCard from '$lib/features/markout/MarkoutInfoCard.svelte';
  import MarkoutViewToggle from '$lib/features/markout/MarkoutViewToggle.svelte';
  import MarkoutRangeSelector from '$lib/features/markout/MarkoutRangeSelector.svelte';
  import MarkoutHorizonChart from '$lib/features/markout/MarkoutHorizonChart.svelte';
  import {
    MARKOUT_HORIZONS,
    COLORS,
    colorForSlug,
    isValidMarkoutView,
    type MarkoutHorizon,
    type MarkoutMmResponse,
    type MarkoutView
  } from '$lib/features/markout/types';
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
  const from = $derived($page.url.searchParams.get('from') ?? data.from);
  const to = $derived($page.url.searchParams.get('to') ?? data.to);

  // --- sswr ---
  const mmKey = $derived(
    `/api/markout/mm/${data.slug}?view=${view}&from=${from}&to=${to}`
  );
  const { data: mmData, isLoading, error: mmError } = useSWR<MarkoutMmResponse>(
    () => mmKey,
    { refreshInterval: 300_000, dedupingInterval: 1_800_000 }
  );

  const dataIsFresh = $derived(
    Boolean(
      $mmData &&
        $mmData.mm.slug === data.slug &&
        $mmData.range.requestedFrom === from &&
        $mmData.range.requestedTo === to
    )
  );
  const showSkeleton = $derived(!dataIsFresh && !$mmError);
  const is404 = $derived(Boolean($mmError && $mmError.message?.includes('404')));

  // --- derived ---
  const mmName = $derived(dataIsFresh ? $mmData!.mm.name : data.slug);
  const hasDetailRows = $derived(dataIsFresh && $mmData!.detailRows.length > 0);

  const horizonChartSeries = $derived.by(() => {
    if (!dataIsFresh) return [];
    const d = $mmData!;
    if (d.detailRows.length > 0) {
      return d.detailRows.map((row, i) => ({
        key: row.ticker,
        label: row.ticker,
        color: COLORS[i % COLORS.length],
        points: MARKOUT_HORIZONS.map((h) => ({
          horizon: h as MarkoutHorizon,
          value: row.horizons[h] ?? 0
        }))
      }));
    }
    return [
      {
        key: d.mm.slug,
        label: d.mm.name,
        color: colorForSlug(d.mm.slug),
        points: MARKOUT_HORIZONS.map((h) => ({
          horizon: h as MarkoutHorizon,
          value: d.summaryRow.horizons[h] ?? 0
        }))
      }
    ];
  });

  // --- info card ---
  const detailCopy = $derived.by(() => {
    if (hasDetailRows) {
      return [
        `Showing ${view === 'dydx' ? 'dYdX Mid' : 'Index Mids'} markout for ${mmName}.`,
        'The ticker table and horizon chart break down markout by individual trading pair.',
        'All rows use the same maker-only markout methodology as the global page.'
      ];
    }
    return [
      `Ticker-level breakdown is not available for ${mmName} in the selected range.`,
      'The horizon curve below shows MM-level markout across all horizons.',
      'The active view is still respected, so dYdX Mid and Index Mids can be compared.'
    ];
  });

  // --- back-link ---
  const backHref = $derived.by(() => {
    const params = new URLSearchParams({ view });
    if (data.tableFrom) params.set('tableFrom', data.tableFrom);
    if (data.tableTo) params.set('tableTo', data.tableTo);
    return `/markoutPnL?${params.toString()}`;
  });

  const minDate = $derived(data.meta.availability[view].minDate);
  const maxDate = $derived(data.meta.availability[view].maxDate);

  const effectiveRange = $derived(
    dataIsFresh
      ? `${$mmData!.range.effectiveFrom} – ${$mmData!.range.effectiveTo}`
      : `${from} – ${to}`
  );
</script>

<PageShell>
  <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <a href={backHref} class="text-sm text-violet-300 hover:text-violet-200">
        ← Back to Markout PnL
      </a>
      <h1 class="mt-3 text-2xl font-semibold text-zinc-100">{mmName}</h1>
      <p class="mt-1 text-sm text-zinc-400">
        MM-specific markout detail in the active reference-price view.
      </p>
    </div>
    <div class="flex flex-col items-end gap-3">
      <MarkoutViewToggle view={view} />
      <MarkoutRangeSelector
        from={from}
        to={to}
        min={minDate}
        max={maxDate}
        paramFromKey="from"
        paramToKey="to"
        label="Date range"
        helperText="This date range updates only this MM's data."
      />
    </div>
  </div>

  {#if is404}
    <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-300">
      MM not found: <span class="font-medium">{data.slug}</span>
    </div>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Total fills</div>
        <div class="mt-1 text-lg font-semibold text-zinc-100">
          {dataIsFresh && $mmData!.summaryRow.fills !== null
            ? $mmData!.summaryRow.fills.toLocaleString()
            : '—'}
        </div>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Avg fill size</div>
        <div class="mt-1 text-lg font-semibold text-zinc-100">
          {dataIsFresh && $mmData!.summaryRow.avgOrderSize !== null
            ? formatUsd($mmData!.summaryRow.avgOrderSize)
            : '—'}
        </div>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Maker vol %</div>
        <div class="mt-1 text-lg font-semibold text-zinc-100">
          {dataIsFresh && $mmData!.summaryRow.makerVolPct !== null
            ? formatPct($mmData!.summaryRow.makerVolPct)
            : '—'}
        </div>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">5s PnL</div>
        <div
          class="mt-1 text-lg font-semibold {!dataIsFresh || $mmData!.summaryRow.horizons['5s'] === null
            ? 'text-zinc-500'
            : ($mmData!.summaryRow.horizons['5s'] ?? 0) >= 0
              ? 'text-emerald-300'
              : 'text-red-300'}"
        >
          {dataIsFresh && $mmData!.summaryRow.horizons['5s'] !== null
            ? formatUsd($mmData!.summaryRow.horizons['5s']!)
            : '—'}
        </div>
      </div>
    </div>

    {#if dataIsFresh && $mmData!.summaryRow.fills === null}
      <div class="mt-6 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
        No data available for this MM in the selected range.
      </div>
    {:else}
      <div class="mt-6">
        <MarkoutInfoCard title="MM Detail Context" lines={detailCopy} compact={true} />
      </div>

      <section class="mt-6">
        <div class="mb-3">
          <h2 class="text-lg font-semibold text-zinc-100">
            {hasDetailRows ? 'Ticker markout curve by horizon' : 'MM markout curve by horizon'}
          </h2>
          <p class="text-sm text-zinc-500">
            {hasDetailRows ? 'Each line is a ticker for this MM.' : 'MM-level markout across all horizons.'}
          </p>
          {#if dataIsFresh}
            <span class="text-xs text-zinc-400">{effectiveRange}</span>
          {/if}
        </div>
        {#if $mmError && !is404}
          <ErrorBanner message="Failed to load MM data." />
        {:else if showSkeleton}
          <ChartSkeleton />
        {:else}
          <MarkoutHorizonChart series={horizonChartSeries} />
        {/if}
      </section>

      <section class="mt-6">
        <div class="mb-3">
          <h2 class="text-lg font-semibold text-zinc-100">Ticker table</h2>
          <p class="text-sm text-zinc-500">
            {hasDetailRows
              ? 'Columns mirror the markout horizons on the global page.'
              : 'Ticker-level rows are not available for this MM in the selected range.'}
          </p>
        </div>

        {#if $mmError && !is404}
          <ErrorBanner message="Failed to load MM data." />
        {:else if showSkeleton}
          <TableSkeleton />
        {:else if !hasDetailRows}
          <div class="rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-500">
            No ticker-level data available for this MM in the selected range.
          </div>
        {:else}
          <div class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
            <table class="min-w-full text-sm">
              <thead>
                <tr
                  class="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs text-zinc-500"
                >
                  <th class="px-4 py-3">Ticker</th>
                  <th class="px-4 py-3 text-right">Fills</th>
                  <th class="px-4 py-3 text-right">Avg Fill Size</th>
                  {#each MARKOUT_HORIZONS as h}
                    <th class="px-4 py-3 text-right">{h} PnL</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each $mmData!.detailRows as row}
                  <tr class="border-b border-zinc-800/70 transition-colors hover:bg-zinc-800/30">
                    <td class="px-4 py-3 font-medium text-zinc-100">{row.ticker}</td>
                    <td class="mono px-4 py-3 text-right text-zinc-300">
                      {row.fills !== null ? row.fills.toLocaleString() : '—'}
                    </td>
                    <td class="mono px-4 py-3 text-right text-zinc-100">
                      {row.avgOrderSize !== null ? formatUsd(row.avgOrderSize) : '—'}
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
    {/if}
  {/if}
</PageShell>
