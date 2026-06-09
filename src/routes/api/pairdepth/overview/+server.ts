import { json } from '@sveltejs/kit';
import { PAIRDEPTH_API_BASE_URL } from '$env/static/private';
import { PairDepthOverviewResponseSchema } from '$lib/features/pairdepth/schemas';
import { fetchJson, parseWithSchema } from '$lib/server/upstream';
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
    const body = await fetchJson(fetch, upstream, { timeoutMs: 28_000, upstreamName: 'PairDepth' });
    const parsed = parseWithSchema(PairDepthOverviewResponseSchema, body, 'PairDepth overview response');
    cached = { value: parsed, expiresAt: Date.now() + CACHE_TTL_MS };
    return parsed;
  })().finally(() => {
    inFlight = null;
  });

  try {
    const value = await inFlight;
    return json(value);
  } catch {
    if (cached) return json(cached.value);
    const nowIso = new Date().toISOString();
    return json({
      meta: {
        endpoint: '/api/pairdepth/overview',
        window: { from24h: nowIso, to: nowIso, from14d: nowIso },
        notes: ['PairDepth data is temporarily unavailable. Overview core market data is still shown.']
      },
      data: null,
      error: 'PairDepth unavailable'
    });
  }
};
