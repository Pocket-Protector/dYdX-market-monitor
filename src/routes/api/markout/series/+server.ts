import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { MarkoutSeriesResponseSchema } from '$lib/features/markout/schemas';
import { copySearchParams, envelopeData, fetchJson, validateDateRange } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

// Upstream exposes this under /series/global (not /series)
export const GET: RequestHandler = async ({ url, fetch }) => {
  validateDateRange(url, { required: false, maxDays: 370 });
  const upstream = new URL('/api/markout/series/global', API_BASE_URL);
  copySearchParams(url.searchParams, upstream);
  const body = await fetchJson(fetch, upstream, { upstreamName: 'Markout series' });
  return json(envelopeData(body, MarkoutSeriesResponseSchema, 'Markout series unavailable'));
};
