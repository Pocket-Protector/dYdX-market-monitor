import { z } from 'zod';

export const SlaLandingRowSchema = z.object({
  mmSlug: z.string(),
  displayName: z.string(),
  totalAvgLiquidityQuotedUsd: z.number(),
  firstTrackingDate: z.string(),
  latestDataPoint: z.string()
});
export const SlaLandingResponseSchema = z.object({
  rows: z.array(SlaLandingRowSchema)
});

export const SlaWalletSchema = z.object({
  address: z.string(),
  subaccounts: z.array(z.number()),
  firstDataPoint: z.string(),
  latestDataPoint: z.string(),
  totalMinutesWithData: z.number()
});
export const SlaMmMetaResponseSchema = z.object({
  mmSlug: z.string(),
  displayName: z.string(),
  firstTrackingDate: z.string(),
  latestDataPoint: z.string(),
  wallets: z.array(SlaWalletSchema)
});

export const SlaLiquidityRowSchema = z.object({
  ticker: z.string(),
  avgLiquidityQuotedUsd: z.number(),
  slaUsd: z.number(),
  liquidityCoveredPct: z.number(),
  uptimePct: z.number(),
  makerVolumeUsd: z.number(),
  takerVolumeUsd: z.number(),
  totalVolumeUsd: z.number()
});
export const SlaLiquidityResponseSchema = z.object({
  mmSlug: z.string(),
  totalAvgLiquidityQuotedUsd: z.number(),
  rows: z.array(SlaLiquidityRowSchema)
});

export const SlaUptimeRowSchema = z.object({
  groupName: z.string(),
  ticker: z.string(),
  tickBps: z.number(),
  l1AdjBps: z.number(),
  l1Usd: z.number(),
  l1FilledAtBps: z.number().nullable(),
  l1UptimePct: z.number(),
  l2AdjBps: z.number().nullable(),
  l2Usd: z.number().nullable(),
  l2FilledAtBps: z.number().nullable(),
  l2UptimePct: z.number().nullable()
});
export const SlaUptimeResponseSchema = z.object({
  mmSlug: z.string(),
  rows: z.array(SlaUptimeRowSchema)
});

export const SlaConfigRowSchema = z.object({
  groupName: z.string(),
  ticker: z.string(),
  l1Usd: z.number(),
  l1Bps: z.number(),
  l2Usd: z.number().nullable(),
  l2Bps: z.number().nullable(),
  totalLiquidityUsd: z.number(),
  tickBps: z.number(),
  slaMaxBps: z.number()
});
export const SlaConfigResponseSchema = z.object({
  mmSlug: z.string(),
  activeSlaFile: z.string(),
  rows: z.array(SlaConfigRowSchema)
});
