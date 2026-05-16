import { json, error } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { ApiEnvelopeSchema, PnlMmResponseSchema } from '$lib/features/markout/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  const upstream = new URL(`/api/pnl/${params.slug}`, API_BASE_URL);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  const res = await fetch(upstream.toString());
  if (!res.ok) throw error(res.status, await res.text());

  const envelope = ApiEnvelopeSchema(PnlMmResponseSchema).parse(await res.json());
  if (envelope.error || !envelope.data) throw error(400, envelope.error ?? 'PnL data unavailable');

  return json(envelope.data);
};
