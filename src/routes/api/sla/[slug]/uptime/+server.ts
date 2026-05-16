import { json, error } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { SlaUptimeResponseSchema } from '$lib/features/sla/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  const upstream = new URL(`/api/sla/${params.slug}/uptime`, API_BASE_URL);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
  const res = await fetch(upstream.toString());
  if (!res.ok) throw error(res.status);
  const body = await res.json();
  if (body.error) throw error(503, body.error);
  try {
    return json(SlaUptimeResponseSchema.parse(body.data));
  } catch {
    throw error(502, 'Unexpected response shape from upstream');
  }
};
