import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMmBySlug } from '$lib/config/mms';
import type { FillTickerRow, FillsTimePoint, FillsApiResponse } from '$lib/features/fills/types';

const PAGE_LIMIT = 500;
const MAX_PAGES = 20;

interface IndexerFill {
  id: string;
  side: 'BUY' | 'SELL';
  liquidity: 'MAKER' | 'TAKER';
  type: string;
  market: string;
  price: string;
  size: string;
  fee: string;
  createdAt: string;
  subaccountNumber: number;
}

interface IndexerFillsResponse {
  fills: IndexerFill[];
}

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

async function fetchSubaccountFills(
  address: string,
  subaccountNumber: number,
  from: string,
  to: string,
  signal: AbortSignal
): Promise<{ fills: IndexerFill[]; isCapped: boolean }> {
  const fills: IndexerFill[] = [];
  const seen = new Set<string>();
  let isCapped = false;
  let createdBeforeOrAt = `${to}T23:59:59.999Z`;
  const fromTs = `${from}T00:00:00.000Z`;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL('https://indexer.dydx.trade/v4/fills');
    url.searchParams.set('address', address);
    url.searchParams.set('subaccountNumber', String(subaccountNumber));
    url.searchParams.set('limit', String(PAGE_LIMIT));
    url.searchParams.set('createdBeforeOrAt', createdBeforeOrAt);

    const res = await fetch(url.toString(), { signal });
    if (!res.ok) {
      throw new Error(`Indexer returned ${res.status} for subaccount ${subaccountNumber}`);
    }

    const body: IndexerFillsResponse = await res.json();
    if (!body.fills || body.fills.length === 0) break;

    // Deduplicate and filter to range
    for (const fill of body.fills) {
      if (!seen.has(fill.id) && fill.createdAt >= fromTs) {
        seen.add(fill.id);
        fills.push(fill);
      }
    }

    const oldest = body.fills[body.fills.length - 1];

    // Stop if we've gone past the from boundary
    if (oldest.createdAt < fromTs) break;

    // Stop if page was not full (no more data)
    if (body.fills.length < PAGE_LIMIT) break;

    // Hit page cap
    if (page === MAX_PAGES - 1) {
      isCapped = true;
      break;
    }

    // Advance cursor
    createdBeforeOrAt = oldest.createdAt;
  }

  return { fills, isCapped };
}

export const GET: RequestHandler = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';

  if (!slug) throw error(400, 'Missing slug');
  if (!from || !to) throw error(400, 'Missing from/to');

  const mm = getMmBySlug(slug);
  if (!mm) throw error(404, `Unknown slug: ${slug}`);

  const subaccounts = mm.subaccounts ?? [];
  if (subaccounts.length === 0) throw error(400, `No subaccounts configured for ${slug}`);

  const signal = AbortSignal.timeout(60_000);

  try {
    const results = await Promise.all(
      subaccounts.map((subNum) => fetchSubaccountFills(mm.address, subNum, from, to, signal))
    );

    let allFills: IndexerFill[] = [];
    let isCapped = false;
    for (const result of results) {
      allFills = allFills.concat(result.fills);
      if (result.isCapped) isCapped = true;
    }

    // Determine bucket mode
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    const useHourly = diffDays <= 7;

    // Aggregate
    const tickerMap = new Map<string, FillTickerRow>();
    const timeMap = new Map<string, FillsTimePoint>();

    for (const fill of allFills) {
      const volume = parseFloat(fill.price) * parseFloat(fill.size);
      const fee = parseFloat(fill.fee);
      const isMaker = fill.liquidity === 'MAKER';

      // byTicker
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

      // timeSeries
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

    const response: FillsApiResponse = { from, to, isCapped, summary, byTicker, timeSeries };
    return json(response);
  } catch (e) {
    return json({ error: String(e) }, { status: 502 });
  }
};
