<script lang="ts">
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import MarkoutRangeSelector from '$lib/shared/components/DateRangeSelector.svelte';
  import MarkoutViewToggle from '$lib/features/markout/MarkoutViewToggle.svelte';
  import MarkoutHorizonChart from '$lib/features/markout/MarkoutHorizonChart.svelte';
  import { buildMarkoutGlobalCsv, buildMarkoutGlobalCsvFilename } from '$lib/features/markout/export.js';
  import {
    MARKOUT_HORIZONS,
    colorForSlug,
    type MarkoutView
  } from '$lib/features/markout/types';
  import { formatPct, formatUsd } from '$lib/utils/format';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const view = $derived<MarkoutView>(data.view);
  const tableFrom = $derived(data.tableFrom);
  const tableTo = $derived(data.tableTo);

  const coloredRows = $derived(
    data.initialOverview.rows.map((row) => ({
      ...row,
      color: colorForSlug(row.slug)
    }))
  );

  const horizonChartSeries = $derived(
    coloredRows.map((row) => ({
      key: row.slug,
      label: row.name,
      color: row.color,
      points: MARKOUT_HORIZONS.map((h) => ({ horizon: h, value: row.horizons[h] ?? 0 }))
    }))
  );

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

  function parseDateOnlyUtc(value: string): number {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  }

  const tableViewLabel = $derived(view === 'dydx' ? 'dYdX Mid' : 'Index Mids');
  const tableDays = $derived.by(() => {
    if (!tableFrom || !tableTo) return null;
    const start = parseDateOnlyUtc(tableFrom);
    const end = parseDateOnlyUtc(tableTo);
    return Math.floor((end - start) / 86_400_000) + 1;
  });
  const minDate = $derived(data.meta.availability[view].minDate);
  const maxDate = $derived(data.meta.availability[view].maxDate);

  const measurementRows = [
    {
      label: 'Maker fills only',
      value: 'Markout PnL excludes taker fills.'
    },
    {
      label: 'Mid checks',
      value:
        'After each fill, the dashboard looks up the mid price at each horizon and rolls the result into cumulative PnL.'
    },
    {
      label: 'Table columns',
      value:
        'Total Volume includes maker plus taker volume.'
    },
    {
      label: 'View difference',
      value:
        "dYdX Mid uses dYdX's own orderbook mid. Index Mids uses the average mid from Binance, Bybit, and OKX."
    }
  ];

  const availabilityRows = [
    {
      label: 'dYdX Mid',
      value: '5s to 300s starts on 2026-04-08'
    },
    {
      label: 'dYdX Mid',
      value: '2s and 3s start on 2026-04-24'
    },
    {
      label: 'Index Mids',
      value: 'All horizons start on 2026-04-24'
    }
  ];

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
        Compare market makers in the global table, then drill down into per-MM markout detail. The
        active view controls the table and horizon curve.
      </p>
    </div>
    <MarkoutViewToggle view={view} />
  </div>

  <details class="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/75" open={false}>
    <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden sm:px-5">
      <div>
        <div class="flex items-center gap-2">
          <div class="h-2.5 w-2.5 rounded-full bg-sky-400"></div>
          <h2 class="text-sm font-semibold text-zinc-100">How Markout Works</h2>
        </div>
        <p class="mt-1 text-sm leading-5 text-zinc-400">
          Track maker-fill markout and view-specific price references only when needed.
        </p>
      </div>
      <span class="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300">
        Expand
      </span>
    </summary>

    <div class="border-t border-zinc-800 px-4 py-4 sm:px-5">
      <div class="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
        <div class="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <h3 class="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
            How It's Measured
          </h3>
          <div class="mt-3 space-y-2.5">
            {#each measurementRows as row}
              <div class="flex flex-col gap-1 rounded-md border border-zinc-800/70 bg-zinc-950/70 px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3">
                <div class="min-w-0 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:w-28 sm:shrink-0">
                  {row.label}
                </div>
                <p class="text-sm leading-5 text-zinc-300">{row.value}</p>
              </div>
            {/each}
          </div>
        </div>

        <div class="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
          <h3 class="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-300">
            Data Availability
          </h3>
          <div class="mt-3 space-y-2.5">
            {#each availabilityRows as row}
              <div class="rounded-md border border-zinc-800/70 bg-zinc-950/70 px-3 py-2.5">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                    {row.label}
                  </div>
                  <div
                    class="rounded-full border px-2 py-0.5 text-[11px] {row.value.includes('2s and 3s') || row.value.includes('5s to 300s')
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300'}"
                  >
                    {row.value}
                  </div>
                </div>
              </div>
            {/each}
            <p class="rounded-md border border-amber-500/20 bg-amber-500/8 px-3 py-2.5 text-sm leading-5 text-amber-100/90">
              Earlier ranges return no data. The dashboard applies these start dates automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  </details>

  <section class="mt-6">
    <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-zinc-100">Global MM table — {tableViewLabel}{tableDays !== null ? ` (${tableDays} day${tableDays === 1 ? '' : 's'} data)` : ''}</h2>
        <p class="mt-1 text-sm text-zinc-500">
          Every row opens the MM detail page in the same active view.
        </p>
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

    <div class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs text-zinc-500">
            <th class="px-4 py-3">
              <button type="button" onclick={() => toggleSort('name')} class="hover:text-zinc-300">
                MM {sortIndicator('name')}
              </button>
            </th>
            <th class="px-4 py-3 text-right">
              <button type="button" onclick={() => toggleSort('fills')} class="hover:text-zinc-300">
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
  </section>

  <section class="mt-6">
    <div class="mb-3">
      <h2 class="text-lg font-semibold text-zinc-100">Markout curve by horizon</h2>
      <p class="text-sm text-zinc-500">
        Each line shows how cumulative markout evolves from 2 seconds to 5 minutes for the selected
        table range.
      </p>
    </div>
    <MarkoutHorizonChart series={horizonChartSeries} />
  </section>
</PageShell>
