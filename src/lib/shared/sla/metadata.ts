import { apiFetch } from '$lib/api/client';
import { UptimeResponseSchema } from './schemas';
import { withRequestCache } from '$lib/utils/request-cache';

export interface SlaMetadataLevel {
  key: string;
  label: string;
  expectedUsd: number;
  expectedBps: number;
}

export interface SlaMetadataSection {
  group: string;
  levels: SlaMetadataLevel[];
  tickerLevels: Map<string, Set<string>>;
}

interface DraftSection {
  group: string;
  levels: Map<string, SlaMetadataLevel>;
  tickerLevels: Map<string, Set<string>>;
}

function groupRank(group: string): number {
  const match = group.match(/group\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}

function levelRank(level: string): number {
  const match = level.match(/l(\d+)/i);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
}

export async function getSlaMetadata(
  mmAddress: string,
  from: string,
  to: string
): Promise<SlaMetadataSection[]> {
  return withRequestCache(`sla-metadata:${mmAddress}:${from}:${to}`, 86_400_000, async () => {
    const uptimeRaw = await apiFetch(`/uptime/${mmAddress}`, { from, to, tickSizeAdj: 'false' });
    const uptimeParsed = UptimeResponseSchema.parse(uptimeRaw);

    const draftSections = new Map<string, DraftSection>();

    for (const ticker of uptimeParsed.data.tickers) {
      const group = ticker.group.trim();
      if (!group) continue;

      if (!draftSections.has(group)) {
        draftSections.set(group, {
          group,
          levels: new Map(),
          tickerLevels: new Map()
        });
      }

      const section = draftSections.get(group)!;
      if (!section.tickerLevels.has(ticker.ticker)) {
        section.tickerLevels.set(ticker.ticker, new Set());
      }

      for (const rawLevel of ticker.levels) {
        const key = rawLevel.toLowerCase();
        const threshold = ticker.thresholds[rawLevel] ?? ticker.thresholds[key];
        if (!threshold) continue;

        section.levels.set(key, {
          key,
          label: rawLevel.toUpperCase(),
          expectedUsd: threshold.usd,
          expectedBps: threshold.bpsEffective
        });
        section.tickerLevels.get(ticker.ticker)!.add(key);
      }
    }

    return [...draftSections.values()]
      .map((section) => ({
        group: section.group,
        levels: [...section.levels.values()].sort((a, b) => {
          const rankDiff = levelRank(a.key) - levelRank(b.key);
          if (rankDiff !== 0) return rankDiff;
          return a.key.localeCompare(b.key);
        }),
        tickerLevels: section.tickerLevels
      }))
      .filter((section) => section.levels.length > 0)
      .sort((a, b) => {
        const rankDiff = groupRank(a.group) - groupRank(b.group);
        if (rankDiff !== 0) return rankDiff;
        return a.group.localeCompare(b.group);
      });
  });
}
