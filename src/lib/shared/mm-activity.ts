import { timeAgo } from '$lib/utils/format';
import type { MmActivity } from './types';

export type MmActivityStatus =
  | 'loading'
  | 'maker_in_range'
  | 'fills_in_range_no_maker'
  | 'no_fills_in_range';

export interface EmptyStateCopy {
  message: string;
  hint?: string;
}

export interface MmTableActivityCopy {
  primary: string;
  secondary?: string;
  tone: 'neutral' | 'good' | 'warn' | 'bad';
}

function latestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function rangeStartIso(value: string): string {
  return isDateOnly(value) ? `${value}T00:00:00.000Z` : new Date(value).toISOString();
}

function rangeEndIso(value: string): string {
  return isDateOnly(value) ? `${value}T23:59:59.999Z` : new Date(value).toISOString();
}

interface IndexerActivityFill {
  id: string;
  createdAt: string;
  liquidity: 'MAKER' | 'TAKER';
  market: string;
  price: string;
  size: string;
}

interface SubaccountActivityResult {
  lastFillAt: string | null;
  lastMakerFillAt: string | null;
  lastFillInRangeAt: string | null;
  lastMakerFillInRangeAt: string | null;
  makerVolumeInRange: number;
  makerTickersInRange: string[];
}

const PAGE_LIMIT = 500;
const MAX_PAGES = 20;

async function fetchSubaccountActivity(
  address: string,
  subaccountNumber: number,
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<SubaccountActivityResult> {
  const fromTs = rangeStartIso(from);
  const toTs = rangeEndIso(to);
  const seen = new Set<string>();

  let lastFillAt: string | null = null;
  let lastMakerFillAt: string | null = null;
  let lastFillInRangeAt: string | null = null;
  let lastMakerFillInRangeAt: string | null = null;
  let makerVolumeInRange = 0;
  const makerTickersInRange = new Set<string>();
  let createdBeforeOrAt = toTs;

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

    const body = (await res.json()) as { fills?: IndexerActivityFill[] };
    const rawFills = body.fills ?? [];
    if (rawFills.length === 0) break;

    for (const fill of rawFills) {
      if (seen.has(fill.id)) continue;
      seen.add(fill.id);

      if (!lastFillAt) lastFillAt = fill.createdAt;
      if (!lastMakerFillAt && fill.liquidity === 'MAKER') lastMakerFillAt = fill.createdAt;

      const inRange = fill.createdAt >= fromTs && fill.createdAt <= toTs;
      if (!inRange) continue;

      if (!lastFillInRangeAt) lastFillInRangeAt = fill.createdAt;
      if (!lastMakerFillInRangeAt && fill.liquidity === 'MAKER') {
        lastMakerFillInRangeAt = fill.createdAt;
      }
      if (fill.liquidity === 'MAKER') {
        makerVolumeInRange += parseFloat(fill.price) * parseFloat(fill.size);
        makerTickersInRange.add(fill.market);
      }
    }

    const oldest = rawFills[rawFills.length - 1];
    if (oldest.createdAt < fromTs) break;
    if (rawFills.length < PAGE_LIMIT) break;

    createdBeforeOrAt = oldest.createdAt;
  }

  return {
    lastFillAt,
    lastMakerFillAt,
    lastFillInRangeAt,
    lastMakerFillInRangeAt,
    makerVolumeInRange,
    makerTickersInRange: [...makerTickersInRange]
  };
}

