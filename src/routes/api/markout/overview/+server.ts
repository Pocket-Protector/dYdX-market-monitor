import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { MarkoutOverviewResponseSchema } from '$lib/features/markout/schemas';
import { copySearchParams, envelopeData, fetchJson, validateDateRange } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
  validateDateRange(url, { required: false, maxDays: 370 });
  const upstream = new URL('/api/markout/overview', API_BASE_URL);
  copySearchParams(url.searchParams, upstream);
  const body = await fetchJson(fetch, upstream, { upstreamName: 'Markout overview' });
  const parsed = envelopeData(body, MarkoutOverviewResponseSchema, 'Markout overview unavailable');
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  return json({
    ...parsed,
    range: {
      ...parsed.range,
      requestedFrom: parsed.range.requestedFrom ?? fromParam,
      requestedTo: parsed.range.requestedTo ?? toParam
    }
  });
};
