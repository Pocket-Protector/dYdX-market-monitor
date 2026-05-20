export interface PairDepthWindow {
  from24h: string;
  to: string;
  from14d: string;
}

export interface PairDepthMeta {
  endpoint: string;
  window: PairDepthWindow;
  tooltips?: Record<string, string>;
  notes?: string[];
}

export interface PairDepthOverviewTicker {
  ticker: string;
  vol14dMedianUsd: number | null;
  spread14dBps: number | null;
  spread24hBps: number | null;
  spreadDeltaPct: number | null;
  depth100bps14dUsd: number | null;
  depth100bps24hUsd: number | null;
  depth100bpsDeltaPct: number | null;
  slip10kBps14d: number | null;
  slip10kBps24h: number | null;
  slip10kDeltaPct: number | null;
  slip100kBps14d: number | null;
  slip100kBps24h: number | null;
  slip100kDeltaPct: number | null;
}

export interface PairDepthOverviewResponse {
  meta: PairDepthMeta;
  data: { tickers: PairDepthOverviewTicker[] } | null;
  error: string | null;
}
