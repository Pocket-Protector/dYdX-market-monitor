export interface MmQuotesWindow {
  from: string;
  to: string;
  minutes: number;
}

export interface MmQuotesMeta {
  endpoint: string;
  window: MmQuotesWindow;
  tooltips?: Record<string, string>;
  notes?: string[];
}

export interface MmQuotesOverviewTicker {
  ticker: string;
  mmsCount: number;
  totalQuotedUsd: number;
  totalMakerVolumeUsd24h: number;
  totalTakerVolumeUsd24h: number;
}

export interface MmQuotesOverviewResponse {
  meta: MmQuotesMeta;
  data: { tickers: MmQuotesOverviewTicker[] } | null;
  error: string | null;
}

export interface MmQuotesDetailMm {
  mmSlug: string;
  displayName: string;
  uptimePct: number;
  twoSidedMinutes: number;
  bidQuotedUsd: number | null;
  askQuotedUsd: number | null;
  totalQuotedUsd: number;
  makerVolumeUsd24h: number;
  takerVolumeUsd24h: number;
}

export interface MmQuotesDetailTicker extends MmQuotesOverviewTicker {
  mms: MmQuotesDetailMm[];
}

export interface MmQuotesDetailResponse {
  meta: MmQuotesMeta;
  data: { tickers: MmQuotesDetailTicker[] } | null;
  error: string | null;
}
