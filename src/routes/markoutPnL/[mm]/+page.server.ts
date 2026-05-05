import type { PageServerLoad } from './$types';
import { apiFetch } from '$lib/api/client';
import {
  isValidMarkoutView,
  type MarkoutMeta,
  type MarkoutView
} from '$lib/features/markout/types';

function subDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function clampDate(date: string | null, min: string, max: string): string {
  if (!date) return min;
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export const load: PageServerLoad = async ({ params, url }) => {
  const raw = (await apiFetch('/api/markout/meta')) as { data: MarkoutMeta };
  const meta = raw.data;

  const viewParam = url.searchParams.get('view');
  const view: MarkoutView = isValidMarkoutView(viewParam) ? viewParam : 'dydx';

  const { minDate, maxDate } = meta.availability[view];
  const defaultFrom = clampDate(subDays(maxDate, 7), minDate, maxDate);
  const from = clampDate(url.searchParams.get('from') ?? defaultFrom, minDate, maxDate);
  const to = clampDate(url.searchParams.get('to') ?? maxDate, minDate, maxDate);

  // tableFrom/tableTo carried from the overview page for the back-link
  const tableFrom = url.searchParams.get('tableFrom');
  const tableTo = url.searchParams.get('tableTo');

  return { meta, slug: params.mm, view, from, to, tableFrom, tableTo };
};
