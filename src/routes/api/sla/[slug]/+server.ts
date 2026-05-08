import { json, error } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { SlaMmMetaResponseSchema } from '$lib/features/sla/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
  const upstream = new URL(`/api/sla/${params.slug}`, API_BASE_URL);
  const res = await fetch(upstream.toString());
  if (!res.ok) throw error(res.status);
  const body = await res.json();
  if (body.error) throw error(400, body.error);
  return json(SlaMmMetaResponseSchema.parse(body.data));
};
