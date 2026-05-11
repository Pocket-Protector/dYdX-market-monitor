export interface SlaLandingRow {
  mmSlug: string;
  displayName: string;
  totalAvgLiquidityQuotedUsd: number;
  firstTrackingDate: string;
  latestDataPoint: string;
}
export interface SlaLandingResponse {
  rows: SlaLandingRow[];
}

export interface SlaWallet {
  address: string;
  subaccounts: number[];
  firstDataPoint: string;
  latestDataPoint: string;
  totalMinutesWithData: number;
}
export interface SlaMmMetaResponse {
  mmSlug: string;
  displayName: string;
  firstTrackingDate: string;
  latestDataPoint: string;
  wallets: SlaWallet[];
}

export interface SlaLiquidityRow {
  ticker: string;
  avgLiquidityQuotedUsd: number;
  slaUsd: number;
  liquidityCoveredPct: number;
  uptimePct: number;
  makerVolumeUsd: number;
  takerVolumeUsd: number;
  totalVolumeUsd: number;
}
export interface SlaLiquidityResponse {
  mmSlug: string;
  totalAvgLiquidityQuotedUsd: number;
  rows: SlaLiquidityRow[];
}

export interface SlaUptimeRow {
  groupName: string;
  ticker: string;
  tickBps: number;
  l1AdjBps: number;
  l1Usd: number;
  l1FilledAtBps: number | null;
  l1UptimePct: number;
  l2AdjBps: number | null;
  l2Usd: number | null;
  l2FilledAtBps: number | null;
  l2UptimePct: number | null;
}
export interface SlaUptimeResponse {
  mmSlug: string;
  rows: SlaUptimeRow[];
}

export interface SlaConfigRow {
  groupName: string;
  ticker: string;
  l1Usd: number;
  l1Bps: number;
  l2Usd: number | null;
  l2Bps: number | null;
  totalLiquidityUsd: number;
  tickBps: number;
  slaMaxBps: number;
}
export interface SlaConfigResponse {
  mmSlug: string;
  activeSlaFile: string;
  rows: SlaConfigRow[];
}
