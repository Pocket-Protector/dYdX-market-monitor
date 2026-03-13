import { z } from 'zod';

const FillTickerRowSchema = z.object({
  ticker: z.string(),
  makerVolume: z.number(),
  takerVolume: z.number(),
  totalVolume: z.number(),
  makerFees: z.number(),
  takerFees: z.number(),
  netFees: z.number(),
  makerFillCount: z.number(),
  takerFillCount: z.number(),
  totalFillCount: z.number()
});

const FillsTimePointSchema = z.object({
  ts: z.string(),
  makerVolume: z.number(),
  takerVolume: z.number(),
  netFees: z.number(),
  fillCount: z.number()
});

export const FillsResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  isCapped: z.boolean(),
  summary: z.object({
    totalVolume: z.number(),
    makerVolume: z.number(),
    takerVolume: z.number(),
    netFees: z.number(),
    makerFees: z.number(),
    takerFees: z.number(),
    fillCount: z.number()
  }),
  byTicker: z.array(FillTickerRowSchema),
  timeSeries: z.array(FillsTimePointSchema)
});
