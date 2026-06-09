import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { MarkoutMetaSchema } from '$lib/features/markout/schemas';
import { copySearchParams, envelopeData, fetchJson } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const upstream = new URL('/api/markout/meta', API_BASE_URL);
  copySearchParams(url.searchParams, upstream);
  const body = await fetchJson(fetch, upstream, { upstreamName: 'Markout metadata' });
  return json(envelopeData(body, MarkoutMetaSchema, 'Markout metadata unavailable'));
};
