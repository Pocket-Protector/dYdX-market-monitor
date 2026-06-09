import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apiFetch } from '$lib/api/client';
import type { SlaLandingResponse } from '$lib/features/sla/types';
import { validateDateRange } from '$lib/server/upstream';

function subDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ url }) => {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = subDays(today, 2);
  if (url.searchParams.has('from') || url.searchParams.has('to')) {
    validateDateRange(url, { maxDays: 370 });
  }
  const from = url.searchParams.get('from') ?? defaultFrom;
  const to = url.searchParams.get('to') ?? today;

  let raw: { data: SlaLandingResponse };
  try {
    raw = (await apiFetch('/api/sla', { from, to }, { cacheTtlMs: 5 * 60_000 })) as { data: SlaLandingResponse };
  } catch {
    throw error(503, 'Backend temporarily unavailable — please try again in a moment.');
  }
  const rows = raw.data.rows;

  const minDate = rows.reduce(
    (min, r) => (r.firstTrackingDate < min ? r.firstTrackingDate : min),
    rows[0]?.firstTrackingDate ?? today
  );

  return { rows, from, to, minDate };
};
