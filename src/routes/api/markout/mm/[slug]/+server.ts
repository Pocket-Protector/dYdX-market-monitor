import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { MarkoutMmResponseSchema } from '$lib/features/markout/schemas';
import { copySearchParams, envelopeData, fetchJson, validateDateRange } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  validateDateRange(url, { required: false, maxDays: 370 });
  const upstream = new URL(`/api/markout/mm/${params.slug}`, API_BASE_URL);
  copySearchParams(url.searchParams, upstream);
  const body = await fetchJson(fetch, upstream, { upstreamName: 'Markout MM' });
  const parsed = envelopeData(body, MarkoutMmResponseSchema, 'Markout MM data unavailable');
  // Always echo URL params back as requestedFrom/requestedTo so the client-side
  // dataIsFresh check (requestedFrom === from) reliably resolves. The upstream
  // sometimes returns null for boundary dates (e.g. from === dataset minDate).
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  return json({
    ...parsed,
    range: {
      ...parsed.range,
      requestedFrom: fromParam,
      requestedTo: toParam
    }
  });
};
