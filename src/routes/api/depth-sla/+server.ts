import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { getMmBySlug } from '$lib/config/mms';
import { mapWithConcurrency, withRequestCache } from '$lib/utils/request-cache';
import { getSlaMetadata } from '$lib/shared/sla/metadata';

type DepthMode = 'sla' | 'custom';
type DepthView = 'combined' | 'all';

interface DepthRow {
  ticker: string;
  minutesIncluded: number;
  medianBidFillBps: number | null;
  medianAskFillBps: number | null;
  medianCombinedFillBps: number | null;
}

interface DraftLevel {
  key: string;
  label: string;
  expectedUsd: number;
  expectedBps: number | null;
}

interface SectionLevel extends DraftLevel {
  measuredUsd: number;
}

interface SectionTicker {
  ticker: string;
  levels: string[];
  rows: Record<string, DepthRow | null>;
}

interface Section {
  group: string;
  isFallback: boolean;
  levels: SectionLevel[];
  tickers: SectionTicker[];
}

interface RawDepthRow {
  ticker: string;
  minutesIncluded: number;
  medianBidFillBps: number | null;
  medianAskFillBps: number | null;
  medianCombinedFillBps: number | null;
}

function usdKey(value: number): string {
  return value.toString();
}

function normalizeRows(results: unknown): RawDepthRow[] {
  if (!Array.isArray(results)) return [];

  return results
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row))
    .filter((row) => typeof row.ticker === 'string' && !Array.isArray(row.buckets))
    .map((row) => ({
      ticker: row.ticker as string,
      minutesIncluded:
        typeof row.minutesIncluded === 'number'
          ? row.minutesIncluded
          : typeof row.minutesCombinedIncluded === 'number'
            ? row.minutesCombinedIncluded
            : Math.max(
                typeof row.minutesBidIncluded === 'number' ? row.minutesBidIncluded : 0,
                typeof row.minutesAskIncluded === 'number' ? row.minutesAskIncluded : 0
              ),
      medianBidFillBps: typeof row.medianBidFillBps === 'number' ? row.medianBidFillBps : null,
      medianAskFillBps: typeof row.medianAskFillBps === 'number' ? row.medianAskFillBps : null,
      medianCombinedFillBps: typeof row.medianCombinedFillBps === 'number' ? row.medianCombinedFillBps : null
    }));
}

async function fetchDepthRows(
  mmAddress: string,
  from: string,
  to: string,
  bucket: string,
  usd: number,
  ticker: string,
  view: DepthView,
  includeCombined: boolean
): Promise<DepthRow[]> {
  const baseParams: Record<string, string> = {
    mm: mmAddress,
    usd: String(usd),
    from,
    to,
    bucket
  };

  if (ticker) baseParams.ticker = ticker;

  const [combinedRaw, bothRaw] = await Promise.all([
    includeCombined ? apiFetch('/depth', { ...baseParams, side: 'combined' }) : Promise.resolve(null),
    view === 'all' ? apiFetch('/depth', { ...baseParams, side: 'both' }) : Promise.resolve(null)
  ]);

  const combinedRows = normalizeRows((combinedRaw as { data?: { results?: unknown } })?.data?.results);
  const bothRows = normalizeRows((bothRaw as { data?: { results?: unknown } } | null)?.data?.results);

  const merged = new Map<string, DepthRow>();
  for (const row of bothRows) {
    merged.set(row.ticker, {
      ticker: row.ticker,
      minutesIncluded: row.minutesIncluded,
      medianBidFillBps: row.medianBidFillBps,
      medianAskFillBps: row.medianAskFillBps,
      medianCombinedFillBps: null
    });
  }

  for (const row of combinedRows) {
    const existing = merged.get(row.ticker);
    if (existing) {
      existing.medianCombinedFillBps = row.medianCombinedFillBps;
      existing.minutesIncluded = Math.max(existing.minutesIncluded, row.minutesIncluded);
    } else {
      merged.set(row.ticker, {
        ticker: row.ticker,
        minutesIncluded: row.minutesIncluded,
        medianBidFillBps: null,
        medianAskFillBps: null,
        medianCombinedFillBps: row.medianCombinedFillBps
      });
    }
  }

  return [...merged.values()];
}

