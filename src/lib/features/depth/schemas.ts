import { z } from 'zod';

export const DepthRowSchema = z.object({
  ticker: z.string(),
  minutesIncluded: z.number(),
  minutesExcluded: z.number(),
  medianBidFillBps: z.number().nullable(),
  medianAskFillBps: z.number().nullable(),
  medianBothFillBps: z.number().nullable(),
  medianCombinedFillBps: z.number().nullable()
});

export const DepthBucketRowSchema = z.object({
  ticker: z.string(),
  buckets: z.array(
    z.object({
      bucket: z.string(),
      minutesIncluded: z.number(),
      medianBidFillBps: z.number().nullable(),
      medianAskFillBps: z.number().nullable(),
      medianCombinedFillBps: z.number().nullable()
    })
  )
});

export const DepthResponseSchema = z.object({
  data: z.object({
    mm: z.string(),
    usd: z.number(),
    from: z.string(),
    to: z.string(),
    results: z.array(z.union([DepthRowSchema, DepthBucketRowSchema]))
  })
});
