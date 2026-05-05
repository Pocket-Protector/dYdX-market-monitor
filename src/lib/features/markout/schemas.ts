import { z } from 'zod';

const HorizonKeySchema = z.enum(['2s', '3s', '5s', '10s', '20s', '30s', '60s', '300s']);
const ViewKeySchema = z.enum(['dydx', 'index']);

const MarkoutRangeSchema = z.object({
  requestedFrom: z.string().nullable(),
  requestedTo: z.string().nullable(),
  effectiveFrom: z.string(),
  effectiveTo: z.string()
});

const HorizonsSchema = z.record(z.string(), z.number().nullable());

export const MarkoutMetaSchema = z.object({
  views: z.array(z.object({ key: ViewKeySchema, label: z.string() })),
  horizons: z.array(HorizonKeySchema),
  defaultHorizon: HorizonKeySchema,
  availability: z.record(
    z.string(),
    z.object({
      minDate: z.string(),
      maxDate: z.string(),
      horizonStarts: z.record(z.string(), z.string())
    })
  ),
  lastUpdatedAt: z.string().nullable(),
  uiNotes: z.object({
    global: z.array(z.string()),
    table: z.array(z.string()),
    mmDetail: z.array(z.string())
  })
});

export const MarkoutOverviewResponseSchema = z.object({
  view: ViewKeySchema,
  range: MarkoutRangeSchema,
  rows: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      fills: z.number().nullable(),
      avgOrderSize: z.number().nullable(),
      tickerCount: z.number().nullable(),
      totalVolume: z.number().nullable(),
      makerVolPct: z.number().nullable(),
      takerVolPct: z.number().nullable(),
      makerTakerRatio: z.number().nullable(),
      horizons: HorizonsSchema,
      hasDetail: z.boolean()
    })
  )
});

export const MarkoutSeriesResponseSchema = z.object({
  view: ViewKeySchema,
  horizon: HorizonKeySchema,
  range: MarkoutRangeSchema,
  series: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      trackedFrom: z.string().nullable(),
      points: z.array(z.object({ ts: z.string(), value: z.number() }))
    })
  )
});

export const MarkoutMmResponseSchema = z.object({
  mm: z.object({ slug: z.string(), name: z.string(), hasDetail: z.boolean() }),
  range: MarkoutRangeSchema,
  summaryRow: z.object({
    fills: z.number().nullable(),
    avgOrderSize: z.number().nullable(),
    tickerCount: z.number().nullable(),
    totalVolume: z.number().nullable(),
    makerVolPct: z.number().nullable(),
    takerVolPct: z.number().nullable(),
    makerTakerRatio: z.number().nullable(),
    horizons: HorizonsSchema
  }),
  detailRows: z.array(
    z
      .object({
        ticker: z.string(),
        fills: z.number().nullable(),
        avgOrderSize: z.number().nullable(),
        horizons: HorizonsSchema
      })
      .passthrough()
  )
});
