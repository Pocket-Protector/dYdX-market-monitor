import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { getMmBySlug } from '$lib/config/mms';
import { SummaryResponseSchema } from '$lib/features/summary/schemas';

export const GET: RequestHandler = async ({ url }) => {
  const slug = url.searchParams.get('slug');
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const ticker = url.searchParams.get('ticker') ?? '';

  if (!slug) throw error(400, 'Missing slug');
  const mm = getMmBySlug(slug);
  if (!mm) throw error(404, `Unknown slug: ${slug}`);

  try {
    const raw = await apiFetch('/summary', { mm: mm.address, from, to, ticker });
    const parsed = SummaryResponseSchema.parse(raw);
    return json({
      request: { ticker },
      rows: parsed.data.results
    });
  } catch (e) {
    return json({ error: String(e) }, { status: 502 });
  }
};
