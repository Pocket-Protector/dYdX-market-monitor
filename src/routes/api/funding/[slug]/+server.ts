import { json } from '@sveltejs/kit';
import { API_BASE_URL } from '$env/static/private';
import { FundingMmResponseSchema } from '$lib/features/markout/schemas';
import { copySearchParams, envelopeData, fetchJson, validateDateRange } from '$lib/server/upstream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  validateDateRange(url, { required: false, maxDays: 370 });
  const upstream = new URL(`/api/funding/${params.slug}`, API_BASE_URL);
  copySearchParams(url.searchParams, upstream);

  const body = await fetchJson(fetch, upstream, { upstreamName: 'Funding' });
  return json(envelopeData(body, FundingMmResponseSchema, 'Funding data unavailable'));
};
