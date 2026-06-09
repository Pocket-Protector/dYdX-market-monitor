import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { SlaLandingResponseSchema } from '$lib/features/sla/schemas';
import { copySearchParams, envelopeData, fetchJson, validateDateRange } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
  validateDateRange(url, { maxDays: 370 });
  const upstream = new URL('/api/sla', API_BASE_URL);
  copySearchParams(url.searchParams, upstream);
  const body = await fetchJson(fetch, upstream, { upstreamName: 'SLA' });
  return json(envelopeData(body, SlaLandingResponseSchema, 'SLA data unavailable'));
};
