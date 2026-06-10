import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { TibOverviewResponseSchema } from '$lib/features/time-in-book/schemas';

export const GET: RequestHandler = async () => {
  try {
    const body = await apiFetch('/api/time-in-book/overview', undefined, { cacheTtlMs: 60_000 });
    const parsed = TibOverviewResponseSchema.parse(body);
    return json(parsed);
  } catch {
    return json({
      meta: { endpoint: '/api/time-in-book/overview' },
      data: null,
      error: 'Time-in-book overview unavailable'
    });
  }
};
