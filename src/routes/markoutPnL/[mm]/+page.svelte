<script lang="ts">
  import { page } from '$app/stores';
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import MarkoutViewToggle from '$lib/features/markout/MarkoutViewToggle.svelte';
  import MarkoutRangeSelector from '$lib/features/markout/MarkoutRangeSelector.svelte';
  import MarkoutHorizonChart from '$lib/features/markout/MarkoutHorizonChart.svelte';
  import {
    MARKOUT_HORIZONS,
    COLORS,
    colorForSlug,
    isValidMarkoutView,
    type MarkoutHorizon,
    type MarkoutView
  } from '$lib/features/markout/types';
  import { buildMarkoutTickerCsv, buildMarkoutTickerCsvFilename } from '$lib/features/markout/export.js';
  import { formatPct, formatUsd } from '$lib/utils/format';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';
  import ChartSkeleton from '$lib/shared/components/skeletons/ChartSkeleton.svelte';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  function parseDateOnlyUtc(value: string): number {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  }

  // URL-backed state for immediate UI response (toggle highlight, range label).
  const view = $derived<MarkoutView>(
    isValidMarkoutView($page.url.searchParams.get('view'))
      ? ($page.url.searchParams.get('view') as MarkoutView)
      : 'dydx'
  );
  const from = $derived($page.url.searchParams.get('from') ?? data.from);
  const to = $derived($page.url.searchParams.get('to') ?? data.to);

  // data.mmData / data.mmError come from the +page.ts client load which
  // SvelteKit re-runs whenever the URL params change.
  const mmData = $derived(data.mmData);
  const mmError = $derived(data.mmError);

  const showSkeleton = $derived(mmData === null && !mmError);
  const is404 = $derived(mmError === '404');

  const mmName = $derived(mmData ? mmData.mm.name : data.slug);
  const hasDetailRows = $derived(mmData !== null && mmData.detailRows.length > 0);

  const horizonChartSeries = $derived.by(() => {
    if (!mmData) return [];
    if (mmData.detailRows.length > 0) {
      return mmData.detailRows.map((row, i) => ({
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
        key: mmData.mm.slug,
        label: mmData.mm.name,
        color: colorForSlug(mmData.mm.slug),
        points: MARKOUT_HORIZONS.map((h) => ({
          horizon: h as MarkoutHorizon,
          value: mmData.summaryRow.horizons[h] ?? 0
        }))
      }
    ];
  });

  // Capture table range on first mount for the back-link.
  // After the range selector clears tableFrom/tableTo from the URL, data.tableFrom
  // becomes null — but the back-link should still return to the original global range.
  const initialTableFrom = data.tableFrom;
  const initialTableTo = data.tableTo;

  const backHref = $derived.by(() => {
    const params = new URLSearchParams({ view });
    if (initialTableFrom) params.set('tableFrom', initialTableFrom);
    if (initialTableTo) params.set('tableTo', initialTableTo);
    return `/markoutPnL?${params.toString()}`;
  });

  const minDate = $derived(data.meta.availability[view].minDate);
  const maxDate = $derived(data.meta.availability[view].maxDate);

  const effectiveRange = $derived(
    mmData
      ? `${mmData.range.effectiveFrom} – ${mmData.range.effectiveTo}`
      : `${from} – ${to}`
  );

  const daysTracked = $derived.by(() => {
    if (!mmData) return null;
    const start = parseDateOnlyUtc(mmData.range.effectiveFrom);
    const end = parseDateOnlyUtc(mmData.range.effectiveTo);
    return Math.floor((end - start) / 86_400_000) + 1;
  });

  function downloadTickerTableCsv() {
    if (!mmData || mmData.detailRows.length === 0) return;
    const csv = buildMarkoutTickerCsv(mmData.detailRows, view, mmData.mm.name);
    const filename = buildMarkoutTickerCsvFilename(mmData.mm.slug, view);
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
        clearOnApply={['tableFrom', 'tableTo']}
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
          {mmData?.summaryRow.fills !== null && mmData?.summaryRow.fills !== undefined
            ? mmData.summaryRow.fills.toLocaleString()
            : '—'}
        </div>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Total volume</div>
        <div class="mt-1 text-lg font-semibold text-zinc-100">
          {mmData?.summaryRow.totalVolume !== null && mmData?.summaryRow.totalVolume !== undefined
            ? formatUsd(mmData.summaryRow.totalVolume)
            : '—'}
        </div>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Maker vol %</div>
        <div class="mt-1 text-lg font-semibold text-zinc-100">
          {mmData?.summaryRow.makerVolPct !== null && mmData?.summaryRow.makerVolPct !== undefined
            ? formatPct(mmData.summaryRow.makerVolPct)
            : '—'}
        </div>
      </div>
      <div class="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div class="text-[11px] uppercase tracking-wide text-zinc-500">Date range</div>
        <div class="mt-1 text-lg font-semibold text-zinc-100">
          {daysTracked !== null ? `${daysTracked} day${daysTracked === 1 ? '' : 's'}` : '—'}
        </div>
      </div>
    </div>

    {#if mmData && mmData.summaryRow.fills === null}
      <div class="mt-6 rounded-xl border border-zinc-700 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
        No data available for this MM in the selected range.
      </div>
    {:else}
      <section class="mt-6">
        <div class="mb-3">
          <h2 class="text-lg font-semibold text-zinc-100">
            {hasDetailRows ? 'Ticker markout curve by horizon' : 'MM markout curve by horizon'}
          </h2>
          <p class="text-sm text-zinc-500">
            {hasDetailRows ? 'Each line is a ticker for this MM.' : 'MM-level markout across all horizons.'}
          </p>
        </div>
        {#if mmError && !is404}
          <ErrorBanner message="Failed to load MM data." />
        {:else if showSkeleton}
          <ChartSkeleton />
        {:else}
          <MarkoutHorizonChart series={horizonChartSeries} />
        {/if}
      </section>

      <section class="mt-6">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-zinc-100">Ticker table</h2>
            <p class="text-sm text-zinc-500">
              {hasDetailRows
                ? 'Columns mirror the markout horizons on the global page.'
                : 'Ticker-level rows are not available for this MM in the selected range.'}
            </p>
          </div>
          {#if hasDetailRows}
            <button
              type="button"
              onclick={downloadTickerTableCsv}
              class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
            >
              Download CSV
            </button>
          {/if}
        </div>

        {#if mmError && !is404}
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
                {#each mmData!.detailRows as row}
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
