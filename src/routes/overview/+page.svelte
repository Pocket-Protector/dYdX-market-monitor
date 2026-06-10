<script lang="ts">
  import { browser } from '$app/environment';
  import { onDestroy, onMount } from 'svelte';
  import { useSWR } from 'sswr';
  import PageShell from '$lib/components/layout/PageShell.svelte';
  import LoadingSpinner from '$lib/shared/components/LoadingSpinner.svelte';
  import ErrorBanner from '$lib/shared/components/ErrorBanner.svelte';
  import { shortTicker } from '$lib/utils/format';
  import type {
    MmQuotesOverviewResponse,
    MmQuotesDetailResponse,
    MmQuotesDetailMm,
    MmQuotesDetailTicker
  } from '$lib/features/mm-quotes/types';
  import type { PairDepthOverviewResponse, PairDepthOverviewTicker } from '$lib/features/pairdepth/types';
  import type {
    TradingHoursSummaryResponse,
    TradingHoursSummaryTicker,
    TradingHoursDetailResponse,
    TradingHoursDetailTicker,
    TradingHoursWindow,
    TradingHoursSessionKey
  } from '$lib/features/trading-hours/types';
  import type { TibDetailResponse, TibTicker } from '$lib/features/time-in-book/types';

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
    mmsQuoting: number | null;
    totalMmLiquidityUsd: number | null;
    mmMakerVolumeUsd24h: number | null;
    mmTakerVolumeUsd24h: number | null;
    vol14dMedianUsd: number | null;
    spread14dBps: number | null;
    spread24hBps: number | null;
    spreadDeltaPct: number | null;
    depth100bps14dUsd: number | null;
    depth100bps24hUsd: number | null;
    depth100bpsDeltaPct: number | null;
    slip10kBps14d: number | null;
    slip10kBps24h: number | null;
    slip10kDeltaPct: number | null;
    slip100kBps14d: number | null;
    slip100kBps24h: number | null;
    slip100kDeltaPct: number | null;
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
    selectedMmFilters: string[];
  };

  const MM_FILTER_NONE = '__none__';

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

  const columns = [
    { key: 'tradingHours' as unknown as SortKey, label: 'Hours', align: 'left' as const, title: 'Quoted liquidity & depth split by trading session (last full week). Click + for the per-session breakdown.' },
    { key: 'marketType' as SortKey, label: 'Type', align: 'left' as const, title: 'dYdX margin mode.' },
    { key: 'ticker' as SortKey, label: 'Ticker', align: 'left' as const, title: 'Canonical dYdX market ticker.' },
    { key: 'vol14dMedianUsd' as SortKey, label: 'Vol 14d med', align: 'right' as const, title: '14-day median of daily 24h notional volume (from PairDepth daily_volume_group).' },
    { key: 'volumeZScore' as SortKey, label: 'Vol Z', align: 'right' as const, title: 'Robust z-score: live 24h dYdX volume versus 7-snapshot median baseline.' },
    { key: 'openInterestNotional' as SortKey, label: 'Open Interest', align: 'right' as const, title: 'openInterest multiplied by oraclePrice.' },
    { key: 'mmsQuoting' as SortKey, label: 'MMs', align: 'right' as const, title: 'Distinct tracked MM groups with at least one two-sided minute on this ticker in the last 24h.' },
    { key: 'totalMmLiquidityUsd' as SortKey, label: 'MM Liq', align: 'right' as const, title: 'Sum over MMs of (medianBidUsd + medianAskUsd) — typical total depth when each MM is on. Last 24h.' },
    { key: 'spread14dBps' as SortKey, label: 'Spr 14d', align: 'right' as const, title: 'PairDepth: 14-day median of minute-level spread in bps. (best_ask - best_bid) / mid * 10000.' },
    { key: 'spread24hBps' as SortKey, label: 'Spr 24h', align: 'right' as const, title: 'PairDepth: 24h median spread in bps with delta vs 14d. Positive delta = spreads widened recently (worse).' },
    { key: 'depth100bps14dUsd' as SortKey, label: 'Dpt 14d', align: 'right' as const, title: 'PairDepth: 14-day median of quote-USD depth within 100 bps of mid (bid + ask).' },
    { key: 'depth100bps24hUsd' as SortKey, label: 'Dpt 24h', align: 'right' as const, title: 'PairDepth: 24h median 100 bps depth with delta vs 14d. Positive delta = more liquidity recently (better).' },
    { key: 'slip10kBps14d' as SortKey, label: 'S10K 14d', align: 'right' as const, title: 'PairDepth: 14-day median bps cost of a $10K market order vs mid.' },
    { key: 'slip10kBps24h' as SortKey, label: 'S10K 24h', align: 'right' as const, title: 'PairDepth: 24h median $10K slippage in bps with delta vs 14d. Positive delta = slippage worsened (worse).' },
    { key: 'slip100kBps14d' as SortKey, label: 'S100K 14d', align: 'right' as const, title: 'PairDepth: 14-day median bps cost of a $100K market order vs mid.' },
    { key: 'slip100kBps24h' as SortKey, label: 'S100K 24h', align: 'right' as const, title: 'PairDepth: 24h median $100K slippage in bps with delta vs 14d. Positive delta = slippage worsened (worse).' },
    { key: 'listedOnCount' as SortKey, label: 'Listed On', align: 'right' as const, title: 'Tracked derivative exchanges listing this ticker.' },
    { key: 'avgVolPerExchangeUsd' as SortKey, label: 'Avg Vol / Exch', align: 'right' as const, title: 'CoinGecko tracked perp volume divided by listed exchange count.' },
    { key: 'totalExternalVolumeUsd' as SortKey, label: 'External Vol', align: 'right' as const, title: 'Total CoinGecko tracked perp volume across listed venues.' },
    { key: 'trending24h' as SortKey, label: 'Trend 24h', align: 'center' as const, title: 'Appeared on CoinGecko trending in the last 24 hours.' },
    { key: 'trending7d' as SortKey, label: 'Trend 7d', align: 'center' as const, title: 'Appeared on CoinGecko trending in the last 7 days.' }
  ];

  const defaultVisibleColumns: Record<ColumnId, boolean> = {
    tradingHours: true,
    marketType: true,
    ticker: true,
    vol14dMedianUsd: true,
    volumeZScore: false,
    openInterestNotional: true,
    mmsQuoting: true,
    totalMmLiquidityUsd: true,
    spread14dBps: true,
    spread24hBps: true,
    depth100bps14dUsd: true,
    depth100bps24hUsd: true,
    slip10kBps14d: false,
    slip10kBps24h: true,
    slip100kBps14d: false,
    slip100kBps24h: true,
    listedOnCount: true,
    avgVolPerExchangeUsd: false,
    totalExternalVolumeUsd: false,
    trending24h: true,
    trending7d: false
  };

  const columnWidths: Record<string, string> = {
    tradingHours: '48px',
    marketType: '58px',
    ticker: '68px',
    vol14dMedianUsd: '84px',
    volumeZScore: '66px',
    openInterestNotional: '104px',
    mmsQuoting: '58px',
    totalMmLiquidityUsd: '88px',
    spread14dBps: '64px',
    spread24hBps: '108px',
    depth100bps14dUsd: '80px',
    depth100bps24hUsd: '120px',
    slip10kBps14d: '64px',
    slip10kBps24h: '108px',
    slip100kBps14d: '64px',
    slip100kBps24h: '108px',
    listedOnCount: '72px',
    avgVolPerExchangeUsd: '104px',
    totalExternalVolumeUsd: '102px',
    trending24h: '62px',
    trending7d: '62px'
  };

  // Columns that are expanders / non-metric and must not trigger sorting.
  const NON_SORTABLE_COLUMNS = new Set<string>(['tradingHours']);

  // Trading sessions (fixed UTC, do NOT track US DST) — keys match /api/trading-hours/summary.
  // `wholeWeek` is intentionally omitted: we show the five live sessions only.
  const TRADING_SESSIONS: { key: TradingHoursSessionKey; label: string; utc: string }[] = [
    { key: 'overnight', label: 'Overnight', utc: 'Mon-Fri 00:00-08:00 UTC' },
    { key: 'premarket', label: 'Premarket', utc: 'Mon-Fri 08:00-13:30 UTC' },
    { key: 'regularTrading', label: 'Regular Trading', utc: 'Mon-Fri 13:30-20:00 UTC' },
    { key: 'extendedAfterHours', label: 'Extended / After-hours', utc: 'Mon-Fri 20:00-00:00 UTC' },
    { key: 'weekendClosed', label: 'Weekend closed', utc: 'Sat 00:00-Mon 00:00 UTC' }
  ];

  interface TradingHoursSessionRow {
    key: TradingHoursSessionKey;
    label: string;
    utc: string;
    usd: number | null; // median (bid+ask) quoted USD, summed across MMs
    twoSidedMinutes: number | null;
    availableMinutes: number | null;
    relLiqPct: number | null; // this session's liquidity vs the busiest session (peak = 100%)
  }

  // Real per-session breakdown from /api/trading-hours/summary (last completed week).
  // `relLiqPct` is computed client-side: each session's quoted liquidity as a share of the
  // ticker's busiest session, so heavier vs lighter sessions read at a glance.
  // Returns [] when the ticker has no trading-hours row (cold start / zero-quoting ticker).
  function tradingHoursRows(ticker: string): TradingHoursSessionRow[] {
    const t = tradingHoursByTicker.get(ticker);
    if (!t) return [];
    const win = tradingHoursWindow;
    const peakUsd = TRADING_SESSIONS.reduce((max, s) => {
      const v = t.sessions[s.key]?.usd ?? null;
      return v != null && v > max ? v : max;
    }, 0);
    return TRADING_SESSIONS.map((s) => {
      const sess = t.sessions[s.key];
      const usd = sess?.usd ?? null;
      return {
        key: s.key,
        label: s.label,
        utc: s.utc,
        usd,
        twoSidedMinutes: sess?.twoSidedMinutes ?? null,
        availableMinutes: win?.sessions?.[s.key]?.available ?? null,
        relLiqPct: usd != null && peakUsd > 0 ? (usd / peakUsd) * 100 : null
      };
    });
  }

  interface TradingHoursSessionMmRow {
    mmSlug: string;
    displayName: string;
    usd: number | null;
    twoSidedMinutes: number | null;
    coveragePct: number | null; // this MM's own two-sided minutes / session available
  }

  // Per-MM breakdown for one ticker + session, from /api/trading-hours/detail.
  // Sorted by quoted liquidity descending (nulls last).
  function tradingHoursSessionMms(ticker: string, key: TradingHoursSessionKey): TradingHoursSessionMmRow[] {
    const t = tradingHoursDetailByTicker.get(ticker);
    if (!t) return [];
    const available = tradingHoursWindow?.sessions?.[key]?.available ?? null;
    return t.mms
      .map((mm) => {
        const sess = mm.sessions[key];
        const twoSided = sess?.twoSidedMinutes ?? null;
        return {
          mmSlug: mm.mmSlug,
          displayName: mm.displayName,
          usd: sess?.usd ?? null,
          twoSidedMinutes: twoSided,
          coveragePct: twoSided != null && available ? Math.min(100, (twoSided / available) * 100) : null
        };
      })
      .sort((a, b) => (b.usd ?? -Infinity) - (a.usd ?? -Infinity));
  }

  function toggleTradingHoursSession(ticker: string, key: TradingHoursSessionKey) {
    const id = `${ticker}::${key}`;
    openTradingHoursSession = openTradingHoursSession === id ? null : id;
  }

  function formatTib(ms: number | null | undefined): string {
    if (ms == null) return '-';
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
    return `${Math.round(ms)} ms`;
  }

  // Real time-in-book for this MM on this ticker (rolling last 24h). null = no repriced
  // population for this MM/ticker pair.
  function tibForMm(ticker: string, mmSlug: string): TibTicker | null {
    return tibByTickerMm.get(`${ticker}::${mmSlug}`) ?? null;
  }

  // Median repricing time (ms) the MM-liquidity panel shows; null when never repriced.
  function tibMedianMs(ticker: string, mmSlug: string): number | null {
    return tibForMm(ticker, mmSlug)?.repriced.medianMs ?? null;
  }

  function tibTitle(ticker: string, mmSlug: string): string {
    const t = tibForMm(ticker, mmSlug);
    if (!t || t.repriced.medianMs == null) {
      return 'No quote-update data for this MM on this ticker in the last 24h.';
    }
    return [
      `Median ${formatTib(t.repriced.medianMs)}  ·  p90 ${formatTib(t.repriced.p90Ms)}`,
      'How long this MM leaves an order before updating its quote.',
      'Median = a typical order; p90 = its slowest 10%.'
    ].join('\n');
  }

  let search = $state('');
  let statusFilter = $state('ACTIVE');
  let marketTypeFilter = $state('all');
  let contextFilter = $state('all');
  let sortKey = $state<SortKey>('openInterestNotional');
  let sortDir = $state<'asc' | 'desc'>('desc');
  let openVenueTicker = $state<string | null>(null);
  let openMmTicker = $state<string | null>(null);
  let openTradingHoursTicker = $state<string | null>(null);
  // Identifies the expanded session inside the trading-hours panel: `${ticker}::${sessionKey}`.
  let openTradingHoursSession = $state<string | null>(null);
  let refreshing = $state(false);
  let showColumnMenu = $state(false);
  let showFilterMenu = $state(false);
  let visibleColumns = $state<Record<ColumnId, boolean>>({ ...defaultVisibleColumns });
  let columnLoadSecondsLeft = $state(30);
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
  let selectedMmFilters = $state<string[]>([]);
  let showMmFilterMenu = $state(false);
  let mmFilterSearch = $state('');
  let preferencesLoaded = $state(false);
  let controlsRoot: HTMLDivElement;

  // Measured heights of the sticky layers, so each layer's top offset is the sum of
  // everything stacked above it — survives wrapping, zoom, and header changes.
  // --app-header-h is published by Header.svelte (44px fallback covers SSR).
  let controlsBarHeight = $state(0);
  let summaryBarHeight = $state(0);
  const summaryBarTop = $derived(`calc(var(--app-header-h, 44px) + ${controlsBarHeight}px)`);
  const tableHeadTop = $derived(`calc(var(--app-header-h, 44px) + ${controlsBarHeight + summaryBarHeight}px)`);

  const { data, error, isLoading, revalidate } = useSWR<OverviewResponse>(() => '/api/overview');
  const { data: mmQuotesData, error: mmQuotesError, revalidate: revalidateMmQuotes } = useSWR<MmQuotesOverviewResponse>(
    () => '/api/mm-quotes/overview',
    { refreshInterval: 60_000 }
  );
  const { data: pairDepthData, error: pairDepthError, revalidate: revalidatePairDepth } = useSWR<PairDepthOverviewResponse>(
    () => '/api/pairdepth/overview',
    { refreshInterval: 60_000, dedupingInterval: 30_000 }
  );
  const { data: mmDetailData, isLoading: mmDetailLoading, error: mmDetailError } = useSWR<MmQuotesDetailResponse>(
    () => '/api/mm-quotes/detail',
    { refreshInterval: 60_000, dedupingInterval: 30_000 }
  );

  const { data: tradingHoursData, error: tradingHoursError } = useSWR<TradingHoursSummaryResponse>(
    () => '/api/trading-hours/summary',
    { refreshInterval: 300_000, dedupingInterval: 300_000 }
  );
  const { data: tradingHoursDetailData, error: tradingHoursDetailError, isLoading: tradingHoursDetailLoading } =
    useSWR<TradingHoursDetailResponse>(() => '/api/trading-hours/detail', {
      refreshInterval: 300_000,
      dedupingInterval: 300_000
    });
  const { data: tibData, error: tibError, isLoading: tibLoading } = useSWR<TibDetailResponse>(
    () => '/api/time-in-book/detail',
    { refreshInterval: 60_000, dedupingInterval: 60_000 }
  );

  const mmDetailByTicker = $derived.by(() => {
    const map = new Map<string, MmQuotesDetailTicker>();
    for (const t of $mmDetailData?.data?.tickers ?? []) map.set(t.ticker, t);
    return map;
  });

  const tradingHoursByTicker = $derived.by(() => {
    const map = new Map<string, TradingHoursSummaryTicker>();
    for (const t of $tradingHoursData?.data ?? []) map.set(t.ticker, t);
    return map;
  });
  const tradingHoursWindow = $derived<TradingHoursWindow | null>($tradingHoursData?.meta?.window ?? null);
  const tradingHoursNote = $derived($tradingHoursData?.meta?.note ?? null);

  const tradingHoursDetailByTicker = $derived.by(() => {
    const map = new Map<string, TradingHoursDetailTicker>();
    for (const t of $tradingHoursDetailData?.data ?? []) map.set(t.ticker, t);
    return map;
  });

  // Per-ticker, per-MM time-in-book, keyed `${ticker}::${mmSlug}` to join onto the MM panel.
  const tibByTickerMm = $derived.by(() => {
    const map = new Map<string, TibTicker>();
    for (const mm of $tibData?.data?.mms ?? []) {
      for (const t of mm.tickers ?? []) map.set(`${t.ticker}::${mm.mmSlug}`, t);
    }
    return map;
  });

  const allMms = $derived.by(() => {
    const seen = new Map<string, { slug: string; name: string }>();
    for (const t of $mmDetailData?.data?.tickers ?? []) {
      for (const mm of t.mms) {
        if (!seen.has(mm.mmSlug)) seen.set(mm.mmSlug, { slug: mm.mmSlug, name: mm.displayName });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  const tickerMmSlugs = $derived.by(() => {
    const map = new Map<string, Set<string>>();
    for (const t of $mmDetailData?.data?.tickers ?? []) {
      map.set(t.ticker, new Set(t.mms.map((m) => m.mmSlug)));
    }
    return map;
  });

  const filteredMmFilterOptions = $derived.by(() => {
    const q = mmFilterSearch.trim().toLowerCase();
    if (!q) return allMms;
    return allMms.filter((m) => m.name.toLowerCase().includes(q) || m.slug.toLowerCase().includes(q));
  });

  const mmQuotesByTicker = $derived.by(() => {
    const map = new Map<string, { mmsCount: number; totalQuotedUsd: number; makerVolumeUsd: number; takerVolumeUsd: number }>();
    for (const t of $mmQuotesData?.data?.tickers ?? []) {
      map.set(t.ticker, {
        mmsCount: t.mmsCount,
        totalQuotedUsd: t.totalQuotedUsd,
        makerVolumeUsd: t.totalMakerVolumeUsd24h,
        takerVolumeUsd: t.totalTakerVolumeUsd24h
      });
    }
    return map;
  });

  const pairDepthByTicker = $derived.by(() => {
    const map = new Map<string, PairDepthOverviewTicker>();
    for (const t of $pairDepthData?.data?.tickers ?? []) map.set(t.ticker, t);
    return map;
  });

  const rows = $derived(
    ($data?.data.rows ?? []).map((row) => {
      const mmq = mmQuotesByTicker.get(row.ticker);
      const pd = pairDepthByTicker.get(row.ticker);
      return {
        ...row,
        mmsQuoting: mmq?.mmsCount ?? null,
        totalMmLiquidityUsd: mmq?.totalQuotedUsd ?? null,
        mmMakerVolumeUsd24h: mmq?.makerVolumeUsd ?? null,
        mmTakerVolumeUsd24h: mmq?.takerVolumeUsd ?? null,
        vol14dMedianUsd: pd?.vol14dMedianUsd ?? null,
        spread14dBps: pd?.spread14dBps ?? null,
        spread24hBps: pd?.spread24hBps ?? null,
        spreadDeltaPct: pd?.spreadDeltaPct ?? null,
        depth100bps14dUsd: pd?.depth100bps14dUsd ?? null,
        depth100bps24hUsd: pd?.depth100bps24hUsd ?? null,
        depth100bpsDeltaPct: pd?.depth100bpsDeltaPct ?? null,
        slip10kBps14d: pd?.slip10kBps14d ?? null,
        slip10kBps24h: pd?.slip10kBps24h ?? null,
        slip10kDeltaPct: pd?.slip10kDeltaPct ?? null,
        slip100kBps14d: pd?.slip100kBps14d ?? null,
        slip100kBps24h: pd?.slip100kBps24h ?? null,
        slip100kDeltaPct: pd?.slip100kDeltaPct ?? null
      } as OverviewRow;
    })
  );
  const meta = $derived($data?.meta);
  const sideColumnsLoading = $derived(
    Boolean(
      $data &&
        ((!$mmQuotesData && !$mmQuotesError) ||
          (!$pairDepthData && !$pairDepthError) ||
          (!$mmDetailData && !$mmDetailError))
    )
  );
  const sideColumnsUnavailable = $derived(
    Boolean($mmQuotesError || $pairDepthError || $mmDetailError || $mmQuotesData?.error || $pairDepthData?.error || $mmDetailData?.error)
  );
  const overviewWarnings = $derived(meta?.warnings ?? []);

  $effect(() => {
    if (!sideColumnsLoading) {
      columnLoadSecondsLeft = 30;
      return;
    }

    columnLoadSecondsLeft = 30;
    const timer = window.setInterval(() => {
      columnLoadSecondsLeft = Math.max(0, columnLoadSecondsLeft - 1);
    }, 1000);

    return () => window.clearInterval(timer);
  });

  const visibleDataColumns = $derived(columns.filter((col) => visibleColumns[col.key] !== false));
  const visibleColumnCount = $derived(visibleDataColumns.length);
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

    addRange('Vol 14d med', minVolume24h, maxVolume24h);
    addRange('Open Interest', minOpenInterest, maxOpenInterest);
    addRange('Listed On', minListedOn, maxListedOn);
    addRange('Vol Z', minVolumeZScore, maxVolumeZScore);
    addRange('Avg Vol / Exch', minAvgVolPerExchange, maxAvgVolPerExchange);
    addRange('External Vol', minExternalVolume, maxExternalVolume);

    if (trending24hFilter !== 'any') labels.push(`Trend 24h: ${trending24hFilter}`);
    if (trending7dFilter !== 'any') labels.push(`Trend 7d: ${trending7dFilter}`);

    if (selectedMmFilters.length > 0) {
      const names = selectedMmFilters.map((v) => {
        if (v === MM_FILTER_NONE) return '(No MMs)';
        return allMms.find((m) => m.slug === v)?.name ?? v;
      });
      labels.push(`MMs: ${names.join(', ')}`);
    }

    return labels;
  });

  onMount(() => {
    const closeMenus = () => {
      showFilterMenu = false;
      showMmFilterMenu = false;
      showColumnMenu = false;
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!controlsRoot || controlsRoot.contains(event.target as Node)) return;
      closeMenus();
    };

    window.addEventListener('keydown', onKeydown);
    window.addEventListener('pointerdown', onPointerDown);

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
      if (Array.isArray(savedFilters.selectedMmFilters)) {
        selectedMmFilters = savedFilters.selectedMmFilters.filter((v) => typeof v === 'string');
      }
    }

    preferencesLoaded = true;

    return () => {
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  });

  onDestroy(() => {
    showFilterMenu = false;
    showMmFilterMenu = false;
    showColumnMenu = false;
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
    await Promise.all([revalidate(), revalidateMmQuotes(), revalidatePairDepth(), minDelay]);
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
      trending7dFilter,
      selectedMmFilters
    };
  }

  function toggleMmFilter(value: string) {
    selectedMmFilters = selectedMmFilters.includes(value)
      ? selectedMmFilters.filter((v) => v !== value)
      : [...selectedMmFilters, value];
  }

  function clearMmFilters() {
    selectedMmFilters = [];
    mmFilterSearch = '';
  }

  function toggleFilterMenu() {
    showFilterMenu = !showFilterMenu;
    if (showFilterMenu) {
      showMmFilterMenu = false;
      showColumnMenu = false;
    }
  }

  function toggleMmFilterMenu() {
    showMmFilterMenu = !showMmFilterMenu;
    if (showMmFilterMenu) {
      showFilterMenu = false;
      showColumnMenu = false;
    }
  }

  function toggleColumnMenu() {
    showColumnMenu = !showColumnMenu;
    if (showColumnMenu) {
      showFilterMenu = false;
      showMmFilterMenu = false;
    }
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

  function cellPaddingClass(key: string): string {
    if (key === 'ticker') return 'pl-2 pr-1';
    if (key === 'vol14dMedianUsd') return 'pl-1 pr-2';
    return 'px-2';
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

    if (selectedMmFilters.length > 0) {
      const wantNone = selectedMmFilters.includes(MM_FILTER_NONE);
      const wantSlugs = selectedMmFilters.filter((s) => s !== MM_FILTER_NONE);
      result = result.filter((row) => {
        const mms = tickerMmSlugs.get(row.ticker);
        const hasNoMms = !mms || mms.size === 0;
        if (wantNone && hasNoMms) return true;
        if (wantSlugs.length > 0 && mms && wantSlugs.some((s) => mms.has(s))) return true;
        return false;
      });
    }

    result = result.filter(
      (row) =>
        matchesRange(row.vol14dMedianUsd, minVolume24h, maxVolume24h) &&
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

  // Platform totals (client-side) over the currently filtered set, shown inline in the grey bar.
  const totalVol14dMedian = $derived(filtered.reduce((sum, row) => sum + (row.vol14dMedianUsd ?? 0), 0));
  const totalOpenInterest = $derived(filtered.reduce((sum, row) => sum + (row.openInterestNotional ?? 0), 0));

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

  function formatBps(value: number | null | undefined): string {
    if (value == null) return '-';
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
    return `${value.toFixed(digits)}`;
  }

  function formatDeltaPct(value: number | null | undefined): string {
    if (value == null) return '';
    const abs = Math.abs(value);
    const digits = abs >= 100 ? 0 : 1;
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(digits)}%`;
  }

  // direction: 'worseUp' = positive delta is bad (red), 'betterUp' = positive delta is good (green)
  function deltaClass(value: number | null | undefined, direction: 'worseUp' | 'betterUp'): string {
    if (value == null) return 'text-zinc-600';
    if (Math.abs(value) < 0.5) return 'text-zinc-500';
    const positiveIsGood = direction === 'betterUp';
    const good = (value > 0) === positiveIsGood;
    return good ? 'text-emerald-300' : 'text-red-300';
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

  function toggleMmTable(row: OverviewRow) {
    if (row.mmsQuoting == null) return;
    openMmTicker = openMmTicker === row.ticker ? null : row.ticker;
  }

  function toggleTradingHours(row: OverviewRow) {
    openTradingHoursTicker = openTradingHoursTicker === row.ticker ? null : row.ticker;
    openTradingHoursSession = null;
  }

  function formatUptime(value: number | null | undefined): string {
    if (value == null) return '-';
    return `${value.toFixed(1)}%`;
  }

  function uptimeClass(value: number | null | undefined): string {
    if (value == null) return 'text-zinc-500';
    if (value >= 95) return 'text-emerald-300';
    if (value >= 75) return 'text-amber-300';
    if (value >= 50) return 'text-orange-300';
    return 'text-red-300';
  }

  function mmShare(mm: MmQuotesDetailMm, ticker: MmQuotesDetailTicker): number | null {
    if (ticker.totalQuotedUsd <= 0) return null;
    return (mm.totalQuotedUsd / ticker.totalQuotedUsd) * 100;
  }

  function bidAskSplitPct(mm: MmQuotesDetailMm): { bid: number; ask: number } | null {
    const bid = mm.bidQuotedUsd ?? 0;
    const ask = mm.askQuotedUsd ?? 0;
    const total = bid + ask;
    if (total <= 0) return null;
    return { bid: (bid / total) * 100, ask: (ask / total) * 100 };
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

  :global(.overview-sticky-solid) {
    background: #09090b;
    box-shadow: 0 1px 0 #27272a;
  }

  :global(.overview-table-head) {
    background: #18181b;
    box-shadow: 0 1px 0 #27272a;
  }

  :global(.overview-toolbar-sticky) {
    position: sticky;
  }

  :global(.overview-toolbar-sticky::before) {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: -24px;
    height: 24px;
    background: #09090b;
  }
</style>

<PageShell wide>
  <div class="mb-5">
    <h1 class="text-2xl font-semibold text-zinc-100">Market Overview</h1>
  </div>

  <div bind:this={controlsRoot} bind:offsetHeight={controlsBarHeight} class="overview-toolbar-sticky top-[var(--app-header-h,44px)] z-30 -mx-6 bg-zinc-950 px-6 py-3">
  <div class="rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-sm shadow-black/20">
  <div class="flex flex-wrap items-center gap-3">
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
        aria-expanded={showFilterMenu}
        onclick={toggleFilterMenu}
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
                  <div class="mb-1 text-[11px] text-zinc-400">Vol 14d med</div>
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
        class="overview-control rounded border border-zinc-700 bg-zinc-900 font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800 {selectedMmFilters.length > 0 ? 'border-violet-500/40 bg-violet-500/15 text-violet-300' : ''}"
        aria-expanded={showMmFilterMenu}
        onclick={toggleMmFilterMenu}
      >
        MMs{selectedMmFilters.length > 0 ? ` (${selectedMmFilters.length})` : ''}
      </button>

      {#if showMmFilterMenu}
        <div class="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
          <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
            <div>
              <div class="text-xs font-semibold text-zinc-100">Filter by MM</div>
              <div class="text-[11px] text-zinc-500">Show tickers quoted by any selected MM. Default shows all.</div>
            </div>
            <button class="text-[11px] font-medium text-violet-300 hover:text-violet-200 disabled:opacity-40" disabled={selectedMmFilters.length === 0} onclick={clearMmFilters}>Clear</button>
          </div>

          <div class="border-b border-zinc-800 px-2 py-2">
            <input
              type="text"
              bind:value={mmFilterSearch}
              placeholder="Search MM..."
              class="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div class="max-h-[360px] overflow-y-auto p-2">
            <label class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900/80">
              <span class="italic text-zinc-400">(No MM data)</span>
              <input
                type="checkbox"
                checked={selectedMmFilters.includes(MM_FILTER_NONE)}
                onchange={() => toggleMmFilter(MM_FILTER_NONE)}
                class="h-3.5 w-3.5 accent-violet-500"
              />
            </label>
            {#if allMms.length === 0}
              <div class="px-2 py-3 text-center text-[11px] text-zinc-500">Loading MM list...</div>
            {:else if filteredMmFilterOptions.length === 0}
              <div class="px-2 py-3 text-center text-[11px] text-zinc-500">No MMs match "{mmFilterSearch}".</div>
            {:else}
              {#each filteredMmFilterOptions as mm (mm.slug)}
                <label class="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900/80">
                  <span class="flex items-center gap-2">
                    <span>{mm.name}</span>
                    <span class="text-[10px] text-zinc-600 mono">{mm.slug}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedMmFilters.includes(mm.slug)}
                    onchange={() => toggleMmFilter(mm.slug)}
                    class="h-3.5 w-3.5 accent-violet-500"
                  />
                </label>
              {/each}
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <div class="relative">
      <button
        class="overview-control rounded border border-zinc-700 bg-zinc-900 font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
        aria-expanded={showColumnMenu}
        onclick={toggleColumnMenu}
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

  </div>
  </div>

  {#if !browser || $isLoading}
    <LoadingSpinner />
  {:else if $error}
    <ErrorBanner message="Failed to load overview data" />
  {:else}
    <!-- min-[1100px] = table min-width (1040px) + page padding. Above it the wrapper must be
         overflow-visible: any overflow-x-auto ancestor disables viewport-sticky for the
         summary bar and thead, even when nothing actually overflows. -->
    <div class="relative overflow-x-auto min-[1100px]:overflow-visible">
      {#if refreshing}
        <div class="absolute inset-0 z-10 rounded-lg skeleton"></div>
      {/if}
      <div class="min-w-[1040px] min-[1100px]:min-w-0">
        <div class="overflow-clip rounded-lg border border-zinc-800">
          <div bind:offsetHeight={summaryBarHeight} style:top={summaryBarTop} class="overview-sticky-solid sticky z-20 flex flex-wrap items-center justify-between gap-2 border-y border-zinc-800 px-3 py-2 text-xs text-zinc-500">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="font-medium text-zinc-300">{statusHeading}</span>
              {#if sideColumnsLoading}
                <span class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300">
                  {#if columnLoadSecondsLeft > 0}
                    Loading column data · ~{columnLoadSecondsLeft}s
                  {:else}
                    Still loading column data
                  {/if}
                </span>
              {:else if sideColumnsUnavailable}
                <span class="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                  Some column data unavailable
                </span>
              {/if}
              {#if overviewWarnings.length}
                <span class="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200" title={overviewWarnings.join(' ')}>
                  Data warning
                </span>
              {/if}
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
            <div class="flex items-center gap-3 whitespace-nowrap">
              <span title="Sum of Vol 14d median across the filtered markets.">Total Vol 14d <span class="text-zinc-300 mono">{formatUsd(totalVol14dMedian)}</span></span>
              <span class="text-zinc-700">|</span>
              <span title="Sum of current open interest (notional) across the filtered markets.">Total OI <span class="text-zinc-300 mono">{formatUsd(totalOpenInterest)}</span></span>
              <span class="text-zinc-700">|</span>
              <span>{filtered.length} / {rows.length} markets</span>
            </div>
          </div>
          <table class="w-full table-fixed text-[12px]">
            <colgroup>
              {#each visibleDataColumns as col}
                <col style={`width: ${columnWidths[col.key] ?? '84px'}`} />
              {/each}
            </colgroup>
            <thead style:top={tableHeadTop} class="overview-table-head sticky z-10">
              <tr class="border-b border-zinc-800 bg-zinc-900">
                {#each visibleDataColumns as col}
                  {@const sortable = !NON_SORTABLE_COLUMNS.has(col.key)}
                  <th
                    class="select-none truncate bg-zinc-900 py-2.5 text-[11px] font-medium text-zinc-500 transition-colors {cellPaddingClass(col.key)} {sortable ? 'cursor-pointer hover:text-zinc-200' : 'cursor-default'} {cellAlignClass(col.align)}"
                    title={col.title}
                    onclick={() => sortable && toggleSort(col.key)}
                  >
                    {col.label}{sortable ? sortIndicator(col.key) : ''}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each filtered as row (row.clobPairId)}
                <tr class="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30 {row.status !== 'ACTIVE' ? 'opacity-60' : ''}">
                  {#each visibleDataColumns as col}
                    <td class="whitespace-nowrap py-2 {cellPaddingClass(col.key)} {cellAlignClass(col.align)} {col.key === 'ticker' ? 'truncate font-medium text-violet-300 mono' : ''}" title={col.key === 'ticker' ? row.ticker : undefined}>
                      {#if String(col.key) === 'tradingHours'}
                        <button
                          id={`trading-hours-toggle-${row.clobPairId}`}
                          class="inline-flex h-5 w-5 items-center justify-center rounded border text-[13px] leading-none transition-colors {openTradingHoursTicker === row.ticker ? 'border-violet-500/50 bg-violet-500/20 text-violet-300' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'}"
                          title="Per-session quoted liquidity & depth for {shortTicker(row.ticker)}"
                          aria-label="Toggle trading-hours breakdown"
                          aria-expanded={openTradingHoursTicker === row.ticker}
                          aria-controls={`trading-hours-panel-${row.clobPairId}`}
                          onclick={() => toggleTradingHours(row)}
                        >
                          {openTradingHoursTicker === row.ticker ? '−' : '+'}
                        </button>
                      {:else if col.key === 'marketType'}
                        <span class="inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold {typeClass(row.marketType)}">{row.marketType}</span>
                      {:else if col.key === 'ticker'}
                        {shortTicker(row.ticker)}
                      {:else if col.key === 'vol14dMedianUsd'}
                        {#if row.vol14dMedianUsd == null}
                          <span class="text-zinc-600 mono" title="No PairDepth daily volume data for this ticker.">-</span>
                        {:else}
                          <span class="text-zinc-100 mono" title={`14d median daily volume. Live 24h dYdX: ${formatUsd(row.volume24h)}`}>{formatUsd(row.vol14dMedianUsd)}</span>
                        {/if}
                      {:else if col.key === 'spread14dBps'}
                        {#if row.spread14dBps == null}
                          <span class="text-zinc-600 mono">-</span>
                        {:else}
                          <span class="text-zinc-100 mono">{formatBps(row.spread14dBps)}</span>
                        {/if}
                      {:else if col.key === 'spread24hBps'}
                        {#if row.spread24hBps == null}
                          <span class="text-zinc-600 mono">-</span>
                        {:else}
                          <span class="inline-flex items-baseline justify-end gap-1.5 mono" title={`24h ${formatBps(row.spread24hBps)} vs 14d ${formatBps(row.spread14dBps)}`}>
                            <span class="text-zinc-100">{formatBps(row.spread24hBps)}</span>
                            <span class="text-[10px] {deltaClass(row.spreadDeltaPct, 'worseUp')}">{formatDeltaPct(row.spreadDeltaPct)}</span>
                          </span>
                        {/if}
                      {:else if col.key === 'depth100bps14dUsd'}
                        {#if row.depth100bps14dUsd == null}
                          <span class="text-zinc-600 mono">-</span>
                        {:else}
                          <span class="text-zinc-100 mono">{formatUsd(row.depth100bps14dUsd)}</span>
                        {/if}
                      {:else if col.key === 'depth100bps24hUsd'}
                        {#if row.depth100bps24hUsd == null}
                          <span class="text-zinc-600 mono">-</span>
                        {:else}
                          <span class="inline-flex items-baseline justify-end gap-1.5 mono" title={`24h ${formatUsd(row.depth100bps24hUsd)} vs 14d ${formatUsd(row.depth100bps14dUsd)}`}>
                            <span class="text-zinc-100">{formatUsd(row.depth100bps24hUsd)}</span>
                            <span class="text-[10px] {deltaClass(row.depth100bpsDeltaPct, 'betterUp')}">{formatDeltaPct(row.depth100bpsDeltaPct)}</span>
                          </span>
                        {/if}
                      {:else if col.key === 'slip10kBps14d'}
                        {#if row.slip10kBps14d == null}
                          <span class="text-zinc-600 mono">-</span>
                        {:else}
                          <span class="text-zinc-100 mono">{formatBps(row.slip10kBps14d)}</span>
                        {/if}
                      {:else if col.key === 'slip10kBps24h'}
                        {#if row.slip10kBps24h == null}
                          <span class="text-zinc-600 mono">-</span>
                        {:else}
                          <span class="inline-flex items-baseline justify-end gap-1.5 mono" title={`24h ${formatBps(row.slip10kBps24h)} vs 14d ${formatBps(row.slip10kBps14d)}`}>
                            <span class="text-zinc-100">{formatBps(row.slip10kBps24h)}</span>
                            <span class="text-[10px] {deltaClass(row.slip10kDeltaPct, 'worseUp')}">{formatDeltaPct(row.slip10kDeltaPct)}</span>
                          </span>
                        {/if}
                      {:else if col.key === 'slip100kBps14d'}
                        {#if row.slip100kBps14d == null}
                          <span class="text-zinc-600 mono">-</span>
                        {:else}
                          <span class="text-zinc-100 mono">{formatBps(row.slip100kBps14d)}</span>
                        {/if}
                      {:else if col.key === 'slip100kBps24h'}
                        {#if row.slip100kBps24h == null}
                          <span class="text-zinc-600 mono">-</span>
                        {:else}
                          <span class="inline-flex items-baseline justify-end gap-1.5 mono" title={`24h ${formatBps(row.slip100kBps24h)} vs 14d ${formatBps(row.slip100kBps14d)}`}>
                            <span class="text-zinc-100">{formatBps(row.slip100kBps24h)}</span>
                            <span class="text-[10px] {deltaClass(row.slip100kDeltaPct, 'worseUp')}">{formatDeltaPct(row.slip100kDeltaPct)}</span>
                          </span>
                        {/if}
                      {:else if col.key === 'volumeZScore'}
                        <span class="inline-block min-w-12 rounded border px-1.5 py-0.5 text-center text-[10px] mono {zScoreClass(row)}" title={zScoreTitle(row)}>
                          {formatZScore(row.volumeZScore)}
                        </span>
                      {:else if col.key === 'openInterestNotional'}
                        <span class="text-zinc-100 mono">{formatUsd(row.openInterestNotional)}</span>
                      {:else if col.key === 'mmsQuoting'}
                        {#if row.mmsQuoting == null}
                          <span class="text-zinc-600 mono" title="No MM quote data for this ticker in the last 24h.">-</span>
                        {:else}
                          <button
                            class="text-right text-zinc-200 underline-offset-2 hover:text-violet-300 hover:underline mono"
                            title={`${row.mmsQuoting} MM group${row.mmsQuoting === 1 ? '' : 's'} quoted two-sided in the last 24h. Click for per-MM breakdown.`}
                            onclick={() => toggleMmTable(row)}
                          >
                            {row.mmsQuoting}
                          </button>
                        {/if}
                      {:else if col.key === 'totalMmLiquidityUsd'}
                        {#if row.totalMmLiquidityUsd == null}
                          <span class="text-zinc-600 mono" title="No MM quote data for this ticker in the last 24h.">-</span>
                        {:else}
                          <button
                            class="text-right text-zinc-100 underline-offset-2 hover:text-violet-300 hover:underline mono"
                            title={`Sum of typical depth across ${row.mmsQuoting ?? 0} MMs.\nMaker vol 24h: ${formatUsd(row.mmMakerVolumeUsd24h)}\nTaker vol 24h: ${formatUsd(row.mmTakerVolumeUsd24h)}\nClick for per-MM breakdown.`}
                            onclick={() => toggleMmTable(row)}
                          >
                            {formatUsd(row.totalMmLiquidityUsd)}
                          </button>
                        {/if}
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
                </tr>

                {#if openTradingHoursTicker === row.ticker}
                  {@const thTicker = tradingHoursByTicker.get(row.ticker)}
                  {@const thRows = tradingHoursRows(row.ticker)}
                  <tr class="border-b border-zinc-800/70 bg-zinc-800/30">
                    <td id={`trading-hours-panel-${row.clobPairId}`} colspan={visibleColumnCount} class="px-3 py-3">
                      <div class="w-full overflow-hidden rounded border border-zinc-700/80 bg-zinc-800/25 shadow-2xl shadow-black/40">
                        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
                          <div>
                            <div class="text-xs font-semibold text-zinc-100 mono">{shortTicker(row.ticker)} trading hours</div>
                            <div class="mt-0.5 text-[11px] text-zinc-500">
                              Median two-sided quoted liquidity &amp; coverage by UTC trading session{tradingHoursWindow ? ` · week ${tradingHoursWindow.label}` : ''}.
                            </div>
                          </div>
                          {#if thTicker}
                            <div class="text-right text-[11px]">
                              <div class="text-zinc-500">MMs quoting</div>
                              <div class="text-zinc-200 mono">{thTicker.mmsCount}</div>
                            </div>
                          {/if}
                        </div>

                        {#if $tradingHoursError || $tradingHoursData?.error}
                          <div class="px-3 py-4 text-center text-xs text-red-300">Failed to load trading-hours data.</div>
                        {:else if !$tradingHoursData}
                          <div class="px-3 py-4 text-center text-xs text-zinc-500">Loading trading hours...</div>
                        {:else if tradingHoursNote}
                          <div class="px-3 py-4 text-center text-xs text-zinc-500">Weekly trading-hours job has not produced data yet.</div>
                        {:else if thRows.length === 0}
                          <div class="px-3 py-4 text-center text-xs text-zinc-500">No two-sided quoting for this ticker in the last full week.</div>
                        {:else}
                          <div class="grid grid-cols-[0.3fr_1.3fr_1.6fr_1fr_1.6fr] border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-medium text-zinc-500">
                            <div></div>
                            <div>Session</div>
                            <div>UTC window</div>
                            <div class="text-right" title="Median (bid+ask) quoted USD over two-sided minutes, summed across MMs.">Quoted Liq</div>
                            <div class="text-right" title="This session's quoted liquidity vs the busiest session (peak = 100%).">Liq vs peak</div>
                          </div>

                          {#each thRows as session}
                            {@const sessionOpen = openTradingHoursSession === `${row.ticker}::${session.key}`}
                            <button
                              type="button"
                              class="grid w-full grid-cols-[0.3fr_1.3fr_1.6fr_1fr_1.6fr] items-center border-b border-zinc-800/60 px-3 py-1.5 text-left text-xs text-zinc-300 transition-colors last:border-b-0 hover:bg-zinc-800/40 {sessionOpen ? 'bg-violet-500/10' : ''}"
                              title="Show per-MM breakdown for {session.label}"
                              aria-expanded={sessionOpen}
                              onclick={() => toggleTradingHoursSession(row.ticker, session.key)}
                            >
                              <span class="text-[13px] leading-none {sessionOpen ? 'text-violet-300' : 'text-zinc-500'}">{sessionOpen ? '−' : '+'}</span>
                              <span class="truncate font-medium text-zinc-200">{session.label}</span>
                              <span class="truncate text-[11px] text-zinc-500">{session.utc}</span>
                              <span class="text-right text-zinc-100 mono">{session.usd == null ? '-' : formatUsd(session.usd)}</span>
                              <span class="block pl-4">
                                {#if session.relLiqPct == null}
                                  <span class="block text-right text-zinc-600 mono">-</span>
                                {:else}
                                  <span class="flex items-center gap-2">
                                    <span class="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                                      <span
                                        class="block h-full rounded-full {session.relLiqPct >= 80 ? 'bg-emerald-500' : session.relLiqPct >= 50 ? 'bg-violet-500' : 'bg-amber-500'}"
                                        style={`width: ${Math.min(100, Math.max(0, session.relLiqPct))}%`}
                                      ></span>
                                    </span>
                                    <span class="w-10 text-right text-[10px] text-zinc-400 mono">{session.relLiqPct.toFixed(0)}%</span>
                                  </span>
                                {/if}
                              </span>
                            </button>

                            {#if sessionOpen}
                              {@const sessionMms = tradingHoursSessionMms(row.ticker, session.key)}
                              {@const peerPeak = sessionMms.reduce((m, x) => (x.usd != null && x.usd > m ? x.usd : m), 0)}
                              <div class="border-b border-zinc-800/60 bg-zinc-950/40 px-3 py-2 last:border-b-0">
                                <div class="mb-1.5 text-[11px] font-medium text-zinc-400">{session.label} — per-MM quoting ({session.utc})</div>
                                {#if $tradingHoursDetailError || $tradingHoursDetailData?.error}
                                  <div class="py-2 text-center text-[11px] text-red-300">Failed to load per-MM breakdown.</div>
                                {:else if !$tradingHoursDetailData && $tradingHoursDetailLoading}
                                  <div class="py-2 text-center text-[11px] text-zinc-500">Loading per-MM breakdown...</div>
                                {:else if sessionMms.length === 0}
                                  <div class="py-2 text-center text-[11px] text-zinc-500">No MM quoted two-sided in this session.</div>
                                {:else}
                                  <div class="grid grid-cols-[1.6fr_1fr_1fr_1.6fr] border-b border-zinc-800/80 px-1 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                                    <div>MM</div>
                                    <div class="text-right">Quoted Liq</div>
                                    <div class="text-right" title="This MM's two-sided minutes ÷ available minutes in the session.">Coverage</div>
                                    <div class="pl-4 text-right" title="This MM's quoted liquidity vs the strongest MM in this session.">Share of session</div>
                                  </div>
                                  {#each sessionMms as mm}
                                    <div class="grid grid-cols-[1.6fr_1fr_1fr_1.6fr] items-center border-b border-zinc-800/40 px-1 py-1 text-[11px] text-zinc-300 last:border-b-0">
                                      <div class="truncate font-medium text-zinc-200 mono" title={mm.mmSlug}>{mm.displayName}</div>
                                      <div class="text-right text-zinc-100 mono">{mm.usd == null ? '-' : formatUsd(mm.usd)}</div>
                                      <div class="text-right mono {mm.coveragePct == null ? 'text-zinc-600' : mm.coveragePct >= 95 ? 'text-emerald-300' : mm.coveragePct >= 60 ? 'text-zinc-300' : 'text-amber-300'}" title={mm.twoSidedMinutes != null && session.availableMinutes != null ? `${mm.twoSidedMinutes} / ${session.availableMinutes} min two-sided` : ''}>
                                        {mm.coveragePct == null ? '-' : `${mm.coveragePct.toFixed(0)}%`}
                                      </div>
                                      <div class="pl-4">
                                        <div class="flex items-center gap-2">
                                          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                                            <div class="h-full rounded-full bg-violet-500" style={`width: ${peerPeak > 0 && mm.usd != null ? Math.min(100, (mm.usd / peerPeak) * 100) : 0}%`}></div>
                                          </div>
                                          <span class="w-10 text-right text-[10px] text-zinc-400 mono">{peerPeak > 0 && mm.usd != null ? `${((mm.usd / peerPeak) * 100).toFixed(0)}%` : '-'}</span>
                                        </div>
                                      </div>
                                    </div>
                                  {/each}
                                {/if}
                              </div>
                            {/if}
                          {/each}
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/if}

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

                {#if openMmTicker === row.ticker}
                  {@const detail = mmDetailByTicker.get(row.ticker)}
                  <tr class="border-b border-zinc-800/70 bg-zinc-800/30">
                    <td colspan={visibleColumnCount} class="px-3 py-3">
                      <div class="w-full overflow-hidden rounded border border-zinc-700/80 bg-zinc-800/25 shadow-2xl shadow-black/40">
                        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/80 px-3 py-2">
                          <div>
                            <div class="text-xs font-semibold text-zinc-100 mono">{shortTicker(row.ticker)} MM liquidity</div>
                            <div class="mt-0.5 text-[11px] text-zinc-500">
                              {row.mmsQuoting ?? 0} MM group{(row.mmsQuoting ?? 0) === 1 ? '' : 's'} quoting two-sided in the last 24h
                            </div>
                          </div>
                          <div class="grid grid-cols-3 gap-3 text-right text-[11px]">
                            <div>
                              <div class="text-zinc-500">Total quoted</div>
                              <div class="text-zinc-200 mono">{formatUsd(row.totalMmLiquidityUsd)}</div>
                            </div>
                            <div>
                              <div class="text-zinc-500">Maker vol</div>
                              <div class="text-zinc-200 mono">{formatUsd(row.mmMakerVolumeUsd24h)}</div>
                            </div>
                            <div>
                              <div class="text-zinc-500">Taker vol</div>
                              <div class="text-zinc-200 mono">{formatUsd(row.mmTakerVolumeUsd24h)}</div>
                            </div>
                          </div>
                        </div>

                        {#if !detail}
                          {#if $mmDetailError}
                            <div class="px-3 py-4 text-center text-xs text-red-300">Failed to load MM breakdown.</div>
                          {:else if $mmDetailLoading}
                            <div class="px-3 py-4 text-center text-xs text-zinc-500">Loading per-MM breakdown...</div>
                          {:else}
                            <div class="px-3 py-4 text-center text-xs text-zinc-500">No per-MM breakdown available for this ticker.</div>
                          {/if}
                        {:else}
                          <div class="grid grid-cols-[1.4fr_0.7fr_1fr_1fr_1fr_1.2fr_1fr_1fr_1.5fr] border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-medium text-zinc-500">
                            <div>MM</div>
                            <div class="text-right" title="twoSidedMinutes / 1440">Uptime</div>
                            <div class="text-right" title="Median bid depth across two-sided minutes (group-level)">Bid</div>
                            <div class="text-right" title="Median ask depth across two-sided minutes (group-level)">Ask</div>
                            <div class="text-right">Total Liq</div>
                            <div class="pl-4 text-right" title="This MM's quoted depth as a % of all tracked MMs' depth on this ticker (sums to ~100% across the MMs below).">% of MM Liq</div>
                            <div class="text-right" title="Maker fill volume in the last 24h (all wallets+subs in the group)">Maker</div>
                            <div class="text-right" title="Taker fill volume in the last 24h">Taker</div>
                            <div class="text-right" title="How long this MM typically leaves an order before updating its quote, on this ticker (last 24h). Shown as median / p90.">Time in Book (Median / p90)</div>
                          </div>

                          {#each detail.mms as mm}
                            {@const share = mmShare(mm, detail)}
                            {@const split = bidAskSplitPct(mm)}
                            {@const tib = tibForMm(row.ticker, mm.mmSlug)}
                            <div class="grid grid-cols-[1.4fr_0.7fr_1fr_1fr_1fr_1.2fr_1fr_1fr_1.5fr] items-center border-b border-zinc-800/60 px-3 py-1.5 text-xs text-zinc-300 last:border-b-0">
                              <div class="truncate font-medium text-zinc-200 mono" title={mm.mmSlug}>{mm.displayName}</div>
                              <div class="text-right mono {uptimeClass(mm.uptimePct)}" title={`${mm.twoSidedMinutes} / 1440 two-sided minutes`}>{formatUptime(mm.uptimePct)}</div>
                              <div class="text-right text-zinc-200 mono" title={split ? `${split.bid.toFixed(0)}% of own quoted depth` : ''}>{formatUsd(mm.bidQuotedUsd)}</div>
                              <div class="text-right text-zinc-200 mono" title={split ? `${split.ask.toFixed(0)}% of own quoted depth` : ''}>{formatUsd(mm.askQuotedUsd)}</div>
                              <div class="text-right text-zinc-100 mono">{formatUsd(mm.totalQuotedUsd)}</div>
                              <div class="pl-4">
                                <div class="flex items-center gap-2">
                                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                                    <div class="h-full rounded-full bg-violet-500" style={`width: ${Math.min(100, Math.max(0, share ?? 0))}%`}></div>
                                  </div>
                                  <span class="w-10 text-right text-[10px] text-zinc-400 mono">{formatShare(share)}</span>
                                </div>
                              </div>
                              <div class="text-right text-zinc-300 mono">{formatUsd(mm.makerVolumeUsd24h)}</div>
                              <div class="text-right {mm.takerVolumeUsd24h > 0 ? 'text-amber-300' : 'text-zinc-500'} mono">{formatUsd(mm.takerVolumeUsd24h)}</div>
                              <div class="text-right mono" title={tibTitle(row.ticker, mm.mmSlug)}>
                                {#if tib && tib.repriced.medianMs != null}
                                  <span class="text-zinc-200">{formatTib(tib.repriced.medianMs)}</span>
                                  <span class="ml-1 text-[10px] text-zinc-500">/ {formatTib(tib.repriced.p90Ms)}</span>
                                {:else if !$tibData && !$tibError && $tibLoading}
                                  <span class="text-zinc-600">…</span>
                                {:else}
                                  <span class="text-zinc-600">-</span>
                                {/if}
                              </div>
                            </div>
                          {/each}
                        {/if}
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
