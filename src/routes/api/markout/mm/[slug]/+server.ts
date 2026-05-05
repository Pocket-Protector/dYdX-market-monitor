import { json, error } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { MarkoutMmResponseSchema } from '$lib/features/markout/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  const upstream = new URL(`/api/markout/mm/${params.slug}`, API_BASE_URL);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
  const res = await fetch(upstream.toString());
  if (!res.ok) throw error(res.status);
  const body = await res.json();
  if (body.error) throw error(400, body.error);
  return json(MarkoutMmResponseSchema.parse(body.data));
};
