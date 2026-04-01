import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiFetch } from '$lib/api/client';
import { getMmBySlug } from '$lib/config/mms';
import { UptimeResponseSchema } from '$lib/shared/sla/schemas';

export const GET: RequestHandler = async ({ params, url }) => {
  const { slug } = params;
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const tickSizeAdj = url.searchParams.get('tickSizeAdj') ?? 'true';

  const mm = getMmBySlug(slug);
  if (!mm) throw error(404, `Unknown slug: ${slug}`);

  try {
    const raw = await apiFetch(`/uptime/${mm.address}`, { from, to, tickSizeAdj });
    const parsed = UptimeResponseSchema.parse(raw);
    return json({ ...parsed.data, mm: slug });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('API 404')) {
      return json({ mm: slug, from, to, tickSizeAdj: tickSizeAdj !== 'false', tickers: [] });
    }
    return json({ error: msg }, { status: 502 });
  }
};
