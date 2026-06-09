import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { SlaMmMetaResponseSchema } from '$lib/features/sla/schemas';
import { envelopeData, fetchJson } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
  const upstream = new URL(`/api/sla/${params.slug}`, API_BASE_URL);
  const body = await fetchJson(fetch, upstream, { upstreamName: 'SLA' });
  return json(envelopeData(body, SlaMmMetaResponseSchema, 'SLA metadata unavailable'));
};