export const GET: RequestHandler = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const ticker = url.searchParams.get('ticker') ?? '';
  const bucket = url.searchParams.get('bucket') ?? 'none';
  const fallbackUsd = Number(url.searchParams.get('usd') ?? '100000');
  const mode: DepthMode = url.searchParams.get('mode') === 'custom' ? 'custom' : 'sla';
  const view: DepthView = url.searchParams.get('view') === 'all' ? 'all' : 'combined';
  const includeCombined = url.searchParams.get('includeCombined') !== '0';

  if (!slug) throw error(400, 'Missing slug');
  if (!Number.isFinite(fallbackUsd) || fallbackUsd <= 0) throw error(400, 'Invalid usd');

  const mm = getMmBySlug(slug);
  if (!mm) throw error(404, `Unknown slug: ${slug}`);
  const mmAddress = mm.address;

  try {
    const payload = await withRequestCache(
      `${url.pathname}?${url.searchParams.toString()}`,
      60_000,
      async () => {
        const metadataSections = await getSlaMetadata(mmAddress, from, to);
        const groupedTickers = new Set<string>();

        const resolvedSections = metadataSections.map((section) => ({
          group: section.group,
          levels: section.levels.map((level) => ({
            key: level.key,
            label: level.label,
            expectedUsd: level.expectedUsd,
            expectedBps: level.expectedBps,
            measuredUsd: mode === 'custom' ? fallbackUsd : level.expectedUsd
          })),
          tickerLevels: section.tickerLevels
        }));
        const hasConfiguredSla = resolvedSections.length > 0;

        const queryUsd = new Map<string, number>();
        for (const section of resolvedSections) {
          for (const level of section.levels) {
            queryUsd.set(usdKey(level.measuredUsd), level.measuredUsd);
          }
        }

        const depthByUsd = new Map<string, Map<string, DepthRow>>();
        const allTickers = new Set<string>();

        async function ensureDepthRows(usd: number): Promise<Map<string, DepthRow>> {
          const key = usdKey(usd);
          const cached = depthByUsd.get(key);
          if (cached) return cached;

          const rows = await fetchDepthRows(mmAddress, from, to, bucket, usd, ticker, view, includeCombined);
          const rowMap = new Map<string, DepthRow>();
          for (const row of rows) {
            rowMap.set(row.ticker, row);
            allTickers.add(row.ticker);
          }
          depthByUsd.set(key, rowMap);
          return rowMap;
        }

        await mapWithConcurrency([...queryUsd.values()], 4, async (usd) => {
          await ensureDepthRows(usd);
        });

        const sections: Section[] = resolvedSections.map((section) => ({
          group: section.group,
          isFallback: false,
          levels: section.levels,
          tickers: [...section.tickerLevels.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([symbol, levels]) => {
              groupedTickers.add(symbol);
              return {
                ticker: symbol,
                levels: [...levels],
                rows: Object.fromEntries(
                  section.levels.map((level) => [
                    level.key,
                    levels.has(level.key)
                      ? (depthByUsd.get(usdKey(level.measuredUsd))?.get(symbol) ?? null)
                      : null
                  ])
                )
              };
            })
        }));

        const fallbackLevel: SectionLevel = {
          key: 'default',
          label: 'Default',
          expectedUsd: 1_000,
          expectedBps: null,
          measuredUsd: mode === 'custom' || !hasConfiguredSla ? fallbackUsd : 1_000
        };

        const noSlaSections = !hasConfiguredSla;
        const tickerNeedsFallback = Boolean(ticker) && !groupedTickers.has(ticker);
        const revealedUngrouped = [...allTickers]
          .filter((symbol) => !groupedTickers.has(symbol))
          .sort((a, b) => a.localeCompare(b));

        if (noSlaSections || tickerNeedsFallback || revealedUngrouped.length > 0) {
          const fallbackRows = await ensureDepthRows(fallbackLevel.measuredUsd);
          const ungroupedTickers = noSlaSections
            ? [...fallbackRows.keys()].sort((a, b) => a.localeCompare(b))
            : tickerNeedsFallback
              ? [...fallbackRows.keys()].filter((symbol) => symbol === ticker)
              : revealedUngrouped;

          if (ungroupedTickers.length > 0) {
            sections.push({
              group: 'Ungrouped',
              isFallback: true,
              levels: [fallbackLevel],
              tickers: ungroupedTickers.map((symbol) => ({
                ticker: symbol,
                levels: [fallbackLevel.key],
                rows: {
                  [fallbackLevel.key]: fallbackRows.get(symbol) ?? null
                }
              }))
            });
          }
        }

        return {
          hasConfiguredSla,
          mode,
          request: {
            mode,
            ticker,
            usd: fallbackUsd,
            view
          },
          view,
          sections
        };
      }
    );

    return json(payload);
  } catch (e) {
    return json({ error: String(e) }, { status: 502 });
  }
};
