import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const DYDX_MARKETS_URL = 'https://indexer.dydx.trade/v4/perpetualMarkets';

let cache: { data: unknown; ts: number } | null = null;
const TTL_MS = 15_000;

export const GET: RequestHandler = async ({ fetch }) => {
  const now = Date.now();
  if (cache && now - cache.ts < TTL_MS) {
    return json(cache.data);
  }

  const res = await fetch(DYDX_MARKETS_URL);
  if (!res.ok) {
    return json({ error: 'Failed to fetch dYdX markets' }, { status: 502 });
  }

  const raw = await res.json();
  const markets = raw.markets ?? {};

  const rows = Object.values(markets).map((m: any) => {
    const oraclePrice = parseFloat(m.oraclePrice) || 0;
    const volume24h = parseFloat(m.volume24H) || 0;
    const openInterest = parseFloat(m.openInterest) || 0;
    const trades24h = parseInt(m.trades24H, 10) || 0;
    const nextFundingRate = parseFloat(m.nextFundingRate) || 0;
    const tickSize = parseFloat(m.tickSize) || 0;
    const initialMarginFraction = parseFloat(m.initialMarginFraction) || 0;

    return {
      clobPairId: m.clobPairId,
      ticker: m.ticker,
      status: m.status,
      marketType: m.marketType,
      oraclePrice,
      volume24h,
      openInterestNotional: openInterest * oraclePrice,
      trades24h,
      nextFundingRate: nextFundingRate !== 0 ? nextFundingRate : null,
      tickSize: m.tickSize,
      tickSpreadBps: oraclePrice > 0 ? (tickSize / oraclePrice) * 10000 : null,
      priceChange24H: parseFloat(m.priceChange24H) || 0,
      maxLeverage: initialMarginFraction > 0 ? 1 / initialMarginFraction : null,
      stepSize: m.stepSize as string
    };
  });

  cache = { data: rows, ts: now };
  return json(rows);
};
