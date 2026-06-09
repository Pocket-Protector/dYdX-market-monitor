import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { SlaUptimeResponseSchema } from '$lib/features/sla/schemas';
import { copySearchParams, envelopeData, fetchJson, validateDateRange } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  validateDateRange(url, { maxDays: 370 });
  const upstream = new URL(`/api/sla/${params.slug}/uptime`, API_BASE_URL);
  copySearchParams(url.searchParams, upstream);
  const body = await fetchJson(fetch, upstream, { upstreamName: 'SLA uptime' });
  return json(envelopeData(body, SlaUptimeResponseSchema, 'SLA uptime data unavailable'));
};
