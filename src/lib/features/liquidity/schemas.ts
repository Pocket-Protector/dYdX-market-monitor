import { z } from 'zod';

export const LiquidityRowSchema = z.object({
  ticker: z.string(),
  minutesIncluded: z.number(),
  minutesExcluded: z.number(),
  medianBidLiqUsd: z.number().nullable(),
  medianAskLiqUsd: z.number().nullable(),
  medianBothLiqUsd: z.number().nullable(),
  medianCombinedLiqUsd: z.number().nullable()
});

export const LiquidityBucketRowSchema = z.object({
  ticker: z.string(),
  buckets: z.array(
    z.object({
      bucket: z.string(),
      minutesIncluded: z.number(),
      medianBidLiqUsd: z.number().nullable(),
      medianAskLiqUsd: z.number().nullable(),
      medianCombinedLiqUsd: z.number().nullable()
    })
  )
});

export const LiquidityResponseSchema = z.object({
  data: z.object({
    mm: z.string(),
    bps: z.number(),
    from: z.string(),
    to: z.string(),
    results: z.array(z.union([LiquidityRowSchema, LiquidityBucketRowSchema]))
  })
});
