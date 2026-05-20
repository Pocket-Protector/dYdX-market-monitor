import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { MmQuotesDetailResponseSchema } from '$lib/features/mm-quotes/schemas';

export const GET: RequestHandler = async () => {
  const body = await apiFetch('/api/mm-quotes/detail', undefined, { cacheTtlMs: 30_000 });
  const parsed = MmQuotesDetailResponseSchema.parse(body);
  return json(parsed);
};