export async function fetchMmActivity(
  address: string,
  subaccounts: number[],
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<MmActivity> {
  if (subaccounts.length === 0) {
    return {
      lastFillAt: null,
      lastMakerFillAt: null,
      lastFillInRangeAt: null,
      lastMakerFillInRangeAt: null,
      makerVolumeInRange: 0,
      makerTickerCountInRange: 0,
      loading: false
    };
  }

  const results = await Promise.all(
    subaccounts.map((subaccountNumber) =>
      fetchSubaccountActivity(address, subaccountNumber, from, to, signal)
    )
  );

  return {
    lastFillAt: results.reduce<string | null>((latest, result) => latestIso(latest, result.lastFillAt), null),
    lastMakerFillAt: results.reduce<string | null>(
      (latest, result) => latestIso(latest, result.lastMakerFillAt),
      null
    ),
    lastFillInRangeAt: results.reduce<string | null>(
      (latest, result) => latestIso(latest, result.lastFillInRangeAt),
      null
    ),
    lastMakerFillInRangeAt: results.reduce<string | null>(
      (latest, result) => latestIso(latest, result.lastMakerFillInRangeAt),
      null
    ),
    makerVolumeInRange: results.reduce((total, result) => total + result.makerVolumeInRange, 0),
    makerTickerCountInRange: new Set(results.flatMap((result) => result.makerTickersInRange)).size,
    loading: false
  };
}

export function getMmActivityStatus(activity?: MmActivity): MmActivityStatus {
  if (!activity || activity.loading) return 'loading';
  if (activity.lastMakerFillInRangeAt) return 'maker_in_range';
  if (activity.lastFillInRangeAt) return 'fills_in_range_no_maker';
  return 'no_fills_in_range';
}

export function getMmEmptyStateCopy(
  activity: MmActivity | undefined,
  fallback: EmptyStateCopy
): EmptyStateCopy {
  switch (getMmActivityStatus(activity)) {
    case 'loading':
      return fallback;
    case 'maker_in_range':
      return {
        message: 'No ticker data was produced in this period, even though maker fills were seen.',
        hint: activity?.lastMakerFillInRangeAt
          ? `Last maker fill in range: ${timeAgo(activity.lastMakerFillInRangeAt)}. This usually means quoting was one-sided or too sparse to produce ticker rows.`
          : undefined
      };
    case 'fills_in_range_no_maker':
      return {
        message: 'No ticker data was produced in this period. Fills were seen, but no maker fills were seen.',
        hint: activity?.lastFillInRangeAt
          ? `Last fill in range: ${timeAgo(activity.lastFillInRangeAt)}. This looks like taker-only or non-quoting activity.`
          : undefined
      };
    case 'no_fills_in_range':
      return {
        message: 'No fills were seen in this period.',
        hint: activity?.lastMakerFillAt
          ? `Last maker fill: ${timeAgo(activity.lastMakerFillAt)}. It falls outside the selected range.`
          : activity?.lastFillAt
            ? `Last fill: ${timeAgo(activity.lastFillAt)}. It falls outside the selected range.`
            : undefined
      };
  }
}

export function getMmHeaderActivityLabel(activity?: MmActivity): string {
  if (!activity || activity.loading) return 'Checking maker activity...';
  if (activity.lastMakerFillInRangeAt) {
    return `Maker activity in range: ${timeAgo(activity.lastMakerFillInRangeAt)}`;
  }
  if (activity.lastMakerFillAt) {
    return `No maker activity in range. Last maker fill: ${timeAgo(activity.lastMakerFillAt)}`;
  }
  return 'No maker activity found';
}

export function getMmTableActivityCopy(activity?: MmActivity): MmTableActivityCopy {
  if (!activity || activity.loading) {
    return {
      primary: 'Checking 24h maker activity',
      secondary: 'Scanning the trailing 24h window',
      tone: 'neutral'
    };
  }

  if (activity.lastMakerFillInRangeAt) {
    return {
      primary: timeAgo(activity.lastMakerFillInRangeAt),
      secondary: 'Maker activity seen in the trailing 24h',
      tone: 'good'
    };
  }

  if (activity.lastMakerFillAt) {
    return {
      primary: 'No maker activity in the trailing 24h',
      secondary: `Investigate quoting; last maker fill ${timeAgo(activity.lastMakerFillAt)}`,
      tone: 'warn'
    };
  }

  return {
    primary: 'No maker activity found',
    secondary: 'Investigate quoting or account mapping',
    tone: 'bad'
  };
}
