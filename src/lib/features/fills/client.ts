import { aggregateFills } from './aggregator';
import { getFillsCache, setFillsCache } from './db';
import type { FillsApiResponse, IndexerFill } from './types';

const PAGE_LIMIT = 500;
const MAX_PAGES = 20;

export interface FillsProgress {
  phase: 'idle' | 'streaming' | 'done';
  pages: number;
  fills: number;
}

export interface LoadFillsOptions {
  address: string;
  subaccounts: number[];
  onProgress?: (progress: FillsProgress) => void;
  signal?: AbortSignal;
}

function reportProgress(
  onProgress: LoadFillsOptions['onProgress'],
  progress: FillsProgress
): void {
  onProgress?.(progress);
}

function getKeyRange(key: string): { from: string; to: string } {
  const query = key.split('?')[1];
  if (!query) throw new Error('Missing fills query string');

  const params = new URLSearchParams(query);
  const from = params.get('from');
  const to = params.get('to');
  if (!from || !to) throw new Error('Missing fills range');

  return { from, to };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function fetchAggregatedFills(
  key: string,
  signal?: AbortSignal
): Promise<FillsApiResponse> {
  const res = await fetch(key, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as FillsApiResponse;
}

async function fetchDirectFills(
  key: string,
  { address, subaccounts, onProgress, signal }: LoadFillsOptions
): Promise<FillsApiResponse> {
  if (subaccounts.length === 0) {
    throw new Error('No subaccounts configured');
  }

  const { from, to } = getKeyRange(key);
  const fromTs = `${from}T00:00:00.000Z`;

  let pages = 0;
  let fillCount = 0;

  const results = await Promise.all(
    subaccounts.map(async (subaccountNumber) => {
      const seen = new Set<string>();
      const fills: IndexerFill[] = [];
      let isCapped = false;
      let createdBeforeOrAt = `${to}T23:59:59.999Z`;

      for (let page = 0; page < MAX_PAGES; page++) {
        const pageUrl = new URL('https://indexer.dydx.trade/v4/fills');
        pageUrl.searchParams.set('address', address);
        pageUrl.searchParams.set('subaccountNumber', String(subaccountNumber));
        pageUrl.searchParams.set('limit', String(PAGE_LIMIT));
        pageUrl.searchParams.set('createdBeforeOrAt', createdBeforeOrAt);

        const res = await fetch(pageUrl.toString(), { signal });
        if (!res.ok) {
          throw new Error(`Indexer ${res.status} for sub ${subaccountNumber}`);
        }

        const body = (await res.json()) as { fills?: IndexerFill[] };
        const pageFills = body.fills ?? [];
        if (pageFills.length === 0) break;

        let addedThisPage = 0;
        for (const fill of pageFills) {
          if (!seen.has(fill.id) && fill.createdAt >= fromTs) {
            seen.add(fill.id);
            fills.push(fill);
            addedThisPage += 1;
          }
        }

        if (addedThisPage > 0) {
          pages += 1;
          fillCount += addedThisPage;
          reportProgress(onProgress, { phase: 'streaming', pages, fills: fillCount });
        }

        const oldest = pageFills[pageFills.length - 1];
        if (oldest.createdAt < fromTs) break;
        if (pageFills.length < PAGE_LIMIT) break;
        if (page === MAX_PAGES - 1) {
          isCapped = true;
          break;
        }

        createdBeforeOrAt = oldest.createdAt;
      }

      return { fills, isCapped };
    })
  );

  const allFills = results.flatMap((result) => result.fills);
  const isCapped = results.some((result) => result.isCapped);

  reportProgress(onProgress, { phase: 'done', pages, fills: allFills.length });

  await setFillsCache(key, { fills: allFills, isCapped, from, to });
  return aggregateFills(allFills, from, to, isCapped);
}

export async function loadFillsData(
  key: string,
  options: LoadFillsOptions
): Promise<FillsApiResponse> {
  const cached = await getFillsCache(key);
  if (cached) {
    return aggregateFills(cached.fills, cached.from, cached.to, cached.isCapped);
  }

  reportProgress(options.onProgress, { phase: 'streaming', pages: 0, fills: 0 });
  try {
    return await fetchDirectFills(key, options);
  } catch (directError) {
    if (isAbortError(directError)) throw directError;

    reportProgress(options.onProgress, { phase: 'idle', pages: 0, fills: 0 });
    console.warn('fills direct fallback', directError);
    return fetchAggregatedFills(key, options.signal);
  }
}
