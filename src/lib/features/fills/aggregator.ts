/**
 * Client-side aggregation of raw IndexerFill records.
 *
 * Mirrors the server logic that was previously in /api/fills/+server.ts.
 * Keeping aggregation here means you can change metrics without re-fetching
 * from the indexer — just clear the IndexedDB cache and recompute.
 */

import type { FillsApiResponse, FillTickerRow, FillsTimePoint, IndexerFill } from './types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function hourBucket(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00:00.000Z`;
}

function dayBucket(isoStr: string): string {
  return isoStr.slice(0, 10);
}

export function aggregateFills(
  fills: IndexerFill[],
  from: string,
  to: string,
  isCapped: boolean
): FillsApiResponse {
  const diffDays =
    (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
  const useHourly = diffDays <= 7;

  const tickerMap = new Map<string, FillTickerRow>();
  const timeMap = new Map<string, FillsTimePoint>();

  for (const fill of fills) {
    const volume = parseFloat(fill.price) * parseFloat(fill.size);
    const fee = parseFloat(fill.fee);
    const isMaker = fill.liquidity === 'MAKER';

    // ── byTicker ───────────────────────────────────────────────────────────
    if (!tickerMap.has(fill.market)) {
      tickerMap.set(fill.market, {
        ticker: fill.market,
        makerVolume: 0, takerVolume: 0, totalVolume: 0,
        makerFees: 0, takerFees: 0, netFees: 0,
        makerFillCount: 0, takerFillCount: 0, totalFillCount: 0
      });
    }
    const tr = tickerMap.get(fill.market)!;
    tr.totalVolume += volume;
    tr.netFees += fee;
    tr.totalFillCount += 1;
    if (isMaker) {
      tr.makerVolume += volume;
      tr.makerFees += fee;
      tr.makerFillCount += 1;
    } else {
      tr.takerVolume += volume;
      tr.takerFees += fee;
      tr.takerFillCount += 1;
    }

    // ── timeSeries ─────────────────────────────────────────────────────────
    const bucket = useHourly ? hourBucket(fill.createdAt) : dayBucket(fill.createdAt);
    if (!timeMap.has(bucket)) {
      timeMap.set(bucket, { ts: bucket, makerVolume: 0, takerVolume: 0, netFees: 0, fillCount: 0 });
    }
    const tp = timeMap.get(bucket)!;
    tp.netFees += fee;
    tp.fillCount += 1;
    if (isMaker) tp.makerVolume += volume;
    else tp.takerVolume += volume;
  }

  const byTicker = [...tickerMap.values()].sort((a, b) => b.totalVolume - a.totalVolume);
  const timeSeries = [...timeMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  const summary = {
    totalVolume: byTicker.reduce((s, r) => s + r.totalVolume, 0),
    makerVolume: byTicker.reduce((s, r) => s + r.makerVolume, 0),
    takerVolume: byTicker.reduce((s, r) => s + r.takerVolume, 0),
    netFees: byTicker.reduce((s, r) => s + r.netFees, 0),
    makerFees: byTicker.reduce((s, r) => s + r.makerFees, 0),
    takerFees: byTicker.reduce((s, r) => s + r.takerFees, 0),
    fillCount: byTicker.reduce((s, r) => s + r.totalFillCount, 0)
  };

  return { from, to, isCapped, summary, byTicker, timeSeries };
}
