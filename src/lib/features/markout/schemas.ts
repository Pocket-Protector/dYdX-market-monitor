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

const ApiEnvelopeMetaSchema = z
  .object({
    endpoint: z.string().optional(),
    notes: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    code: z.string().optional()
  })
  .passthrough();

export function ApiEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    meta: ApiEnvelopeMetaSchema,
    data: dataSchema.nullable(),
    error: z.string().nullable()
  });
}

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

export const PnlOverviewResponseSchema = z.object({
  rows: z.array(
    z.object({
      mmSlug: z.string(),
      displayName: z.string(),
      periodPnlUsd: z.number().nullable(),
      startTotalPnl: z.number().nullable(),
      endTotalPnl: z.number().nullable(),
      walletCount: z.number()
    })
  )
});

export const PnlMmResponseSchema = z.object({
  mmSlug: z.string(),
  displayName: z.string(),
  periodPnlUsd: z.number().nullable(),
  startTotalPnl: z.number().nullable(),
  endTotalPnl: z.number().nullable(),
  startEquity: z.number().nullable(),
  endEquity: z.number().nullable(),
  netTransfersDelta: z.number().nullable(),
  byWallet: z.array(
    z.object({
      address: z.string(),
      subaccountNumber: z.number(),
      periodPnlUsd: z.number().nullable(),
      startTotalPnl: z.number().nullable(),
      endTotalPnl: z.number().nullable(),
      startEquity: z.number().nullable(),
      endEquity: z.number().nullable(),
      snapshotsInWindow: z.number()
    })
  ),
  range: z.object({ from: z.string(), to: z.string() })
});

export const FundingOverviewResponseSchema = z.object({
  rows: z.array(
    z.object({
      mmSlug: z.string(),
      displayName: z.string(),
      totalPaymentUsd: z.number().nullable(),
      rowCount: z.number()
    })
  )
});

export const FundingMmResponseSchema = z.object({
  mmSlug: z.string(),
  displayName: z.string(),
  totalPaymentUsd: z.number().nullable(),
  rowCount: z.number(),
  byTicker: z.array(
    z.object({
      ticker: z.string(),
      paymentUsd: z.number().nullable(),
      rowCount: z.number()
    })
  ),
  range: z.object({ from: z.string(), to: z.string() })
});
