import { z } from 'zod';

const RepricedSchema = z.object({
  count: z.number(),
  medianMs: z.number().nullable(),
  p90Ms: z.number().nullable()
});

const MixSchema = z
  .object({
    replacedPct: z.number().nullable(),
    userCanceledPct: z.number().nullable(),
    expiredPct: z.number().nullable(),
    filledPct: z.number().nullable(),
    rejectedPct: z.number().nullable()
  })
  .nullable();

export const TibTickerSchema = z.object({
  ticker: z.string(),
  orders: z.number(),
  repriced: RepricedSchema,
  mix: MixSchema,
  censoredCount: z.number(),
  indexerExpiredCount: z.number()
});

export const TibMmSchema = z.object({
  mmSlug: z.string(),
  displayName: z.string(),
  orders: z.number(),
  repriced: RepricedSchema,
  mix: MixSchema,
  censoredCount: z.number(),
  indexerExpiredCount: z.number(),
  tickers: z.array(TibTickerSchema).optional()
});

const MetaSchema = z
  .object({
    endpoint: z.string(),
    window: z.object({ from: z.string(), to: z.string(), hours: z.number() }).optional(),
    tooltips: z.record(z.string(), z.string()).optional(),
    notes: z.array(z.string()).optional(),
    note: z.string().optional()
  })
  .passthrough();

export const TibOverviewResponseSchema = z.object({
  meta: MetaSchema,
  data: z.object({ mms: z.array(TibMmSchema) }).nullable(),
  error: z.string().nullable()
});

export const TibDetailResponseSchema = TibOverviewResponseSchema;
