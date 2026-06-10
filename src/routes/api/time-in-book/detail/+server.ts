import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { TibDetailResponseSchema } from '$lib/features/time-in-book/schemas';

export const GET: RequestHandler = async () => {
  try {
    const body = await apiFetch('/api/time-in-book/detail', undefined, { cacheTtlMs: 60_000 });
    const parsed = TibDetailResponseSchema.parse(body);
    return json(parsed);
  } catch {
    return json({
      meta: { endpoint: '/api/time-in-book/detail' },
      data: null,
      error: 'Time-in-book detail unavailable'
    });
  }
};
