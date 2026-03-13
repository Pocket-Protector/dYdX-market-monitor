/**
 * Thin proxy: paginates the dYdX indexer and returns RAW fills.
 * Aggregation is done client-side (see fillsAggregator.ts) so that
 * future changes to metrics don't require re-fetching from the indexer.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMmBySlug } from '$lib/config/mms';
import type { IndexerFill } from '$lib/features/fills/types';

const PAGE_LIMIT = 500;
const MAX_PAGES = 20;

interface IndexerFillsResponse {
  fills: IndexerFill[];
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
    if (!res.ok) throw new Error(`Indexer ${res.status} for sub ${subaccountNumber}`);

    const body: IndexerFillsResponse = await res.json();
    if (!body.fills || body.fills.length === 0) break;

    for (const fill of body.fills) {
      if (!seen.has(fill.id) && fill.createdAt >= fromTs) {
        seen.add(fill.id);
        fills.push(fill);
      }
    }

    const oldest = body.fills[body.fills.length - 1];
    if (oldest.createdAt < fromTs) break;
    if (body.fills.length < PAGE_LIMIT) break;
    if (page === MAX_PAGES - 1) { isCapped = true; break; }

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
  if (subaccounts.length === 0) throw error(400, `No subaccounts for ${slug}`);

  const signal = AbortSignal.timeout(60_000);

  try {
    const results = await Promise.all(
      subaccounts.map((subNum) => fetchSubaccountFills(mm.address, subNum, from, to, signal))
    );

    const fills: IndexerFill[] = results.flatMap((r) => r.fills);
    const isCapped = results.some((r) => r.isCapped);

    return json({ fills, isCapped, from, to });
  } catch (e) {
    return json({ error: String(e) }, { status: 502 });
  }
};
