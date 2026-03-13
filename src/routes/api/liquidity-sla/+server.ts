import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { getMmBySlug } from '$lib/config/mms';
import { mapWithConcurrency, withRequestCache } from '$lib/utils/request-cache';
import { getSlaMetadata } from '$lib/shared/sla/metadata';

type LiquidityMode = 'sla' | 'custom';

interface FlatRow {
  ticker: string;
  minutesIncluded: number;
  medianBidLiqUsd: number | null;
  medianAskLiqUsd: number | null;
}

interface DraftLevel {
  key: string;
  label: string;
  usd: number;
  expectedBps: number;
}

interface SectionLevel extends DraftLevel {
  measuredBps: number;
}

interface SectionTicker {
  ticker: string;
  levels: string[];
  rows: Record<string, FlatRow | null>;
}

interface Section {
  group: string;
  isFallback: boolean;
  levels: SectionLevel[];
  tickers: SectionTicker[];
}

function bpsKey(value: number): string {
  return value.toString();
}

function normalizeFlatRows(results: unknown): FlatRow[] {
  if (!Array.isArray(results)) return [];

  return results
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null && !Array.isArray(row))
    .filter((row) => typeof row.ticker === 'string' && !Array.isArray(row.buckets))
    .map((row) => ({
      ticker: row.ticker as string,
      minutesIncluded: typeof row.minutesIncluded === 'number' ? row.minutesIncluded : 0,
      medianBidLiqUsd: typeof row.medianBidLiqUsd === 'number' ? row.medianBidLiqUsd : null,
      medianAskLiqUsd: typeof row.medianAskLiqUsd === 'number' ? row.medianAskLiqUsd : null
    }));
}

async function fetchLiquidityRows(
  mmAddress: string,
  from: string,
  to: string,
  bucket: string,
  bps: number,
  ticker: string
): Promise<FlatRow[]> {
  const params: Record<string, string> = {
    mm: mmAddress,
    bps: String(bps),
    side: 'both',
    from,
    to,
    bucket
  };

  if (ticker) params.ticker = ticker;

  const raw = await apiFetch('/liquidity', params);
  return normalizeFlatRows((raw as { data?: { results?: unknown } })?.data?.results);
}

export const GET: RequestHandler = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const ticker = url.searchParams.get('ticker') ?? '';
  const bucket = url.searchParams.get('bucket') ?? 'none';
  const fallbackBps = Number(url.searchParams.get('bps') ?? '50');
  const mode: LiquidityMode = url.searchParams.get('mode') === 'custom' ? 'custom' : 'sla';

  if (!slug) throw error(400, 'Missing slug');
  if (!Number.isFinite(fallbackBps) || fallbackBps <= 0) throw error(400, 'Invalid bps');

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
            usd: level.expectedUsd,
            expectedBps: level.expectedBps,
            measuredBps: mode === 'custom' ? fallbackBps : level.expectedBps
          })),
          tickerLevels: section.tickerLevels
        }));

        const queryBps = new Map<string, number>();
        for (const section of resolvedSections) {
          for (const level of section.levels) {
            queryBps.set(bpsKey(level.measuredBps), level.measuredBps);
          }
        }

        const liquidityByBps = new Map<string, Map<string, FlatRow>>();
        const allTickers = new Set<string>();

        async function ensureLiquidityRows(bps: number): Promise<Map<string, FlatRow>> {
          const key = bpsKey(bps);
          const cached = liquidityByBps.get(key);
          if (cached) return cached;

          const rows = await fetchLiquidityRows(mmAddress, from, to, bucket, bps, ticker);
          const rowMap = new Map<string, FlatRow>();
          for (const row of rows) {
            rowMap.set(row.ticker, row);
            allTickers.add(row.ticker);
          }
          liquidityByBps.set(key, rowMap);
          return rowMap;
        }

        await mapWithConcurrency([...queryBps.values()], 4, async (bps) => {
          await ensureLiquidityRows(bps);
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
                      ? (liquidityByBps.get(bpsKey(level.measuredBps))?.get(symbol) ?? null)
                      : null
                  ])
                )
              };
            })
        }));

        const fallbackLevel: SectionLevel = {
          key: 'default',
          label: 'Default',
          usd: 1_000,
          expectedBps: fallbackBps,
          measuredBps: fallbackBps
        };

        const tickerNeedsFallback = Boolean(ticker) && !groupedTickers.has(ticker);
        const revealedUngrouped = [...allTickers]
          .filter((symbol) => !groupedTickers.has(symbol))
          .sort((a, b) => a.localeCompare(b));

        if (tickerNeedsFallback || revealedUngrouped.length > 0) {
          const fallbackRows = await ensureLiquidityRows(fallbackLevel.measuredBps);
          const ungroupedTickers = tickerNeedsFallback
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
          mode,
          request: {
            bps: fallbackBps,
            mode,
            ticker
          },
          sections
        };
      }
    );

    return json(payload);
  } catch (e) {
    return json({ error: String(e) }, { status: 502 });
  }
};
