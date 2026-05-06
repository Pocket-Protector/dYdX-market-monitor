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
  const parsed = MarkoutMmResponseSchema.parse(body.data);
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
