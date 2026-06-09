import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { SlaConfigResponseSchema } from '$lib/features/sla/schemas';
import { envelopeData, fetchJson } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
  const upstream = new URL(`/api/sla/${params.slug}/config`, API_BASE_URL);
  const body = await fetchJson(fetch, upstream, { upstreamName: 'SLA config' });
  return json(envelopeData(body, SlaConfigResponseSchema, 'SLA config unavailable'));
};
