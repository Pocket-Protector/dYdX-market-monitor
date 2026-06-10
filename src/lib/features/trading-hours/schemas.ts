import { z } from 'zod';

const SessionValueSchema = z.object({
  usd: z.number().nullable(),
  twoSidedMinutes: z.number()
});

const SessionKeys = [
  'overnight',
  'premarket',
  'regularTrading',
  'extendedAfterHours',
  'weekendClosed',
  'wholeWeek'
] as const;

const SessionMapSchema = z.object(
  Object.fromEntries(SessionKeys.map((k) => [k, SessionValueSchema])) as Record<
    (typeof SessionKeys)[number],
    typeof SessionValueSchema
  >
);

const WindowSessionSchema = z.object({
  minutes: z.number(),
  available: z.number()
});

const WindowSchema = z
  .object({
    weekStart: z.string(),
    weekEnd: z.string(),
    label: z.string(),
    downtimeMinutes: z.number(),
    sessions: z.object(
      Object.fromEntries(SessionKeys.map((k) => [k, WindowSessionSchema])) as Record<
        (typeof SessionKeys)[number],
        typeof WindowSessionSchema
      >
    )
  })
  .passthrough();

const MetaSchema = z
  .object({
    endpoint: z.string(),
    window: WindowSchema.optional(),
    tooltips: z.record(z.string(), z.string()).optional(),
    notes: z.array(z.string()).optional(),
    note: z.string().optional(),
    code: z.string().optional(),
    availableWeeks: z.array(z.string()).optional()
  })
  .passthrough();

export const TradingHoursSummaryTickerSchema = z.object({
  ticker: z.string(),
  mmsCount: z.number(),
  sessions: SessionMapSchema
});

export const TradingHoursSummaryResponseSchema = z.object({
  meta: MetaSchema,
  data: z.array(TradingHoursSummaryTickerSchema).nullable(),
  error: z.string().nullable()
});

export const TradingHoursDetailMmSchema = z.object({
  mmSlug: z.string(),
  displayName: z.string(),
  sessions: SessionMapSchema
});

export const TradingHoursDetailTickerSchema = TradingHoursSummaryTickerSchema.extend({
  mms: z.array(TradingHoursDetailMmSchema)
});

export const TradingHoursDetailResponseSchema = z.object({
  meta: MetaSchema,
  data: z.array(TradingHoursDetailTickerSchema).nullable(),
  error: z.string().nullable()
});
