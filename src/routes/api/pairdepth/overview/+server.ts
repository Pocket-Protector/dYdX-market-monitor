import { json, error } from '@sveltejs/kit';
import { PAIRDEPTH_API_BASE_URL } from '$env/static/private';
import { PairDepthOverviewResponseSchema } from '$lib/features/pairdepth/schemas';
import type { RequestHandler } from './$types';

const CACHE_TTL_MS = 30_000;

let cached: { value: unknown; expiresAt: number } | null = null;
let inFlight: Promise<unknown> | null = null;

export const GET: RequestHandler = async ({ fetch, setHeaders }) => {
  setHeaders({ 'cache-control': 'public, max-age=30' });

  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return json(cached.value);
  }
  if (inFlight) {
    const value = await inFlight;
    return json(value);
  }

  const upstream = new URL('/pairdepth-repo/overview', PAIRDEPTH_API_BASE_URL);

  inFlight = (async () => {
    const res = await fetch(upstream.toString(), { signal: AbortSignal.timeout(28_000) });
    if (!res.ok) throw error(res.status, `pairdepth upstream ${res.status}`);
    const body = await res.json();
    const parsed = PairDepthOverviewResponseSchema.parse(body);
    cached = { value: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
    return parsed;
  })().finally(() => {
    inFlight = null;
  });

  const value = await inFlight;
  return json(value);
};
