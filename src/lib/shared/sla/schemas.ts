import { z } from 'zod';

export const LevelPctSchema = z.object({
  validMinutes: z.number(),
  bidPct: z.number().nullable(),
  askPct: z.number().nullable(),
  combinedPct: z.number().nullable()
});

export const LevelThresholdSchema = z.object({
  usd: z.number(),
  bps: z.number(),
  bpsEffective: z.number()
});

export const UptimeTickerSchema = z.object({
  ticker: z.string(),
  group: z.string(),
  levels: z.array(z.string()),
  thresholds: z.record(z.string(), LevelThresholdSchema),
  summary: z.object({
    validMinutes: z.number(),
    l1: LevelPctSchema.optional(),
    l2: LevelPctSchema.optional(),
    l3: LevelPctSchema.optional(),
    l4: LevelPctSchema.optional()
  }),
  daily: z.array(
    z.object({
      date: z.string(),
      validMinutes: z.number(),
      l1: LevelPctSchema.optional(),
      l2: LevelPctSchema.optional(),
      l3: LevelPctSchema.optional(),
      l4: LevelPctSchema.optional()
    })
  )
});

export const UptimeResponseSchema = z.object({
  data: z.object({
    mm: z.string(),
    from: z.string(),
    to: z.string(),
    bpsLeeway: z.number(),
    tickers: z.array(UptimeTickerSchema)
  })
});
