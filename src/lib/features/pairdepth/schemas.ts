import { z } from 'zod';

const WindowSchema = z.object({
  from24h: z.string(),
  to: z.string(),
  from14d: z.string()
});

const MetaSchema = z
  .object({
    endpoint: z.string(),
    window: WindowSchema,
    tooltips: z.record(z.string(), z.string()).optional(),
    notes: z.array(z.string()).optional()
  })
  .passthrough();

export const PairDepthOverviewTickerSchema = z.object({
  ticker: z.string(),
  vol14dMedianUsd: z.number().nullable(),
  spread14dBps: z.number().nullable(),
  spread24hBps: z.number().nullable(),
  spreadDeltaPct: z.number().nullable(),
  depth100bps14dUsd: z.number().nullable(),
  depth100bps24hUsd: z.number().nullable(),
  depth100bpsDeltaPct: z.number().nullable(),
  slip10kBps14d: z.number().nullable(),
  slip10kBps24h: z.number().nullable(),
  slip10kDeltaPct: z.number().nullable(),
  slip100kBps14d: z.number().nullable(),
  slip100kBps24h: z.number().nullable(),
  slip100kDeltaPct: z.number().nullable()
});

export const PairDepthOverviewResponseSchema = z.object({
  meta: MetaSchema,
  data: z.object({ tickers: z.array(PairDepthOverviewTickerSchema) }).nullable(),
  error: z.string().nullable()
});
