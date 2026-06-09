import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { MmQuotesOverviewResponseSchema } from '$lib/features/mm-quotes/schemas';

export const GET: RequestHandler = async () => {
  try {
    const body = await apiFetch('/api/mm-quotes/overview', undefined, { cacheTtlMs: 30_000 });
    const parsed = MmQuotesOverviewResponseSchema.parse(body);
    return json(parsed);
  } catch {
    const now = new Date().toISOString();
    return json({
      meta: {
        endpoint: '/api/mm-quotes/overview',
        window: { from: now, to: now, minutes: 0 },
        notes: ['MM quote overview data is temporarily unavailable.']
      },
      data: null,
      error: 'MM quote overview unavailable'
    });
  }
};
