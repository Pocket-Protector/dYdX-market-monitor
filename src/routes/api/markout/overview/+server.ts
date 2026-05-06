import { json, error } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { MarkoutOverviewResponseSchema } from '$lib/features/markout/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const upstream = new URL('/api/markout/overview', API_BASE_URL);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
  const res = await fetch(upstream.toString());
  if (!res.ok) throw error(res.status);
  const body = await res.json();
  if (body.error) throw error(400, body.error);
  const parsed = MarkoutOverviewResponseSchema.parse(body.data);
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
