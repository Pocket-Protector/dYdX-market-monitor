import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { TradingHoursSummaryResponseSchema } from '$lib/features/trading-hours/schemas';

export const GET: RequestHandler = async ({ url }) => {
  const week = url.searchParams.get('week') ?? undefined;
  try {
    const body = await apiFetch(
      '/api/trading-hours/summary',
      week ? { week } : undefined,
      { cacheTtlMs: 300_000 }
    );
    const parsed = TradingHoursSummaryResponseSchema.parse(body);
    return json(parsed);
  } catch {
    return json({
      meta: { endpoint: '/api/trading-hours/summary' },
      data: null,
      error: 'Trading-hours summary unavailable'
    });
  }
};
