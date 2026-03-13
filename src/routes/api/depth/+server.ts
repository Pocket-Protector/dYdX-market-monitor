import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { getMmBySlug } from '$lib/config/mms';

export const GET: RequestHandler = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  const usd = url.searchParams.get('usd') ?? '100000';
  const side = url.searchParams.get('side') ?? 'both';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const bucket = url.searchParams.get('bucket') ?? 'none';
  const ticker = url.searchParams.get('ticker') ?? '';

  if (!slug) throw error(400, 'Missing slug');
  const mm = getMmBySlug(slug);
  if (!mm) throw error(404, `Unknown slug: ${slug}`);

  try {
    const raw = await apiFetch('/depth', { mm: mm.address, usd, side, from, to, bucket, ticker });
    return json((raw as { data: unknown }).data ?? { results: [] });
  } catch (e) {
    return json({ error: String(e) }, { status: 502 });
  }
};
