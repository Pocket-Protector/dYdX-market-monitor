// Time-in-book — per-MM repricing cadence over the rolling last 24h. The detail endpoint
// breaks each MM down by ticker, which is what the /overview per-ticker MM panel joins on.
// Upstream: API_BASE_URL /api/time-in-book/{overview,detail} — see mm-performance-v2 docs §2.

export interface TibRepriced {
  // Population ended by REPLACED or USER_CANCELED (active repricing).
  count: number;
  medianMs: number | null; // null (never 0) when count === 0 — render as "—"
  p90Ms: number | null;
}

export interface TibMix {
  // Share of completed order lives by end reason (% of `orders`). Null object when orders === 0;
  // individual reasons can also be null when that bucket is empty.
  replacedPct: number | null;
  userCanceledPct: number | null;
  expiredPct: number | null;
  filledPct: number | null;
  rejectedPct: number | null;
}

export interface TibTicker {
  ticker: string;
  orders: number; // completed lives — excludes censored + indexer-expired
  repriced: TibRepriced;
  mix: TibMix | null;
  censoredCount: number;
  indexerExpiredCount: number;
}

export interface TibMm {
  mmSlug: string;
  displayName: string;
  orders: number;
  repriced: TibRepriced;
  mix: TibMix | null;
  censoredCount: number;
  indexerExpiredCount: number;
  tickers?: TibTicker[]; // present on the detail endpoint only
}

export interface TibMeta {
  endpoint: string;
  window?: { from: string; to: string; hours: number };
  tooltips?: Record<string, string>;
  notes?: string[];
  note?: string; // cold start only
}

export interface TibOverviewResponse {
  meta: TibMeta;
  data: { mms: TibMm[] } | null;
  error: string | null;
}

export type TibDetailResponse = TibOverviewResponse;
