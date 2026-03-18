<script lang="ts">
  import { browser } from '$app/environment';
  import { useSWR } from 'sswr';
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import LoadingSpinner from '$lib/shared/components/LoadingSpinner.svelte';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import TreemapView from '$lib/components/markets/TreemapView.svelte';
  import { shortTicker } from '$lib/utils/format';

  interface MarketRow {
    clobPairId: string;
    ticker: string;
    status: string;
    marketType: string;
    oraclePrice: number;
    volume24h: number;
    openInterestNotional: number;
    trades24h: number;
    nextFundingRate: number | null;
    tickSize: string;
    tickSpreadBps: number | null;
    priceChange24H: number;
    maxLeverage: number | null;
    stepSize: string;
  }

  type SortKey = keyof MarketRow;

  let view = $state<'table' | 'treemap'>('table');
  let search = $state('');
  let statusFilter = $state('ACTIVE');
  let marketTypeFilter = $state('all');
  let sortKey = $state<SortKey>('volume24h');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let fundingTimeframe = $state<'ann' | '8h' | '1h'>('ann');
  let stepSizeView = $state<'native' | 'usd'>('native');

  const { data, error, isLoading } = useSWR<MarketRow[]>(() => '/api/markets', {
    refreshInterval: 15_000
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      sortKey = key;
      sortDir = 'desc';
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' ▾' : ' ▴';
  }

  const filtered = $derived.by(() => {
    if (!$data) return [];
    let rows = [...$data];

    if (statusFilter !== 'all') {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (marketTypeFilter !== 'all') {
      rows = rows.filter((r) => r.marketType === marketTypeFilter);
    }
    if (search) {
      const q = search.toUpperCase();
      rows = rows.filter((r) =>
        r.ticker.toUpperCase().includes(q) || shortTicker(r.ticker).toUpperCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      // Special case: stepSize is a numeric string — sort numerically
      if (sortKey === 'stepSize') {
        const af = parseFloat(a.stepSize) || 0;
        const bf = parseFloat(b.stepSize) || 0;
        const av2 = stepSizeView === 'usd' ? af * a.oraclePrice : af;
        const bv2 = stepSizeView === 'usd' ? bf * b.oraclePrice : bf;
        return sortDir === 'asc' ? av2 - bv2 : bv2 - av2;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const diff = (av as number) - (bv as number);
      return sortDir === 'asc' ? diff : -diff;
    });

    return rows;
  });

  function fmtPrice(val: number): string {
    if (val === 0) return '—';
    if (val >= 1000) return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (val >= 1) return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (val >= 0.01) return val.toFixed(4);
    if (val >= 0.0001) return val.toFixed(6);
    const s = val.toExponential(3);
    return s;
  }

  function fmtVol(val: number): string {
    if (val === 0) return '—';
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  }

  function fmtFunding(rate: number | null): string {
    if (rate == null) return '—';
    const multiplier = fundingTimeframe === 'ann' ? 876000 : fundingTimeframe === '8h' ? 800 : 100;
    return `${(rate * multiplier).toFixed(4)}%`;
  }

  function fundingClass(val: number | null): string {
    if (val == null) return 'text-zinc-500';
    if (val > 0) return 'text-emerald-400';
    if (val < 0) return 'text-red-400';
    return 'text-zinc-400';
  }

  function fmtSpread(val: number | null): string {
    if (val == null) return '—';
    return val.toFixed(2);
  }

  function fmtStepSize(row: MarketRow): string {
    if (!row.stepSize) return '—';
    if (stepSizeView === 'native') {
      const base = shortTicker(row.ticker).split('-')[0];
      return `${row.stepSize} ${base}`;
    }
    const usd = parseFloat(row.stepSize) * row.oraclePrice;
    if (usd === 0) return '—';
    if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
    if (usd >= 1_000) return `$${(usd / 1_000).toFixed(2)}K`;
    return `$${usd.toFixed(2)}`;
  }

  function fmtLeverage(val: number | null): string {
    if (val == null) return '—';
    return `${val}x`;
  }

  function statusBadge(s: string): string {
    if (s === 'ACTIVE') return 'bg-emerald-400/15 text-emerald-400';
    if (s === 'FINAL_SETTLEMENT') return 'bg-red-400/15 text-red-400';
    return 'bg-zinc-700/40 text-zinc-400';
  }

  function typeBadge(t: string): string {
    if (t === 'CROSS') return 'bg-violet-500/15 text-violet-400';
    return 'bg-sky-400/15 text-sky-400';
  }

  const fundingLabel = $derived(
    fundingTimeframe === 'ann' ? 'Funding (Ann.)' :
    fundingTimeframe === '8h'  ? 'Funding (8hr)'  : 'Funding (1hr)'
  );
  const stepSizeLabel = $derived(
    stepSizeView === 'native' ? 'Min Order (native)' : 'Min Order (USD)'
  );

  const columns = $derived([
    { key: 'ticker' as SortKey,               label: 'Ticker',            align: 'left' as const  },
    { key: 'status' as SortKey,               label: 'Status',            align: 'left' as const  },
    { key: 'marketType' as SortKey,           label: 'Type',              align: 'left' as const  },
    { key: 'oraclePrice' as SortKey,          label: 'Oracle Price',      align: 'right' as const },
    { key: 'volume24h' as SortKey,            label: 'Volume 24H',        align: 'right' as const },
    { key: 'openInterestNotional' as SortKey, label: 'Open Interest',     align: 'right' as const },
    { key: 'trades24h' as SortKey,            label: 'Trades 24H',        align: 'right' as const },
    { key: 'nextFundingRate' as SortKey,      label: fundingLabel,        align: 'right' as const },
    { key: 'tickSpreadBps' as SortKey,        label: 'Tick Spread (bps)', align: 'right' as const },
    { key: 'maxLeverage' as SortKey,          label: 'Max Leverage',      align: 'right' as const },
    { key: 'stepSize' as SortKey,             label: stepSizeLabel,       align: 'right' as const },
  ]);
</script>

<PageShell>
  <div class="mb-6">
    <h1 class="text-2xl font-semibold text-zinc-100">Live Metrics</h1>
    <p class="mt-1 text-sm text-zinc-400">
      Real-time dYdX v4 perpetual markets — auto-refreshes every 15s
    </p>
  </div>

  <div class="mb-4 flex flex-wrap items-center gap-3">
    <div class="flex overflow-hidden rounded border border-zinc-700">
      <button
        class="px-3 py-1.5 text-xs font-medium transition-colors
          {view === 'table' ? 'bg-violet-500/20 text-violet-400' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}"
        onclick={() => (view = 'table')}
      >
        Table
      </button>
      <button
        class="px-3 py-1.5 text-xs font-medium transition-colors border-l border-zinc-700
          {view === 'treemap' ? 'bg-violet-500/20 text-violet-400' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}"
        onclick={() => (view = 'treemap')}
      >
        Treemap
      </button>
    </div>

    <input
      type="text"
      bind:value={search}
      placeholder="Search ticker…"
      class="w-48 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 uppercase focus:border-violet-500 focus:outline-none mono placeholder:normal-case placeholder:text-zinc-600"
    />

    <select
      bind:value={statusFilter}
      class="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
    >
      <option value="all">All statuses</option>
      <option value="ACTIVE">Active</option>
      <option value="FINAL_SETTLEMENT">Final settlement</option>
    </select>

    <select
      bind:value={marketTypeFilter}
      class="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
    >
      <option value="all">All types</option>
      <option value="CROSS">Cross</option>
      <option value="ISOLATED">Isolated</option>
    </select>

    {#if view === 'table'}
      <select
        bind:value={fundingTimeframe}
        class="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
      >
        <option value="ann">Funding Ann.</option>
        <option value="8h">Funding 8hr</option>
        <option value="1h">Funding 1hr</option>
      </select>

      <select
        bind:value={stepSizeView}
        class="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
      >
        <option value="native">Min Order (native)</option>
        <option value="usd">Min Order (USD)</option>
      </select>
    {/if}

    {#if $data}
      <span class="ml-auto text-xs text-zinc-500">
        {filtered.length} / {$data.length} markets
      </span>
    {/if}
  </div>

  {#if !browser || $isLoading}
    <LoadingSpinner />
  {:else if $error}
    <ErrorBanner message="Failed to load market data from dYdX indexer" />
  {:else if filtered.length === 0}
    <p class="py-8 text-center text-sm text-zinc-500">No markets match your filters.</p>
  {:else if view === 'treemap'}
    <TreemapView rows={filtered} />
  {:else}
    <div class="overflow-x-auto">
      <div class="w-fit rounded-lg border border-zinc-800">
      <table class="min-w-max text-sm">
        <thead>
          <tr class="border-b border-zinc-800 bg-zinc-900/60">
            {#each columns as col}
              <th
                class="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300
                  {col.align === 'right' ? 'text-right' : 'text-left'}"
                onclick={() => toggleSort(col.key)}
              >
                {col.label}{sortIndicator(col.key)}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each filtered as row (row.clobPairId)}
            <tr class="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30">
              <td class="whitespace-nowrap px-3 py-2 font-medium text-zinc-200 mono" title={row.ticker}>
                {shortTicker(row.ticker)}{#if row.ticker.includes(',')}<span class="ml-1 text-[10px] text-zinc-500">*</span>{/if}
              </td>
              <td class="px-3 py-2">
                <span class="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase {statusBadge(row.status)}">
                  {row.status === 'FINAL_SETTLEMENT' ? 'Settled' : row.status}
                </span>
              </td>
              <td class="px-3 py-2">
                <span class="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium {typeBadge(row.marketType)}">
                  {row.marketType}
                </span>
              </td>
              <td class="whitespace-nowrap px-3 py-2 text-right mono text-zinc-100">{fmtPrice(row.oraclePrice)}</td>
              <td class="whitespace-nowrap px-3 py-2 text-right mono text-zinc-100">{fmtVol(row.volume24h)}</td>
              <td class="whitespace-nowrap px-3 py-2 text-right mono text-zinc-100">{fmtVol(row.openInterestNotional)}</td>
              <td class="whitespace-nowrap px-3 py-2 text-right mono text-zinc-300">{row.trades24h > 0 ? row.trades24h.toLocaleString() : '—'}</td>
              <td class="whitespace-nowrap px-3 py-2 text-right mono {fundingClass(row.nextFundingRate)}">{fmtFunding(row.nextFundingRate)}</td>
              <td class="whitespace-nowrap px-3 py-2 text-right mono text-zinc-300">{fmtSpread(row.tickSpreadBps)}</td>
              <td class="whitespace-nowrap px-3 py-2 text-right mono text-zinc-200">{fmtLeverage(row.maxLeverage)}</td>
              <td class="whitespace-nowrap px-3 py-2 text-right mono text-zinc-300">{fmtStepSize(row)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      </div>
    </div>
  {/if}
</PageShell>
