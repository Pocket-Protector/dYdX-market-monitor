import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { MmQuotesDetailResponseSchema } from '$lib/features/mm-quotes/schemas';

export const GET: RequestHandler = async () => {
  try {
    const body = await apiFetch('/api/mm-quotes/detail', undefined, { cacheTtlMs: 30_000 });
    const parsed = MmQuotesDetailResponseSchema.parse(body);
    return json(parsed);
  } catch {
    const now = new Date().toISOString();
    return json({
      meta: {
        endpoint: '/api/mm-quotes/detail',
        window: { from: now, to: now, minutes: 0 },
        notes: ['MM quote detail data is temporarily unavailable.']
      },
      data: null,
      error: 'MM quote detail unavailable'
    });
  }
};
