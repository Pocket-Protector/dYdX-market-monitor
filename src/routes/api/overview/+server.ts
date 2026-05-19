import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';

const DYDX_MARKETS_URL = 'https://indexer.dydx.trade/v4/perpetualMarkets';
const CACHE_TTL_MS = 60_000;

interface DydxMarket {
  clobPairId: string;
  ticker: string;
  status: string;
  marketType: string;
  oraclePrice: string;
  volume24H: string;
  trades24H: number | string;
  nextFundingRate?: string;
  initialMarginFraction?: string;
  openInterest: string;
  priceChange24H?: string;
}

interface ExchangeVolume {
  exchangeId: string;
  exchangeName: string;
  h24VolumeUsd: number | null;
  pctOfTotal: number | null;
}

interface CoinGeckoTickerContext {
  dydxTicker: string;
  listedOnCount: number;
  listedOnExchanges: string[];
  totalVolUsd: number | null;
  avgVolPerExchangeUsd: number | null;
  exchangeVolumes: ExchangeVolume[];
  trending24h: boolean;
  trending7d: boolean;
}

interface CoinGeckoMarketContextResponse {
  meta?: {
    snapshotDate?: string | null;
    trendingAsOf?: string | null;
    warnings?: string[];
  };
  data?: {
    tickers?: CoinGeckoTickerContext[];
  };
  error?: string | null;
}

interface VolumeSignal {
  ticker: string;
  samples7d: number;
  windowStart: string | null;
  windowEnd: string | null;
  medianVolume7d: number | null;
  meanVolume7d: number | null;
  stddevVolume7d: number | null;
  madVolume7d: number | null;
  ready: boolean;
}

interface VolumeSignalsResponse {
  data?: {
    tickers?: VolumeSignal[];
  };
  error?: string | null;
}

let cache: { data: unknown; ts: number } | null = null;

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function robustZScore(current: number, signal: VolumeSignal | undefined): number | null {
  if (!signal || !signal.ready || signal.medianVolume7d == null || signal.madVolume7d == null) return null;
  if (signal.samples7d < 7 || signal.madVolume7d <= 0) return null;
  return (0.6745 * (current - signal.medianVolume7d)) / signal.madVolume7d;
}

export const GET: RequestHandler = async ({ fetch }) => {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) {
    return json(cache.data);
  }

  const warnings: string[] = [];

  const [dydxResult, contextResult, volumeSignalsResult] = await Promise.allSettled([
    fetch(DYDX_MARKETS_URL),
    apiFetch('/api/coingecko/market-context', undefined, { cacheTtlMs: 5 * 60_000 }),
    apiFetch('/api/market-volume-signals', undefined, { cacheTtlMs: 15 * 60_000 })
  ]);

  if (dydxResult.status === 'rejected' || !dydxResult.value.ok) {
    const detail =
      dydxResult.status === 'rejected' ? String(dydxResult.reason) : await dydxResult.value.text();
    return json({ error: `Failed to fetch dYdX markets: ${detail}` }, { status: 502 });
  }

  let contextByTicker = new Map<string, CoinGeckoTickerContext>();
  let volumeSignalByTicker = new Map<string, VolumeSignal>();
  let coingeckoMeta: CoinGeckoMarketContextResponse['meta'] | null = null;

  if (contextResult.status === 'fulfilled') {
    const context = contextResult.value as CoinGeckoMarketContextResponse;
    coingeckoMeta = context.meta ?? null;
    contextByTicker = new Map(
      (context.data?.tickers ?? []).map((tickerContext) => [tickerContext.dydxTicker, tickerContext])
    );
    warnings.push(...(context.meta?.warnings ?? []));
    if (context.error) warnings.push(context.error);
  } else {
    warnings.push(`CoinGecko market context unavailable: ${String(contextResult.reason)}`);
  }

  if (volumeSignalsResult.status === 'fulfilled') {
    const volumeSignals = volumeSignalsResult.value as VolumeSignalsResponse;
    volumeSignalByTicker = new Map(
      (volumeSignals.data?.tickers ?? []).map((signal) => [signal.ticker, signal])
    );
    if (volumeSignals.error) warnings.push(volumeSignals.error);
  }

  const raw = (await dydxResult.value.json()) as { markets?: Record<string, DydxMarket> };
  const markets = raw.markets ?? {};

  const rows = Object.values(markets).map((market) => {
    const oraclePrice = toNumber(market.oraclePrice);
    const openInterest = toNumber(market.openInterest);
    const initialMarginFraction = toNumber(market.initialMarginFraction);
    const context = contextByTicker.get(market.ticker);
    const volume24h = toNumber(market.volume24H);
    const volumeSignal = volumeSignalByTicker.get(market.ticker);

    return {
      clobPairId: market.clobPairId,
      ticker: market.ticker,
      status: market.status,
      marketType: market.marketType,
      oraclePrice,
      volume24h,
      volumeMedian7d: volumeSignal?.medianVolume7d ?? null,
      volumeMean7d: volumeSignal?.meanVolume7d ?? null,
      volumeStddev7d: volumeSignal?.stddevVolume7d ?? null,
      volumeMad7d: volumeSignal?.madVolume7d ?? null,
      volumeSamples7d: volumeSignal?.samples7d ?? 0,
      volumeBaselineWindowStart: volumeSignal?.windowStart ?? null,
      volumeBaselineWindowEnd: volumeSignal?.windowEnd ?? null,
      volumeZScore: robustZScore(volume24h, volumeSignal),
      volumeZScoreReady: Boolean(volumeSignal?.ready),
      trades24h: Math.trunc(toNumber(market.trades24H)),
      openInterestNotional: openInterest * oraclePrice,
      nextFundingRate: Number.isFinite(toNumber(market.nextFundingRate)) ? toNumber(market.nextFundingRate) : null,
      priceChange24h: toNumber(market.priceChange24H),
      maxLeverage: initialMarginFraction > 0 ? 1 / initialMarginFraction : null,
      listedOnCount: context?.listedOnCount ?? null,
      listedOnExchanges: context?.listedOnExchanges ?? [],
      totalExternalVolumeUsd: context?.totalVolUsd ?? null,
      avgVolPerExchangeUsd: context?.avgVolPerExchangeUsd ?? null,
      exchangeVolumes: context?.exchangeVolumes ?? [],
      trending24h: context?.trending24h ?? false,
      trending7d: context?.trending7d ?? false,
      hasCoinGeckoContext: Boolean(context)
    };
  });

  rows.sort((a, b) => b.openInterestNotional - a.openInterestNotional || a.ticker.localeCompare(b.ticker));

  const payload = {
    meta: {
      endpoint: '/api/overview',
      generatedAt: new Date().toISOString(),
      coingeckoSnapshotDate: coingeckoMeta?.snapshotDate ?? null,
      coingeckoTrendingAsOf: coingeckoMeta?.trendingAsOf ?? null,
      warnings
    },
    data: {
      rows
    },
    error: null
  };

  cache = { data: payload, ts: now };
  return json(payload);
};
