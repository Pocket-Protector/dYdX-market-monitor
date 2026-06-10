// Trading-hours — per-ticker quoted liquidity & two-sided coverage split by fixed UTC
// trading session, over the last completed Mon→Mon week.
// Upstream: API_BASE_URL /api/trading-hours/summary — see mm-performance-v2 docs/API_INTEGRATION.md §3.

export type TradingHoursSessionKey =
  | 'overnight'
  | 'premarket'
  | 'regularTrading'
  | 'extendedAfterHours'
  | 'weekendClosed'
  | 'wholeWeek';

export interface TradingHoursSessionValue {
  // Median (bid+ask) quoted USD over two-sided minutes, summed across MMs.
  // null = no MM had a two-sided minute in this session (NOT 0).
  usd: number | null;
  // Distinct minutes ≥1 MM was two-sided (aggregate coverage, not a sum of per-MM minutes).
  twoSidedMinutes: number;
}

export interface TradingHoursWindowSession {
  minutes: number; // fixed session length for the week
  available: number; // minutes − system downtime
}

export interface TradingHoursWindow {
  weekStart: string;
  weekEnd: string;
  label: string;
  downtimeMinutes: number;
  sessions: Record<TradingHoursSessionKey, TradingHoursWindowSession>;
}

export interface TradingHoursMeta {
  endpoint: string;
  window?: TradingHoursWindow;
  tooltips?: Record<string, string>;
  notes?: string[];
  note?: string; // cold start only
  code?: string; // error only
  availableWeeks?: string[]; // only on a 400 bad-week
}

export interface TradingHoursSummaryTicker {
  ticker: string;
  mmsCount: number;
  sessions: Record<TradingHoursSessionKey, TradingHoursSessionValue>;
}

export interface TradingHoursSummaryResponse {
  meta: TradingHoursMeta;
  data: TradingHoursSummaryTicker[] | null;
  error: string | null;
}

export interface TradingHoursDetailMm {
  mmSlug: string;
  displayName: string;
  // For a detail/MM row, twoSidedMinutes is *that MM's own* two-sided minutes.
  sessions: Record<TradingHoursSessionKey, TradingHoursSessionValue>;
}

export interface TradingHoursDetailTicker extends TradingHoursSummaryTicker {
  mms: TradingHoursDetailMm[];
}

export interface TradingHoursDetailResponse {
  meta: TradingHoursMeta;
  data: TradingHoursDetailTicker[] | null;
  error: string | null;
}
