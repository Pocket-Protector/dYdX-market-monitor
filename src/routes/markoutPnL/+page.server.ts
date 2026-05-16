import type { PageServerLoad } from './$types';
import { apiFetch } from '$lib/api/client';
import {
  isValidMarkoutView,
  type FundingOverviewResponse,
  type MarkoutMeta,
  type MarkoutOverviewResponse,
  type MarkoutView,
  type PnlOverviewResponse
} from '$lib/features/markout/types';
import {
  ApiEnvelopeSchema,
  FundingOverviewResponseSchema,
  PnlOverviewResponseSchema
} from '$lib/features/markout/schemas';

function subDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function clampDate(date: string | null, min: string, max: string): string {
  if (!date) return min;
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchPnlOverview(from: string, to: string): Promise<{ data: PnlOverviewResponse | null; error: string | null }> {
  try {
    const raw = await apiFetch('/api/pnl', { from, to });
    const envelope = ApiEnvelopeSchema(PnlOverviewResponseSchema).parse(raw);
    if (envelope.error || !envelope.data) {
      return { data: null, error: envelope.error ?? 'PnL data unavailable' };
    }
    return { data: envelope.data, error: null };
  } catch (err) {
    return { data: null, error: errorMessage(err) };
  }
}

async function fetchFundingOverview(
  from: string,
  to: string
): Promise<{ data: FundingOverviewResponse | null; error: string | null }> {
  try {
    const raw = await apiFetch('/api/funding', { from, to });
    const envelope = ApiEnvelopeSchema(FundingOverviewResponseSchema).parse(raw);
    if (envelope.error || !envelope.data) {
      return { data: null, error: envelope.error ?? 'Funding data unavailable' };
    }
    return { data: envelope.data, error: null };
  } catch (err) {
    return { data: null, error: errorMessage(err) };
  }
}

export const load: PageServerLoad = async ({ url }) => {
  const raw = (await apiFetch('/api/markout/meta')) as { data: MarkoutMeta };
  const meta = raw.data;

  const viewParam = url.searchParams.get('view');
  const view: MarkoutView = isValidMarkoutView(viewParam) ? viewParam : 'dydx';

  const { minDate, maxDate } = meta.availability[view];
  const defaultFrom = clampDate(subDays(maxDate, 7), minDate, maxDate);
  const tableFrom = clampDate(url.searchParams.get('tableFrom') ?? defaultFrom, minDate, maxDate);
  const tableTo = clampDate(url.searchParams.get('tableTo') ?? maxDate, minDate, maxDate);
  const [overviewRaw, pnlResult, fundingResult] = await Promise.all([
    apiFetch('/api/markout/overview', {
      view,
      from: tableFrom,
      to: tableTo
    }) as Promise<{ data: MarkoutOverviewResponse }>,
    fetchPnlOverview(tableFrom, tableTo),
    fetchFundingOverview(tableFrom, tableTo)
  ]);

  const pnlBySlug = new Map(pnlResult.data?.rows.map((row) => [row.mmSlug, row.periodPnlUsd]) ?? []);
  const fundingBySlug = new Map(fundingResult.data?.rows.map((row) => [row.mmSlug, row.totalPaymentUsd]) ?? []);
  const initialOverview: MarkoutOverviewResponse = {
    ...overviewRaw.data,
    rows: overviewRaw.data.rows.map((row) => ({
      ...row,
      totalPnl: pnlBySlug.get(row.slug) ?? null,
      netFunding: fundingBySlug.get(row.slug) ?? null
    }))
  };

  return {
    meta,
    view,
    tableFrom,
    tableTo,
    initialOverview,
    pnlError: pnlResult.error,
    fundingError: fundingResult.error
  };
};
