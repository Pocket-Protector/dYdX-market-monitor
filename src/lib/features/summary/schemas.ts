import { z } from 'zod';

export const SummaryRowSchema = z.object({
  ticker: z.string(),
  totalMinutes: z.number(),
  twoSidedMinutes: z.number(),
  uptimePct: z.number().nullable(),
  medianBidOuterBps: z.number().nullable(),
  medianAskOuterBps: z.number().nullable(),
  medianBidTotalUsd: z.number().nullable(),
  medianAskTotalUsd: z.number().nullable()
});

export const SummaryResponseSchema = z.object({
  data: z.object({
    mm: z.string(),
    from: z.string(),
    to: z.string(),
    results: z.array(SummaryRowSchema)
  })
});
