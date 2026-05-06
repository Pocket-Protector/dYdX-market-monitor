import type { PageServerLoad } from './$types';
import { apiFetch } from '$lib/api/client';
import {
  isValidMarkoutView,
  type MarkoutMeta,
  type MarkoutOverviewResponse,
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

export const load: PageServerLoad = async ({ url }) => {
  const raw = (await apiFetch('/api/markout/meta')) as { data: MarkoutMeta };
  const meta = raw.data;

  const viewParam = url.searchParams.get('view');
  const view: MarkoutView = isValidMarkoutView(viewParam) ? viewParam : 'dydx';

  const { minDate, maxDate } = meta.availability[view];
  const defaultFrom = clampDate(subDays(maxDate, 7), minDate, maxDate);
  const tableFrom = clampDate(url.searchParams.get('tableFrom') ?? defaultFrom, minDate, maxDate);
  const tableTo = clampDate(url.searchParams.get('tableTo') ?? maxDate, minDate, maxDate);
  const overviewRaw = (await apiFetch('/api/markout/overview', {
    view,
    from: tableFrom,
    to: tableTo
  })) as { data: MarkoutOverviewResponse };

  return {
    meta,
    view,
    tableFrom,
    tableTo,
    initialOverview: overviewRaw.data
  };
};
