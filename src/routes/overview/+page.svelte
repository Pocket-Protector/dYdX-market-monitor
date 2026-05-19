<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { useSWR } from 'sswr';
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import LoadingSpinner from '$lib/shared/components/LoadingSpinner.svelte';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import { shortTicker } from '$lib/utils/format';

  interface ExchangeVolume {
    exchangeId: string;
    exchangeName: string;
    h24VolumeUsd: number | null;
    pctOfTotal: number | null;
  }

  interface OverviewRow {
    clobPairId: string;
    ticker: string;
    status: string;
    marketType: string;
    oraclePrice: number;
    volume24h: number;
    volumeMedian7d: number | null;
    volumeMean7d: number | null;
    volumeStddev7d: number | null;
    volumeMad7d: number | null;
    volumeSamples7d: number;
    volumeBaselineWindowStart: string | null;
    volumeBaselineWindowEnd: string | null;
    volumeZScore: number | null;
    volumeZScoreReady: boolean;
    trades24h: number;
    openInterestNotional: number;
    nextFundingRate: number | null;
    priceChange24h: number;
    maxLeverage: number | null;
    listedOnCount: number | null;
    listedOnExchanges: string[];
    totalExternalVolumeUsd: number | null;
    avgVolPerExchangeUsd: number | null;
    exchangeVolumes: ExchangeVolume[];
    trending24h: boolean;
    trending7d: boolean;
    hasCoinGeckoContext: boolean;
  }

  interface OverviewResponse {
    meta: {
      generatedAt: string;
      coingeckoSnapshotDate: string | null;
      coingeckoTrendingAsOf: string | null;
      warnings: string[];
    };
    data: {
      rows: OverviewRow[];
    };
    error: string | null;
  }

  type SortKey = keyof OverviewRow;
  type ColumnId = string;

  interface VenueVolumeRow {
    id: string;
    name: string;
    volumeUsd: number | null;
    pctAllVolume: number | null;
    isDydx: boolean;
    isListed: boolean;
    order: number;
  }

  type TrendFilter = 'any' | 'yes' | 'no';
  type SavedFilters = {
    search: string;
    statusFilter: string;
    marketTypeFilter: string;
    contextFilter: string;
    minVolume24h: string;
    maxVolume24h: string;
    minOpenInterest: string;
    maxOpenInterest: string;
    minListedOn: string;
    maxListedOn: string;
    minVolumeZScore: string;
    maxVolumeZScore: string;
    minAvgVolPerExchange: string;
    maxAvgVolPerExchange: string;
    minExternalVolume: string;
    maxExternalVolume: string;
    trending24hFilter: TrendFilter;
    trending7dFilter: TrendFilter;
  };

  const COLUMNS_STORAGE_KEY = 'overview.visibleColumns.v1';
  const FILTERS_STORAGE_KEY = 'overview.filters.v1';

  const trackedExchanges = [
    { id: 'binance_futures', name: 'Binance (Futures)' },
    { id: 'coinbase_international_derivatives', name: 'Coinbase International Exchange (Derivatives)' },
    { id: 'mxc_futures', name: 'MEXC (Futures)' },
    { id: 'bybit', name: 'Bybit (Futures)' },
    { id: 'gate_futures', name: 'Gate (Futures)' },
    { id: 'okex_swap', name: 'OKX (Futures)' },
    { id: 'kraken_futures', name: 'Kraken (Futures)' },
    { id: 'kumex', name: 'KuCoin Futures' },
    { id: 'hyperliquid', name: 'Hyperliquid (Futures)' },
    { id: 'lighter', name: 'Lighter' }
  ];

  const pendingColumns = [
    { id: 'pending:mmsQuoting' as ColumnId, label: 'MMs Quoting', short: 'MMs' },
    { id: 'pending:totalMmLiquidity' as ColumnId, label: 'Total MM Liq', short: 'MM Liq' },
    { id: 'pending:spread14d' as ColumnId, label: 'Spread 14d', short: 'Spr 14d' },
    { id: 'pending:spread24hDelta' as ColumnId, label: 'Spread 24h + Delta', short: 'Spr 24h' },
    { id: 'pending:depth14d' as ColumnId, label: 'Depth 14d', short: 'Dpt 14d' },
    { id: 'pending:depth24hDelta' as ColumnId, label: 'Depth 24h + Delta', short: 'Dpt 24h' },
    { id: 'pending:slippage10k14d' as ColumnId, label: 'Slip $10K 14d', short: 'S10 14d' },
    { id: 'pending:slippage10k24hDelta' as ColumnId, label: 'Slip $10K 24h + Delta', short: 'S10 24h' },
    { id: 'pending:slippage100k14d' as ColumnId, label: 'Slip $100K 14d', short: 'S100 14d' },
    { id: 'pending:slippage100k24hDelta' as ColumnId, label: 'Slip $100K 24h + Delta', short: 'S100 24h' }
  ];

  const columns = [
    { key: 'marketType' as SortKey, label: 'Type', align: 'left' as const, title: 'dYdX margin mode.' },
    { key: 'ticker' as SortKey, label: 'Ticker', align: 'left' as const, title: 'Canonical dYdX market ticker.' },
    { key: 'volume24h' as SortKey, label: 'Vol 24h', align: 'right' as const, title: 'Live 24h dYdX notional volume.' },
    { key: 'volumeZScore' as SortKey, label: 'Vol Z', align: 'right' as const, title: 'Robust z-score: live 24h dYdX volume versus 7-snapshot median baseline.' },
    { key: 'openInterestNotional' as SortKey, label: 'Open Interest', align: 'right' as const, title: 'openInterest multiplied by oraclePrice.' },
    { key: 'listedOnCount' as SortKey, label: 'Listed On', align: 'right' as const, title: 'Tracked derivative exchanges listing this ticker.' },
    { key: 'avgVolPerExchangeUsd' as SortKey, label: 'Avg Vol / Exch', align: 'right' as const, title: 'CoinGecko tracked perp volume divided by listed exchange count.' },
    { key: 'totalExternalVolumeUsd' as SortKey, label: 'External Vol', align: 'right' as const, title: 'Total CoinGecko tracked perp volume across listed venues.' },
    { key: 'trending24h' as SortKey, label: 'Trend 24h', align: 'center' as const, title: 'Appeared on CoinGecko trending in the last 24 hours.' },
    { key: 'trending7d' as SortKey, label: 'Trend 7d', align: 'center' as const, title: 'Appeared on CoinGecko trending in the last 7 days.' }
  ];

  const defaultVisibleColumns: Record<ColumnId, boolean> = {
    marketType: true,
    ticker: true,
    volume24h: true,
    volumeZScore: false,
    openInterestNotional: true,
    listedOnCount: true,
    avgVolPerExchangeUsd: false,
    totalExternalVolumeUsd: false,
    trending24h: true,
    trending7d: false,
    'pending:mmsQuoting': false,
    'pending:totalMmLiquidity': false,
    'pending:spread14d': false,
    'pending:spread24hDelta': false,
    'pending:depth14d': false,
    'pending:depth24hDelta': false,
    'pending:slippage10k14d': false,
    'pending:slippage10k24hDelta': false,
    'pending:slippage100k14d': false,
    'pending:slippage100k24hDelta': false
  };

  const columnWidths: Partial<Record<SortKey, string>> = {
    marketType: '58px',
    ticker: '88px',
    volume24h: '88px',
    volumeZScore: '66px',
    openInterestNotional: '104px',
    listedOnCount: '72px',
    avgVolPerExchangeUsd: '104px',
    totalExternalVolumeUsd: '102px',
    trending24h: '62px',
    trending7d: '62px'
  };

  let search = $state('');
  let statusFilter = $state('ACTIVE');
  let marketTypeFilter = $state('all');
  let contextFilter = $state('all');
  let sortKey = $state<SortKey>('openInterestNotional');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let openVenueTicker = $state<string | null>(null);
  let refreshing = $state(false);
  let showColumnMenu = $state(false);
  let showFilterMenu = $state(false);
  let visibleColumns = $state<Record<ColumnId, boolean>>({ ...defaultVisibleColumns });
  let minVolume24h = $state('');
  let maxVolume24h = $state('');
  let minOpenInterest = $state('');
  let maxOpenInterest = $state('');
  let minListedOn = $state('');
  let maxListedOn = $state('');
  let minVolumeZScore = $state('');
  let maxVolumeZScore = $state('');
  let minAvgVolPerExchange = $state('');
  let maxAvgVolPerExchange = $state('');
  let minExternalVolume = $state('');
  let maxExternalVolume = $state('');
  let trending24hFilter = $state<TrendFilter>('any');
  let trending7dFilter = $state<TrendFilter>('any');
  let preferencesLoaded = $state(false);

  const { data, error, isLoading, revalidate } = useSWR<OverviewResponse>(() => '/api/overview');

  const rows = $derived($data?.data.rows ?? []);
  const meta = $derived($data?.meta);
  const visibleDataColumns = $derived(columns.filter((col) => visibleColumns[col.key] !== false));
  const visiblePendingColumns = $derived(pendingColumns.filter((col) => visibleColumns[col.id]));
  const visibleColumnCount = $derived(visibleDataColumns.length + visiblePendingColumns.length);
  const activeAdvancedFilterCount = $derived(
    [
      minVolume24h,
      maxVolume24h,
      minOpenInterest,
      maxOpenInterest,
      minListedOn,
      maxListedOn,
      minVolumeZScore,
      maxVolumeZScore,
      minAvgVolPerExchange,
      maxAvgVolPerExchange,
      minExternalVolume,
      maxExternalVolume
    ].filter((value) => value.trim() !== '').length +
      (trending24hFilter !== 'any' ? 1 : 0) +
      (trending7dFilter !== 'any' ? 1 : 0)
  );
  const activeFilterLabels = $derived.by(() => {
    const labels: string[] = [];
    const addRange = (label: string, min: string, max: string) => {
      const minValue = min.trim();
      const maxValue = max.trim();
      if (minValue && maxValue) labels.push(`${label}: ${minValue}-${maxValue}`);
      else if (minValue) labels.push(`${label}: >= ${minValue}`);
      else if (maxValue) labels.push(`${label}: <= ${maxValue}`);
    };

    if (search.trim()) labels.push(`Ticker: ${search.trim().toUpperCase()}`);
    if (statusFilter !== 'ACTIVE') labels.push(statusFilter === 'all' ? 'Status: all' : `Status: ${statusFilter}`);
    if (marketTypeFilter !== 'all') labels.push(`Type: ${marketTypeFilter}`);
    if (contextFilter !== 'all') labels.push(contextFilter === 'with-context' ? 'Has CoinGecko' : 'Missing CoinGecko');

    addRange('Vol 24h', minVolume24h, maxVolume24h);
    addRange('Open Interest', minOpenInterest, maxOpenInterest);
    addRange('Listed On', minListedOn, maxListedOn);
    addRange('Vol Z', minVolumeZScore, maxVolumeZScore);
    addRange('Avg Vol / Exch', minAvgVolPerExchange, maxAvgVolPerExchange);
    addRange('External Vol', minExternalVolume, maxExternalVolume);

    if (trending24hFilter !== 'any') labels.push(`Trend 24h: ${trending24hFilter}`);
    if (trending7dFilter !== 'any') labels.push(`Trend 7d: ${trending7dFilter}`);

    return labels;
  });

  onMount(() => {
    const savedColumns = safeParse<Record<ColumnId, boolean>>(localStorage.getItem(COLUMNS_STORAGE_KEY));
    if (savedColumns) {
      visibleColumns = { ...defaultVisibleColumns, ...savedColumns, ticker: true };
    }

    const savedFilters = safeParse<Partial<SavedFilters>>(localStorage.getItem(FILTERS_STORAGE_KEY));
    if (savedFilters) {
      search = savedFilters.search ?? search;
      statusFilter = savedFilters.statusFilter ?? statusFilter;
      marketTypeFilter = savedFilters.marketTypeFilter ?? marketTypeFilter;
      contextFilter = savedFilters.contextFilter ?? contextFilter;
      minVolume24h = savedFilters.minVolume24h ?? minVolume24h;
      maxVolume24h = savedFilters.maxVolume24h ?? maxVolume24h;
      minOpenInterest = savedFilters.minOpenInterest ?? minOpenInterest;
      maxOpenInterest = savedFilters.maxOpenInterest ?? maxOpenInterest;
      minListedOn = savedFilters.minListedOn ?? minListedOn;
      maxListedOn = savedFilters.maxListedOn ?? maxListedOn;
      minVolumeZScore = savedFilters.minVolumeZScore ?? minVolumeZScore;
      maxVolumeZScore = savedFilters.maxVolumeZScore ?? maxVolumeZScore;
      minAvgVolPerExchange = savedFilters.minAvgVolPerExchange ?? minAvgVolPerExchange;
      maxAvgVolPerExchange = savedFilters.maxAvgVolPerExchange ?? maxAvgVolPerExchange;
      minExternalVolume = savedFilters.minExternalVolume ?? minExternalVolume;
      maxExternalVolume = savedFilters.maxExternalVolume ?? maxExternalVolume;
      trending24hFilter = isTrendFilter(savedFilters.trending24hFilter) ? savedFilters.trending24hFilter : trending24hFilter;
      trending7dFilter = isTrendFilter(savedFilters.trending7dFilter) ? savedFilters.trending7dFilter : trending7dFilter;
    }

    preferencesLoaded = true;
  });

  $effect(() => {
    if (!browser || !preferencesLoaded) return;
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  });

  $effect(() => {
    if (!browser || !preferencesLoaded) return;
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(currentFilters()));
  });

  async function handleRefresh() {
    refreshing = true;
    const minDelay = new Promise((resolve) => setTimeout(resolve, 350));
    await Promise.all([revalidate(), minDelay]);
    refreshing = false;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'desc' ? 'asc' : 'desc';
      return;
    }
    sortKey = key;
    sortDir = 'desc';
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortDir === 'desc' ? ' v' : ' ^';
  }

  function safeParse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function isTrendFilter(value: unknown): value is TrendFilter {
    return value === 'any' || value === 'yes' || value === 'no';
  }

  function currentFilters(): SavedFilters {
    return {
      search,
      statusFilter,
      marketTypeFilter,
      contextFilter,
      minVolume24h,
      maxVolume24h,
      minOpenInterest,
      maxOpenInterest,
      minListedOn,
      maxListedOn,
      minVolumeZScore,
      maxVolumeZScore,
      minAvgVolPerExchange,
      maxAvgVolPerExchange,
      minExternalVolume,
      maxExternalVolume,
      trending24hFilter,
      trending7dFilter
    };
  }

  function toggleColumn(id: ColumnId) {
    if (id === 'ticker') return;
    visibleColumns[id] = !visibleColumns[id];
    if (id === sortKey && !visibleColumns[id]) {
      sortKey = visibleColumns.openInterestNotional ? 'openInterestNotional' : 'ticker';
      sortDir = 'desc';
    }
  }

  function resetColumns() {
    visibleColumns = { ...defaultVisibleColumns };
    if (!visibleColumns[sortKey]) {
      sortKey = 'openInterestNotional';
      sortDir = 'desc';
    }
  }

  function cellAlignClass(align: 'left' | 'right' | 'center'): string {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  }

  function parseFilterNumber(value: string): number | null {
    const normalized = value.trim().toLowerCase().replace(/[$,\s_]/g, '');
    if (!normalized) return null;

    const match = normalized.match(/^(-?\d+(?:\.\d+)?)([kmb])?$/);
    if (!match) return Number.NaN;

    const base = Number(match[1]);
    const multiplier = match[2] === 'k' ? 1_000 : match[2] === 'm' ? 1_000_000 : match[2] === 'b' ? 1_000_000_000 : 1;
    return base * multiplier;
  }

  function matchesRange(value: number | null | undefined, minRaw: string, maxRaw: string): boolean {
    const min = parseFilterNumber(minRaw);
    const max = parseFilterNumber(maxRaw);
    if (Number.isNaN(min) || Number.isNaN(max)) return true;
    if (min == null && max == null) return true;
    if (value == null) return false;
    if (min != null && value < min) return false;
    if (max != null && value > max) return false;
    return true;
  }

  function matchesTrendFilter(value: boolean, filter: TrendFilter): boolean {
    if (filter === 'any') return true;
    return filter === 'yes' ? value : !value;
  }

  function resetAdvancedFilters() {
    minVolume24h = '';
    maxVolume24h = '';
    minOpenInterest = '';
    maxOpenInterest = '';
    minListedOn = '';
    maxListedOn = '';
    minVolumeZScore = '';
    maxVolumeZScore = '';
    minAvgVolPerExchange = '';
    maxAvgVolPerExchange = '';
    minExternalVolume = '';
    maxExternalVolume = '';
    trending24hFilter = 'any';
    trending7dFilter = 'any';
  }

  const filtered = $derived.by(() => {
    let result = [...rows];

    if (statusFilter !== 'all') result = result.filter((row) => row.status === statusFilter);
    if (marketTypeFilter !== 'all') result = result.filter((row) => row.marketType === marketTypeFilter);
    if (contextFilter === 'with-context') result = result.filter((row) => row.hasCoinGeckoContext);
    if (contextFilter === 'without-context') result = result.filter((row) => !row.hasCoinGeckoContext);
    result = result.filter(
      (row) =>
        matchesRange(row.volume24h, minVolume24h, maxVolume24h) &&
        matchesRange(row.openInterestNotional, minOpenInterest, maxOpenInterest) &&
        matchesRange(row.listedOnCount, minListedOn, maxListedOn) &&
        matchesRange(row.volumeZScore, minVolumeZScore, maxVolumeZScore) &&
        matchesRange(row.avgVolPerExchangeUsd, minAvgVolPerExchange, maxAvgVolPerExchange) &&
        matchesRange(row.totalExternalVolumeUsd, minExternalVolume, maxExternalVolume) &&
        matchesTrendFilter(row.trending24h, trending24hFilter) &&
        matchesTrendFilter(row.trending7d, trending7dFilter)
    );
    if (search) {
      const q = search.toUpperCase();
      result = result.filter((row) => row.ticker.toUpperCase().includes(q) || shortTicker(row.ticker).toUpperCase().includes(q));
    }

    result.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return a.ticker.localeCompare(b.ticker);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'boolean' && typeof bv === 'boolean') {
        const diff = Number(av) - Number(bv);
        return sortDir === 'asc' ? diff : -diff;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const diff = Number(av) - Number(bv);
      return sortDir === 'asc' ? diff : -diff;
    });

    return result;
  });

  function formatUsd(value: number | null | undefined): string {
    if (value == null) return '-';
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    if (abs > 0) return `${sign}$${abs.toFixed(0)}`;
    return '$0';
  }

  function formatZScore(value: number | null | undefined): string {
    if (value == null) return 'warm';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}z`;
  }

  function zScoreClass(row: OverviewRow): string {
    const value = row.volumeZScore;
    if (value == null) return 'border-zinc-700 bg-zinc-950/50 text-zinc-600';
    if (value >= 3) return 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300 font-semibold';
    if (value >= 2) return 'border-violet-400/40 bg-violet-500/15 text-violet-300 font-semibold';
    if (value <= -2) return 'border-red-400/30 bg-red-400/10 text-red-300';
    return 'border-zinc-700 bg-zinc-900/70 text-zinc-400';
  }

  function zScoreTitle(row: OverviewRow): string {
    if (!row.volumeZScoreReady) {
      return `Waiting for 7 daily volume snapshots. Samples available: ${row.volumeSamples7d}/7.`;
    }
    return [
      `Vol Z: ${formatZScore(row.volumeZScore)}`,
      `Live 24h: ${formatUsd(row.volume24h)}`,
      `7d median: ${formatUsd(row.volumeMedian7d)}`,
      `MAD: ${formatUsd(row.volumeMad7d)}`,
      `Window: ${formatTimestamp(row.volumeBaselineWindowStart)} to ${formatTimestamp(row.volumeBaselineWindowEnd)}`
    ].join('\n');
  }

  const statusHeading = $derived(
    statusFilter === 'ACTIVE'
      ? 'Active pairs'
      : statusFilter === 'FINAL_SETTLEMENT'
        ? 'Settled pairs'
        : 'All pairs'
  );

  function typeClass(type: string): string {
    if (type === 'CROSS') return 'border-violet-400/30 bg-violet-500/10 text-violet-300';
    return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  }

  function boolPill(value: boolean): string {
    return value ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-zinc-700 bg-zinc-900/60 text-zinc-500';
  }

  function toggleVenueTable(row: OverviewRow) {
    openVenueTicker = openVenueTicker === row.ticker ? null : row.ticker;
  }

  function exchangeTitle(row: OverviewRow): string {
    if (!row.listedOnExchanges.length) return 'No CoinGecko exchange context for this ticker.';
    return row.listedOnExchanges.join(', ');
  }

  function totalComparableVolume(row: OverviewRow): number {
    return (row.totalExternalVolumeUsd ?? 0) + row.volume24h;
  }

  function dydxMarketShare(row: OverviewRow): number | null {
    const total = totalComparableVolume(row);
    if (total <= 0) return null;
    return (row.volume24h / total) * 100;
  }

  function venueRows(row: OverviewRow): VenueVolumeRow[] {
    const total = totalComparableVolume(row);
    const dydxRow: VenueVolumeRow = {
      id: 'dydx',
      name: 'dYdX',
      volumeUsd: row.volume24h,
      pctAllVolume: total > 0 ? (row.volume24h / total) * 100 : null,
      isDydx: true,
      isListed: true,
      order: -1
    };

    const volumeByExchange = new Map(row.exchangeVolumes.map((exchange) => [exchange.exchangeId, exchange]));
    const exchangeRows = trackedExchanges.map((exchange, index) => {
      const listedExchange = volumeByExchange.get(exchange.id);
      return {
        id: exchange.id,
        name: listedExchange?.exchangeName ?? exchange.name,
        volumeUsd: listedExchange?.h24VolumeUsd ?? null,
        pctAllVolume:
          total > 0 && listedExchange?.h24VolumeUsd != null ? (listedExchange.h24VolumeUsd / total) * 100 : null,
        isDydx: false,
        isListed: Boolean(listedExchange),
        order: index
      };
    });

    return [dydxRow, ...exchangeRows].sort((a, b) => {
      if (a.isDydx) return -1;
      if (b.isDydx) return 1;
      if (a.isListed !== b.isListed) return a.isListed ? -1 : 1;
      return (b.volumeUsd ?? -1) - (a.volumeUsd ?? -1) || a.order - b.order;
    });
  }

  function formatShare(value: number | null | undefined): string {
    if (value == null) return '-';
    if (value > 0 && value < 0.1) return '<0.1%';
    return `${value.toFixed(1)}%`;
  }

  function formatTimestamp(value: string | null | undefined): string {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<style>
  :global(.overview-control) {
    padding: 0.5rem 0.875rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  :global(select.overview-control),
  :global(.overview-panel select) {
    padding-right: 2.5rem;
  }

  :global(.overview-panel input),
  :global(.overview-panel select) {
    padding: 0.45rem 0.65rem;
    font-size: 0.8125rem;
    line-height: 1.125rem;
  }

  :global(.overview-panel select) {
    padding-right: 2.25rem;
  }
</style>

<PageShell wide>
  <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold text-zinc-100">Market Overview</h1>
    </div>
    <div class="text-right text-xs text-zinc-500">
      <span>CoinGecko snapshot: {formatTimestamp(meta?.coingeckoSnapshotDate)}</span>
      <span class="mx-2 text-zinc-700">|</span>
      <span>Trending as of: {formatTimestamp(meta?.coingeckoTrendingAsOf)}</span>
    </div>
  </div>

  <div class="mb-4 flex flex-wrap items-center gap-3">
    <input
      type="text"
      bind:value={search}
      placeholder="Search ticker..."
      class="overview-control w-52 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 uppercase focus:border-violet-500 focus:outline-none mono placeholder:normal-case placeholder:text-zinc-600"
    />

    <select bind:value={statusFilter} class="overview-control rounded border border-zinc-700 bg-zinc-900 text-zinc-200 focus:border-violet-500 focus:outline-none">
      <option value="all">All statuses</option>
      <option value="ACTIVE">Active</option>
      <option value="FINAL_SETTLEMENT">Final settlement</option>
    </select>

    <select bind:value={marketTypeFilter} class="overview-control rounded border border-zinc-700 bg-zinc-900 text-zinc-200 focus:border-violet-500 focus:outline-none">
      <option value="all">All types</option>
      <option value="CROSS">Cross</option>
      <option value="ISOLATED">Isolated</option>
    </select>

    <select bind:value={contextFilter} class="overview-control rounded border border-zinc-700 bg-zinc-900 text-zinc-200 focus:border-violet-500 focus:outline-none">
      <option value="all">All context</option>
      <option value="with-context">With CoinGecko</option>
      <option value="without-context">Missing CoinGecko</option>
    </select>

    <div class="relative">
      <button
        class="overview-control rounded border border-zinc-700 bg-zinc-900 font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 {activeAdvancedFilterCount > 0 ? 'border-violet-500/40 bg-violet-500/15 text-violet-300' : ''}"
        onclick={() => (showFilterMenu = !showFilterMenu)}
      >
        Filters{activeAdvancedFilterCount > 0 ? ` (${activeAdvancedFilterCount})` : ''}
      </button>

      {#if showFilterMenu}
        <div class="overview-panel absolute left-0 top-full z-30 mt-2 w-[720px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
          <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <div>
              <div class="text-xs font-semibold text-zinc-100">Advanced filters</div>
              <div class="text-[11px] text-zinc-500">Filters work even when the matching column is hidden. Use shorthand like 500k, 10m, 1.2b.</div>
            </div>
            <button class="text-[11px] font-medium text-violet-300 hover:text-violet-200" onclick={resetAdvancedFilters}>Clear</button>
          </div>

          <div class="grid gap-4 p-3 md:grid-cols-3">
            <div>
              <div class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">dYdX live</div>
              <div class="space-y-2">
                <div>
                  <div class="mb-1 text-[11px] text-zinc-400">Vol 24h</div>
                  <div class="grid grid-cols-2 gap-2">
                    <input bind:value={minVolume24h} placeholder="Min" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                    <input bind:value={maxVolume24h} placeholder="Max" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                  </div>
                </div>
                <div>
                  <div class="mb-1 text-[11px] text-zinc-400">Open Interest</div>
                  <div class="grid grid-cols-2 gap-2">
                    <input bind:value={minOpenInterest} placeholder="Min" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                    <input bind:value={maxOpenInterest} placeholder="Max" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                  </div>
                </div>
                <div>
                  <div class="mb-1 text-[11px] text-zinc-400">Vol Z</div>
                  <div class="grid grid-cols-2 gap-2">
                    <input bind:value={minVolumeZScore} placeholder="Min" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                    <input bind:value={maxVolumeZScore} placeholder="Max" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">CoinGecko context</div>
              <div class="space-y-2">
                <div>
                  <div class="mb-1 text-[11px] text-zinc-400">Listed On</div>
                  <div class="grid grid-cols-2 gap-2">
                    <input bind:value={minListedOn} placeholder="Min" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                    <input bind:value={maxListedOn} placeholder="Max" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                  </div>
                </div>
                <div>
                  <div class="mb-1 text-[11px] text-zinc-400">Avg Vol / Exch</div>
                  <div class="grid grid-cols-2 gap-2">
                    <input bind:value={minAvgVolPerExchange} placeholder="Min" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                    <input bind:value={maxAvgVolPerExchange} placeholder="Max" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                  </div>
                </div>
                <div>
                  <div class="mb-1 text-[11px] text-zinc-400">External Vol</div>
                  <div class="grid grid-cols-2 gap-2">
                    <input bind:value={minExternalVolume} placeholder="Min" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                    <input bind:value={maxExternalVolume} placeholder="Max" class="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none mono" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Trend flags</div>
              <div class="space-y-3">
                <div>
                  <div class="mb-1 text-[11px] text-zinc-400">Trending 24h</div>
                  <select bind:value={trending24hFilter} class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none">
                    <option value="any">Any</option>
                    <option value="yes">Yes only</option>
                    <option value="no">No only</option>
                  </select>
                </div>
                <div>
                  <div class="mb-1 text-[11px] text-zinc-400">Trending 7d</div>
                  <select bind:value={trending7dFilter} class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none">
                    <option value="any">Any</option>
                    <option value="yes">Yes only</option>
                    <option value="no">No only</option>
                  </select>
                </div>
                <div class="rounded border border-zinc-800 bg-zinc-900/50 px-2 py-2 text-[11px] leading-5 text-zinc-500">
                  Hidden columns stay filterable, so you can screen by external volume or z-score without showing those fields in the table.
                </div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="relative">
      <button
        class="overview-control rounded border border-zinc-700 bg-zinc-900 font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
        onclick={() => (showColumnMenu = !showColumnMenu)}
      >
        Columns ({visibleColumnCount})
      </button>

      {#if showColumnMenu}
        <div class="absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
          <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <div>
              <div class="text-xs font-semibold text-zinc-100">Visible columns</div>
              <div class="text-[11px] text-zinc-500">Toggle table fields as data comes online.</div>
            </div>
            <button class="text-[11px] font-medium text-violet-300 hover:text-violet-200" onclick={resetColumns}>Reset</button>
          </div>

          <div class="max-h-[420px] overflow-y-auto p-2">
            <div class="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Live fields</div>
            {#each columns as col}
              <label class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900/80 {col.key === 'ticker' ? 'cursor-not-allowed opacity-60' : ''}">
                <span>{col.label}</span>
                <input
                  type="checkbox"
                  checked={visibleColumns[col.key] !== false}
                  disabled={col.key === 'ticker'}
                  onchange={() => toggleColumn(col.key)}
                  class="h-3.5 w-3.5 accent-violet-500"
                />
              </label>
            {/each}

            <div class="mt-3 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Planned fields</div>
            {#each pendingColumns as col}
              <label class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-zinc-500 hover:bg-zinc-900/80 hover:text-zinc-300">
                <span>{col.label}</span>
                <input
                  type="checkbox"
                  checked={visibleColumns[col.id] === true}
                  onchange={() => toggleColumn(col.id)}
                  class="h-3.5 w-3.5 accent-violet-500"
                />
              </label>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <button
      class="overview-control rounded border border-violet-500/30 bg-violet-500/20 font-medium text-violet-300 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
      onclick={handleRefresh}
      disabled={refreshing}
    >
      {refreshing ? 'Refreshing...' : 'Refresh'}
    </button>
  </div>

  {#if meta?.warnings?.length}
    <div class="mb-4 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
      {meta.warnings.join(' ')}
    </div>
  {/if}

  {#if !browser || $isLoading}
    <LoadingSpinner />
  {:else if $error}
    <ErrorBanner message="Failed to load overview data" />
  {:else}
    <div class="relative overflow-x-auto 2xl:overflow-visible">
      {#if refreshing}
        <div class="absolute inset-0 z-10 rounded-lg skeleton"></div>
      {/if}
      <div class="min-w-[1040px] 2xl:min-w-0">
        <div class="overflow-hidden rounded-lg border border-zinc-800">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="font-medium text-zinc-300">{statusHeading}</span>
              {#if activeFilterLabels.length}
                <span class="text-zinc-700">|</span>
                {#each activeFilterLabels.slice(0, 5) as label}
                  <span class="rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">{label}</span>
                {/each}
                {#if activeFilterLabels.length > 5}
                  <span class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-500">+{activeFilterLabels.length - 5} more</span>
                {/if}
              {/if}
            </div>
            <div>{filtered.length} / {rows.length} markets</div>
          </div>
          <table class="w-full table-fixed text-[12px]">
            <colgroup>
              {#each visibleDataColumns as col}
                <col style={`width: ${columnWidths[col.key] ?? '84px'}`} />
              {/each}
              {#each visiblePendingColumns as _}
                <col style="width: 72px" />
              {/each}
            </colgroup>
            <thead class="sticky top-0 z-20">
              <tr class="border-b border-zinc-800 bg-zinc-900/80">
                {#each visibleDataColumns as col}
                  <th
                    class="cursor-pointer select-none truncate px-2 py-2.5 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-200 {cellAlignClass(col.align)}"
                    title={col.title}
                    onclick={() => toggleSort(col.key)}
                  >
                    {col.label}{sortIndicator(col.key)}
                  </th>
                {/each}
                {#each visiblePendingColumns as col}
                  <th class="truncate border-l border-zinc-800/70 bg-zinc-950/60 px-2 py-2.5 text-right text-[11px] font-medium text-zinc-600" title={`${col.label}. Planned column. Waiting for a confirmed source/API.`}>
                    {col.short}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each filtered as row (row.clobPairId)}
                <tr class="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30 {row.status !== 'ACTIVE' ? 'opacity-60' : ''}">
                  {#each visibleDataColumns as col}
                    <td class="whitespace-nowrap px-2 py-2 {cellAlignClass(col.align)} {col.key === 'ticker' ? 'truncate font-medium text-violet-300 mono' : ''}" title={col.key === 'ticker' ? row.ticker : undefined}>
                      {#if col.key === 'marketType'}
                        <span class="inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold {typeClass(row.marketType)}">{row.marketType}</span>
                      {:else if col.key === 'ticker'}
                        {shortTicker(row.ticker)}
                      {:else if col.key === 'volume24h'}
                        <span class="text-zinc-100 mono">{formatUsd(row.volume24h)}</span>
                      {:else if col.key === 'volumeZScore'}
                        <span class="inline-block min-w-12 rounded border px-1.5 py-0.5 text-center text-[10px] mono {zScoreClass(row)}" title={zScoreTitle(row)}>
                          {formatZScore(row.volumeZScore)}
                        </span>
                      {:else if col.key === 'openInterestNotional'}
                        <span class="text-zinc-100 mono">{formatUsd(row.openInterestNotional)}</span>
                      {:else if col.key === 'listedOnCount'}
                        <button
                          class="text-right text-zinc-200 underline-offset-2 hover:text-violet-300 hover:underline mono"
                          title={exchangeTitle(row)}
                          onclick={() => toggleVenueTable(row)}
                        >
                          {row.listedOnCount == null ? '-' : `${row.listedOnCount}/10`}
                        </button>
                      {:else if col.key === 'avgVolPerExchangeUsd'}
                        <button
                          class="text-right text-zinc-100 underline-offset-2 hover:text-violet-300 hover:underline mono"
                          title="Show venue volume and dYdX market share"
                          onclick={() => toggleVenueTable(row)}
                        >
                          {formatUsd(row.avgVolPerExchangeUsd)}
                        </button>
                      {:else if col.key === 'totalExternalVolumeUsd'}
                        <button
                          class="text-right text-zinc-100 underline-offset-2 hover:text-violet-300 hover:underline mono"
                          title="Show venue volume and dYdX market share"
                          onclick={() => toggleVenueTable(row)}
                        >
                          {formatUsd(row.totalExternalVolumeUsd)}
                        </button>
                      {:else if col.key === 'trending24h'}
                        <span class="inline-block min-w-6 rounded border px-1.5 py-0.5 text-[10px] font-semibold {boolPill(row.trending24h)}">{row.trending24h ? 'Y' : 'N'}</span>
                      {:else if col.key === 'trending7d'}
                        <span class="inline-block min-w-6 rounded border px-1.5 py-0.5 text-[10px] font-semibold {boolPill(row.trending7d)}">{row.trending7d ? 'Y' : 'N'}</span>
                      {/if}
                    </td>
                  {/each}
                  {#each visiblePendingColumns as _}
                    <td class="whitespace-nowrap border-l border-zinc-800/40 bg-zinc-950/30 px-2 py-2 text-right text-[11px] text-zinc-700 mono">...</td>
                  {/each}
                </tr>

                {#if openVenueTicker === row.ticker}
                  <tr class="border-b border-zinc-800/70 bg-zinc-800/30">
                    <td colspan={visibleColumnCount} class="px-3 py-3">
                      <div class="w-full overflow-hidden rounded border border-zinc-700/80 bg-zinc-800/25 shadow-2xl shadow-black/40">
                        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
                          <div>
                            <div class="text-xs font-semibold text-zinc-100 mono">{shortTicker(row.ticker)} venue volume</div>
                            <div class="mt-0.5 text-[11px] text-zinc-500">
                              {row.listedOnCount ?? 0}/10 tracked venues listed &middot; dYdX share {formatShare(dydxMarketShare(row))}
                            </div>
                          </div>
                          <div class="grid grid-cols-3 gap-2 text-right text-[11px]">
                            <div>
                              <div class="text-zinc-500">dYdX</div>
                              <div class="text-zinc-200 mono">{formatUsd(row.volume24h)}</div>
                            </div>
                            <div>
                              <div class="text-zinc-500">External</div>
                              <div class="text-zinc-200 mono">{formatUsd(row.totalExternalVolumeUsd)}</div>
                            </div>
                            <div>
                              <div class="text-zinc-500">All</div>
                              <div class="text-zinc-200 mono">{formatUsd(totalComparableVolume(row))}</div>
                            </div>
                          </div>
                        </div>

                        <div class="grid grid-cols-[1.5fr_1fr_0.7fr_1.2fr] border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-medium text-zinc-500">
                          <div>Venue</div>
                          <div class="text-right">24h Volume</div>
                          <div class="text-right">% All</div>
                          <div class="text-right">Share</div>
                        </div>

                        {#each venueRows(row) as venue}
                          <div class="grid grid-cols-[1.5fr_1fr_0.7fr_1.2fr] items-center border-b border-zinc-800/60 px-3 py-1.5 text-xs last:border-b-0 {venue.isDydx ? 'bg-violet-500/10 text-violet-300' : venue.isListed ? 'text-zinc-300' : 'bg-zinc-950/35 text-zinc-600'}">
                            <div class="truncate font-medium {venue.isDydx ? 'text-violet-300' : venue.isListed ? 'text-zinc-300' : 'text-zinc-600'}">
                              {venue.name}{venue.isListed ? '' : ' (not listed)'}
                            </div>
                            <div class="text-right {venue.isListed ? 'text-zinc-200' : 'text-zinc-600'} mono">{formatUsd(venue.volumeUsd)}</div>
                            <div class="text-right {venue.isListed ? 'text-zinc-400' : 'text-zinc-700'} mono">{formatShare(venue.pctAllVolume)}</div>
                            <div class="pl-4">
                              <div class="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  class="h-full rounded-full {venue.isDydx ? 'bg-violet-500' : venue.isListed ? 'bg-zinc-500' : 'bg-zinc-800'}"
                                  style={`width: ${Math.min(100, Math.max(0, venue.pctAllVolume ?? 0))}%`}
                                ></div>
                              </div>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </td>
                  </tr>
                {/if}
              {:else}
                <tr>
                  <td colspan={visibleColumnCount} class="px-3 py-10 text-center text-sm text-zinc-500">
                    No markets match your filters. The active filters are shown above.
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</PageShell>
