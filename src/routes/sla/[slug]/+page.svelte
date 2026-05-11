<script lang="ts">
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import DateRangeSelector from '$lib/shared/components/DateRangeSelector.svelte';
  import TableSkeleton from '$lib/shared/components/skeletons/TableSkeleton.svelte';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import { formatUsd, formatPct, formatBps } from '$lib/utils/format';
  import {
    buildSlaLiquidityCsv, buildSlaLiquidityCsvFilename,
    buildSlaUptimeCsv, buildSlaUptimeCsvFilename
  } from '$lib/features/sla/export';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const from = $derived(data.from);
  const to = $derived(data.to);
  const liquidityData = $derived(data.liquidityData);
  const liquidityError = $derived(data.liquidityError);
  const uptimeData = $derived(data.uptimeData);
  const uptimeError = $derived(data.uptimeError);
  const configData = $derived(data.configData);
  const configError = $derived(data.configError);

  const showLiquiditySkeleton = $derived(liquidityData === null && !liquidityError);
  const showUptimeSkeleton = $derived(uptimeData === null && !uptimeError);

  const today = new Date().toISOString().slice(0, 10);

  // --- Config table sort ---
  type ConfigSortCol = 'groupName' | 'ticker' | 'l1Usd' | 'l1Bps' | 'l2Usd' | 'l2Bps' | 'tickBps' | 'slaMaxBps';
  let configSortCol = $state<ConfigSortCol>('groupName');
  let configSortDir = $state<'asc' | 'desc'>('asc');

  function toggleConfigSort(col: ConfigSortCol) {
    if (configSortCol === col) configSortDir = configSortDir === 'asc' ? 'desc' : 'asc';
    else { configSortCol = col; configSortDir = col === 'groupName' || col === 'ticker' ? 'asc' : 'desc'; }
  }

  const sortedConfigRows = $derived.by(() => {
    if (!configData) return [];
    return [...configData.rows].sort((a, b) => {
      const mul = configSortDir === 'asc' ? 1 : -1;
      if (configSortCol === 'groupName') return mul * a.groupName.localeCompare(b.groupName);
      if (configSortCol === 'ticker') return mul * a.ticker.localeCompare(b.ticker);
      const av = (a[configSortCol] ?? -Infinity) as number;
      const bv = (b[configSortCol] ?? -Infinity) as number;
      return mul * (av - bv);
    });
  });

  function csi(col: ConfigSortCol) {
    if (configSortCol !== col) return '↕';
    return configSortDir === 'asc' ? '↑' : '↓';
  }

  // --- Liquidity table sort ---
  type LiqSortCol = 'ticker' | 'avgLiquidityQuotedUsd' | 'slaUsd' | 'liquidityCoveredPct' | 'uptimePct' | 'makerVolumeUsd' | 'takerVolumeUsd' | 'totalVolumeUsd';
  let liqSortCol = $state<LiqSortCol>('totalVolumeUsd');
  let liqSortDir = $state<'asc' | 'desc'>('desc');

  function toggleLiqSort(col: LiqSortCol) {
    if (liqSortCol === col) liqSortDir = liqSortDir === 'asc' ? 'desc' : 'asc';
    else { liqSortCol = col; liqSortDir = col === 'ticker' ? 'asc' : 'desc'; }
  }

  const sortedLiqRows = $derived.by(() => {
    if (!liquidityData) return [];
    return [...liquidityData.rows].sort((a, b) => {
      const mul = liqSortDir === 'asc' ? 1 : -1;
      if (liqSortCol === 'ticker') return mul * a.ticker.localeCompare(b.ticker);
      const av = a[liqSortCol] ?? -Infinity;
      const bv = b[liqSortCol] ?? -Infinity;
      return mul * (av - bv);
    });
  });

  function lsi(col: LiqSortCol) {
    if (liqSortCol !== col) return '↕';
    return liqSortDir === 'asc' ? '↑' : '↓';
  }

  // --- Uptime table sort ---
  type UptimeSortCol = 'groupName' | 'ticker' | 'tickBps' | 'l1AdjBps' | 'l1Usd' | 'l1FilledAtBps' | 'l1UptimePct' | 'l2AdjBps' | 'l2Usd' | 'l2FilledAtBps' | 'l2UptimePct';
  let uptimeSortCol = $state<UptimeSortCol>('groupName');
  let uptimeSortDir = $state<'asc' | 'desc'>('asc');

  function toggleUptimeSort(col: UptimeSortCol) {
    if (uptimeSortCol === col) uptimeSortDir = uptimeSortDir === 'asc' ? 'desc' : 'asc';
    else { uptimeSortCol = col; uptimeSortDir = col === 'groupName' || col === 'ticker' ? 'asc' : 'desc'; }
  }

  const sortedUptimeRows = $derived.by(() => {
    if (!uptimeData) return [];
    return [...uptimeData.rows].sort((a, b) => {
      const mul = uptimeSortDir === 'asc' ? 1 : -1;
      if (uptimeSortCol === 'groupName') return mul * a.groupName.localeCompare(b.groupName);
      if (uptimeSortCol === 'ticker') return mul * a.ticker.localeCompare(b.ticker);
      const av = (a[uptimeSortCol] ?? -Infinity) as number;
      const bv = (b[uptimeSortCol] ?? -Infinity) as number;
      return mul * (av - bv);
    });
  });

  function usi(col: UptimeSortCol) {
    if (uptimeSortCol !== col) return '↕';
    return uptimeSortDir === 'asc' ? '↑' : '↓';
  }

  let walletsOpen = $state(false);

  const rangeDays = $derived(
    Math.round(
      (new Date(to ?? data.defaultTo).getTime() - new Date(from ?? data.defaultFrom).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );

  function triggerDownload(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadLiquidityCsv() {
    if (!liquidityData) return;
    const f = from ?? data.defaultFrom;
    const t = to ?? data.defaultTo;
    triggerDownload(
      buildSlaLiquidityCsv(liquidityData.rows, data.slug, f, t),
      buildSlaLiquidityCsvFilename(data.slug, f, t)
    );
  }

  function downloadUptimeCsv() {
    if (!uptimeData) return;
    const f = from ?? data.defaultFrom;
    const t = to ?? data.defaultTo;
    triggerDownload(
      buildSlaUptimeCsv(uptimeData.rows, data.slug, f, t),
      buildSlaUptimeCsvFilename(data.slug, f, t)
    );
  }
</script>

<PageShell>
  <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <a href="/sla" class="text-sm text-violet-300 hover:text-violet-200">← Back to MM SLA</a>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <h1 class="text-2xl font-semibold text-zinc-100">{data.displayName}</h1>
        <button
          type="button"
          onclick={() => (walletsOpen = !walletsOpen)}
          class="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
        >
          {walletsOpen ? 'Hide wallets' : 'Wallets tracked'}
        </button>
        {#if liquidityData}
          <span class="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-400">
            Avg Liquidity: <span class="text-zinc-200">{formatUsd(liquidityData.totalAvgLiquidityQuotedUsd)}</span>
          </span>
          <span class="rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1 text-[11px] text-zinc-400">
            Tickers: <span class="text-zinc-200">{liquidityData.rows.length}</span>
          </span>
        {/if}
      </div>
      {#if walletsOpen}
        <div class="mt-3 flex flex-col gap-2">
          {#each data.wallets as wallet}
            <div class="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs">
              <span class="mono text-zinc-200">{wallet.address}</span>
              <span class="ml-3 text-zinc-500">
                subaccounts: {wallet.subaccounts.join(', ')}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <DateRangeSelector
      from={from ?? data.defaultFrom}
      to={to ?? data.defaultTo}
      min={data.firstTrackingDate}
      max={today}
      label="Date range"
    />
  </div>

  <!-- Table 1: SLA Config (collapsed) -->
  <details class="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/75">
    <summary
      class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden sm:px-5"
    >
      <h2 class="text-sm font-semibold text-zinc-100">SLA Config</h2>
      <span class="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300">
        Expand
      </span>
    </summary>
    <div class="border-t border-zinc-800">
      {#if configError}
        <div class="p-4">
          <ErrorBanner message="Failed to load SLA config." />
        </div>
      {:else if !configData}
        <div class="p-4">
          <TableSkeleton rows={5} columns={8} />
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs text-zinc-500">
                <th class="px-4 py-3">
                  <button type="button" onclick={() => toggleConfigSort('groupName')} class="hover:text-zinc-300">
                    Group {csi('groupName')}
                  </button>
                </th>
                <th class="px-4 py-3">
                  <button type="button" onclick={() => toggleConfigSort('ticker')} class="hover:text-zinc-300">
                    Ticker {csi('ticker')}
                  </button>
                </th>
                <th class="px-4 py-3 text-right">
                  <button type="button" onclick={() => toggleConfigSort('l1Usd')} class="hover:text-zinc-300">
                    L1 USD {csi('l1Usd')}
                  </button>
                </th>
                <th class="px-4 py-3 text-right">
                  <button type="button" onclick={() => toggleConfigSort('l1Bps')} class="hover:text-zinc-300">
                    L1 bps {csi('l1Bps')}
                  </button>
                </th>
                <th class="px-4 py-3 text-right">
                  <button type="button" onclick={() => toggleConfigSort('l2Usd')} class="hover:text-zinc-300">
                    L2 USD {csi('l2Usd')}
                  </button>
                </th>
                <th class="px-4 py-3 text-right">
                  <button type="button" onclick={() => toggleConfigSort('l2Bps')} class="hover:text-zinc-300">
                    L2 bps {csi('l2Bps')}
                  </button>
                </th>
                <th class="px-4 py-3 text-right">
                  <button type="button" onclick={() => toggleConfigSort('tickBps')} class="hover:text-zinc-300">
                    Tick bps {csi('tickBps')}
                  </button>
                </th>
                <th class="px-4 py-3 text-right">
                  <button type="button" onclick={() => toggleConfigSort('slaMaxBps')} class="hover:text-zinc-300">
                    SLA Max bps {csi('slaMaxBps')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {#each sortedConfigRows as row}
                <tr class="border-b border-zinc-800/70 transition-colors hover:bg-zinc-800/30">
                  <td class="px-4 py-3 text-zinc-400">{row.groupName}</td>
                  <td class="px-4 py-3 font-medium text-zinc-100">{row.ticker}</td>
                  <td class="mono px-4 py-3 text-right text-zinc-300">{formatUsd(row.l1Usd)}</td>
                  <td class="mono px-4 py-3 text-right text-zinc-300">{formatBps(row.l1Bps)}</td>
                  <td class="mono px-4 py-3 text-right text-zinc-300">
                    {row.l2Usd !== null ? formatUsd(row.l2Usd) : '—'}
                  </td>
                  <td class="mono px-4 py-3 text-right text-zinc-300">
                    {row.l2Bps !== null ? formatBps(row.l2Bps) : '—'}
                  </td>
                  <td class="mono px-4 py-3 text-right text-zinc-300">{formatBps(row.tickBps)}</td>
                  <td class="mono px-4 py-3 text-right text-zinc-300">{formatBps(row.slaMaxBps)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </details>

  <!-- Table 2: Liquidity -->
  <section class="mt-6">
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="flex items-baseline gap-2 text-lg font-semibold text-zinc-100">
        Liquidity
        <span class="text-sm font-normal text-zinc-500">{rangeDays} days</span>
      </h2>
      {#if liquidityData}
        <button
          type="button"
          onclick={downloadLiquidityCsv}
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
        >
          Download CSV
        </button>
      {/if}
    </div>
    {#if liquidityError}
      <ErrorBanner message="Failed to load liquidity data." />
    {:else if showLiquiditySkeleton}
      <TableSkeleton rows={8} columns={8} />
    {:else}
      <div class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs text-zinc-500">
              <th class="px-4 py-3">
                <button type="button" onclick={() => toggleLiqSort('ticker')} class="hover:text-zinc-300">
                  Ticker {lsi('ticker')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleLiqSort('avgLiquidityQuotedUsd')} class="hover:text-zinc-300">
                    Avg Quoted USD {lsi('avgLiquidityQuotedUsd')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    Average of bid + ask USD quoted per minute across the period, across all book levels.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleLiqSort('slaUsd')} class="hover:text-zinc-300">
                    SLA USD {lsi('slaUsd')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    Contractual minimum total liquidity (bid + ask combined) this MM must post per the SLA.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleLiqSort('liquidityCoveredPct')} class="hover:text-zinc-300">
                    Depth % {lsi('liquidityCoveredPct')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    Avg Quoted USD ÷ SLA USD × 100. Can exceed 100% when the MM posts more than the required depth.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleLiqSort('uptimePct')} class="hover:text-zinc-300">
                    Uptime % {lsi('uptimePct')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    % of valid minutes where the MM had ≥ SLA/2 on both bid and ask simultaneously. Platform gap windows are excluded from the denominator.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <button type="button" onclick={() => toggleLiqSort('makerVolumeUsd')} class="hover:text-zinc-300">
                  Maker Vol {lsi('makerVolumeUsd')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <button type="button" onclick={() => toggleLiqSort('takerVolumeUsd')} class="hover:text-zinc-300">
                  Taker Vol {lsi('takerVolumeUsd')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <button type="button" onclick={() => toggleLiqSort('totalVolumeUsd')} class="hover:text-zinc-300">
                  Total Vol {lsi('totalVolumeUsd')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each sortedLiqRows as row}
              <tr class="border-b border-zinc-800/70 transition-colors hover:bg-zinc-800/30">
                <td class="px-4 py-3 font-medium text-zinc-100">{row.ticker}</td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {formatUsd(row.avgLiquidityQuotedUsd)}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">{formatUsd(row.slaUsd)}</td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {formatPct(row.liquidityCoveredPct)}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">{formatPct(row.uptimePct)}</td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {formatUsd(row.makerVolumeUsd)}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {formatUsd(row.takerVolumeUsd)}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {formatUsd(row.totalVolumeUsd)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <!-- Table 3: Uptime Detail -->
  <section class="mt-6 mb-8">
    <div class="mb-3 flex items-baseline justify-between">
      <h2 class="flex items-baseline gap-2 text-lg font-semibold text-zinc-100">
        Uptime Detail
        <span class="text-sm font-normal text-zinc-500">{rangeDays} days</span>
      </h2>
      {#if uptimeData}
        <button
          type="button"
          onclick={downloadUptimeCsv}
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
        >
          Download CSV
        </button>
      {/if}
    </div>
    {#if uptimeError}
      <ErrorBanner message="Failed to load uptime data." />
    {:else if showUptimeSkeleton}
      <TableSkeleton rows={8} columns={11} />
    {:else}
      <div class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-zinc-800 bg-zinc-950/60 text-left text-xs text-zinc-500">
              <th class="px-4 py-3">
                <button type="button" onclick={() => toggleUptimeSort('groupName')} class="hover:text-zinc-300">
                  Group {usi('groupName')}
                </button>
              </th>
              <th class="px-4 py-3">
                <button type="button" onclick={() => toggleUptimeSort('ticker')} class="hover:text-zinc-300">
                  Ticker {usi('ticker')}
                </button>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('tickBps')} class="hover:text-zinc-300">
                    Tick bps {usi('tickBps')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    Minimum price increment for this market, in basis points.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('l1AdjBps')} class="hover:text-zinc-300">
                    L1 adj bps {usi('l1AdjBps')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    SLA required spread plus one tick, in basis points — the effective spread threshold used when measuring uptime.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('l1Usd')} class="hover:text-zinc-300">
                    L1 USD {usi('l1Usd')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    Required liquidity depth in USD at the L1 spread level, as defined in the SLA.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('l1FilledAtBps')} class="hover:text-zinc-300">
                    L1 filled-at bps {usi('l1FilledAtBps')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    The bps at which the L1 USD requirement was met. At or below L1 adj bps = within SLA.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('l1UptimePct')} class="hover:text-zinc-300">
                    L1 Uptime % {usi('l1UptimePct')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    Percentage of time both bid and ask sides simultaneously met the L1 liquidity requirement. Minutes when the system was down are excluded from the calculation.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('l2AdjBps')} class="hover:text-zinc-300">
                    L2 adj bps {usi('l2AdjBps')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    SLA required spread plus one tick, in basis points — the effective spread threshold used when measuring uptime.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('l2Usd')} class="hover:text-zinc-300">
                    L2 USD {usi('l2Usd')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    Required liquidity depth in USD at the L2 spread level, as defined in the SLA.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('l2FilledAtBps')} class="hover:text-zinc-300">
                    L2 filled-at bps {usi('l2FilledAtBps')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    The bps at which the L2 USD requirement was met. At or below L2 adj bps = within SLA.
                  </span>
                </span>
              </th>
              <th class="px-4 py-3 text-right">
                <span class="group/tip relative inline-flex items-center justify-end gap-1">
                  <button type="button" onclick={() => toggleUptimeSort('l2UptimePct')} class="hover:text-zinc-300">
                    L2 Uptime % {usi('l2UptimePct')}
                  </button>
                  <span class="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
                  <span class="pointer-events-none absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-zinc-300 opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100">
                    Percentage of time both bid and ask sides simultaneously met the L2 liquidity requirement. Minutes when the system was down are excluded from the calculation.
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {#each sortedUptimeRows as row}
              <tr class="border-b border-zinc-800/70 transition-colors hover:bg-zinc-800/30">
                <td class="px-4 py-3 text-zinc-400">{row.groupName}</td>
                <td class="px-4 py-3 font-medium text-zinc-100">{row.ticker}</td>
                <td class="mono px-4 py-3 text-right text-zinc-300">{formatBps(row.tickBps)}</td>
                <td class="mono px-4 py-3 text-right text-zinc-300">{formatBps(row.l1AdjBps)}</td>
                <td class="mono px-4 py-3 text-right text-zinc-300">{formatUsd(row.l1Usd)}</td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {formatBps(row.l1FilledAtBps)}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">{formatPct(row.l1UptimePct)}</td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {row.l2AdjBps !== null ? formatBps(row.l2AdjBps) : '—'}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {row.l2Usd !== null ? formatUsd(row.l2Usd) : '—'}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {row.l2FilledAtBps !== null ? formatBps(row.l2FilledAtBps) : '—'}
                </td>
                <td class="mono px-4 py-3 text-right text-zinc-300">
                  {row.l2UptimePct !== null ? formatPct(row.l2UptimePct) : '—'}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</PageShell>
