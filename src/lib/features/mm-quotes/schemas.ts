import { z } from 'zod';

const MetaSchema = z
  .object({
    endpoint: z.string(),
    window: z.object({
      from: z.string(),
      to: z.string(),
      minutes: z.number()
    }),
    tooltips: z.record(z.string(), z.string()).optional(),
    notes: z.array(z.string()).optional()
  })
  .passthrough();

export const MmQuotesOverviewTickerSchema = z.object({
  ticker: z.string(),
  mmsCount: z.number(),
  totalQuotedUsd: z.number(),
  totalMakerVolumeUsd24h: z.number(),
  totalTakerVolumeUsd24h: z.number()
});

export const MmQuotesDetailMmSchema = z.object({
  mmSlug: z.string(),
  displayName: z.string(),
  uptimePct: z.number(),
  twoSidedMinutes: z.number(),
  bidQuotedUsd: z.number().nullable(),
  askQuotedUsd: z.number().nullable(),
  totalQuotedUsd: z.number(),
  makerVolumeUsd24h: z.number(),
  takerVolumeUsd24h: z.number()
});

export const MmQuotesDetailTickerSchema = MmQuotesOverviewTickerSchema.extend({
  mms: z.array(MmQuotesDetailMmSchema)
});

export const MmQuotesOverviewResponseSchema = z.object({
  meta: MetaSchema,
  data: z.object({ tickers: z.array(MmQuotesOverviewTickerSchema) }).nullable(),
  error: z.string().nullable()
});

export const MmQuotesDetailResponseSchema = z.object({
  meta: MetaSchema,
  data: z.object({ tickers: z.array(MmQuotesDetailTickerSchema) }).nullable(),
  error: z.string().nullable()
});
