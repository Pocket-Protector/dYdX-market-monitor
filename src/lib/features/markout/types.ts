export const MARKOUT_HORIZONS = ['2s', '3s', '5s', '10s', '20s', '30s', '60s', '300s'] as const;
export const DEFAULT_MARKOUT_HORIZON = '5s' as const;

export type MarkoutHorizon = (typeof MARKOUT_HORIZONS)[number];
export type MarkoutView = 'dydx' | 'index';

export function isValidMarkoutHorizon(input: string | null): input is MarkoutHorizon {
  return typeof input === 'string' && MARKOUT_HORIZONS.includes(input as MarkoutHorizon);
}

export function isValidMarkoutView(input: string | null): input is MarkoutView {
  return input === 'dydx' || input === 'index';
}

export const COLORS = [
  '#8b5cf6',
  '#22c55e',
  '#38bdf8',
  '#f97316',
  '#eab308',
  '#ef4444',
  '#14b8a6',
  '#f43f5e',
  '#10b981'
];

export function colorForSlug(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

export interface MarkoutRange {
  requestedFrom: string | null;
  requestedTo: string | null;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface MarkoutMeta {
  views: { key: MarkoutView; label: string }[];
  horizons: MarkoutHorizon[];
  defaultHorizon: MarkoutHorizon;
  availability: Record<
    MarkoutView,
    { minDate: string; maxDate: string; horizonStarts: Record<MarkoutHorizon, string> }
  >;
  lastUpdatedAt: string | null;
  uiNotes: { global: string[]; table: string[]; mmDetail: string[] };
}

export interface MarkoutOverviewRow {
  slug: string;
  name: string;
  fills: number | null;
  avgOrderSize: number | null;
  tickerCount: number | null;
  totalVolume: number | null;
  makerVolPct: number | null;
  takerVolPct: number | null;
  makerTakerRatio: number | null;
  horizons: Record<MarkoutHorizon, number | null>;
  hasDetail: boolean;
}

export interface MarkoutOverviewResponse {
  view: MarkoutView;
  range: MarkoutRange;
  rows: MarkoutOverviewRow[];
}

export interface MarkoutSeriesResponse {
  view: MarkoutView;
  horizon: MarkoutHorizon;
  range: MarkoutRange;
  series: {
    key: string;
    label: string;
    trackedFrom: string | null;
    points: { ts: string; value: number }[];
  }[];
}

export interface MarkoutMmSummaryRow {
  fills: number | null;
  avgOrderSize: number | null;
  tickerCount: number | null;
  totalVolume: number | null;
  makerVolPct: number | null;
  takerVolPct: number | null;
  makerTakerRatio: number | null;
  horizons: Record<MarkoutHorizon, number | null>;
}

export interface MarkoutMmDetailRow {
  ticker: string;
  fills: number | null;
  avgOrderSize: number | null;
  horizons: Record<MarkoutHorizon, number | null>;
}

export interface MarkoutMmResponse {
  mm: { slug: string; name: string; hasDetail: boolean };
  range: MarkoutRange;
  summaryRow: MarkoutMmSummaryRow;
  detailRows: MarkoutMmDetailRow[];
}
