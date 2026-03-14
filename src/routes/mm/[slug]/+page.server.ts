import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getMmBySlug } from '$lib/config/mms';
import { presetToFromTo } from '$lib/utils/dates';

export const load: PageServerLoad = async ({ params, url }) => {
  const { slug } = params;
  const mm = getMmBySlug(slug);
  if (!mm) throw error(404, `Unknown MM: ${slug}`);

  const defaultRange = presetToFromTo('24h');
  const from = url.searchParams.get('from') ?? defaultRange.from;
  const to = url.searchParams.get('to') ?? defaultRange.to;
  const bpsLeeway = url.searchParams.get('leeway') ?? '0';

  return {
    mm: { slug: mm.slug, name: mm.name, address: mm.address, subaccounts: mm.subaccounts },
    from,
    to,
    bpsLeeway: parseFloat(bpsLeeway)
  };
};
