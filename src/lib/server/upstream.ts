import { error } from '@sveltejs/kit';
import type { z } from 'zod';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_TIMEOUT_MS = 28_000;

type FetchLike = typeof fetch;

export interface DateRange {
  from: string;
  to: string;
}

export function copySearchParams(source: URLSearchParams, target: URL): void {
  source.forEach((value, key) => target.searchParams.set(key, value));
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateDateRange(
  url: URL,
  {
    fromKey = 'from',
    toKey = 'to',
    required = true,
    maxDays = 370
  }: {
    fromKey?: string;
    toKey?: string;
    required?: boolean;
    maxDays?: number;
  } = {}
): DateRange | null {
  const from = url.searchParams.get(fromKey);
  const to = url.searchParams.get(toKey);

  if (!from && !to && !required) return null;
  if (!from || !to) throw error(400, `Missing ${fromKey}/${toKey}`);
  if (!isValidDateOnly(from) || !isValidDateOnly(to)) {
    throw error(400, `${fromKey}/${toKey} must be YYYY-MM-DD`);
  }
  if (from > to) throw error(400, `${fromKey} must be before or equal to ${toKey}`);

  const days = Math.floor(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000
  ) + 1;
  if (days > maxDays) throw error(400, `Date range cannot exceed ${maxDays} days`);

  return { from, to };
}

export async function fetchJson(
  fetcher: FetchLike,
  url: URL,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    upstreamName = 'upstream'
  }: {
    timeoutMs?: number;
    upstreamName?: string;
  } = {}
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url.toString(), { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw error(503, `${upstreamName} temporarily unavailable`);
  }

  if (!res.ok) {
    const status = res.status >= 500 ? 502 : res.status;
    throw error(status, `${upstreamName} request failed`);
  }

  try {
    return await res.json();
  } catch {
    throw error(502, `Invalid JSON from ${upstreamName}`);
  }
}

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, label = 'upstream response'): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw error(502, `Unexpected ${label} shape`);
  return parsed.data;
}

export function envelopeData<T>(
  body: unknown,
  schema: z.ZodType<T>,
  fallbackMessage: string
): T {
  if (typeof body !== 'object' || body === null) throw error(502, fallbackMessage);
  const envelope = body as { data?: unknown; error?: unknown };
  if (typeof envelope.error === 'string' && envelope.error) {
    throw error(400, fallbackMessage);
  }
  if (envelope.data == null) throw error(502, fallbackMessage);
  return parseWithSchema(schema, envelope.data, 'upstream data');
}
