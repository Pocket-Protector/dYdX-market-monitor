import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apiFetch } from '$lib/api/client';
import type { SlaMmMetaResponse } from '$lib/features/sla/types';

function subDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export const load: PageServerLoad = async ({ params }) => {
  let raw: { data: SlaMmMetaResponse };
  try {
    raw = (await apiFetch(`/api/sla/${params.slug}`, undefined, { cacheTtlMs: 5 * 60_000 })) as { data: SlaMmMetaResponse };
  } catch {
    throw error(503, 'Backend temporarily unavailable — please try again in a moment.');
  }
  const { displayName, firstTrackingDate, latestDataPoint, wallets } = raw.data;

  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = subDays(today, 2);
  const defaultTo = today;

  return { slug: params.slug, displayName, firstTrackingDate, latestDataPoint, wallets, defaultFrom, defaultTo };
};
