import type { PageLoad } from './$types';
import type { MarkoutMmResponse } from '$lib/features/markout/types';

export const ssr = false;

export const load: PageLoad = async ({ fetch, url, params, data }) => {
  // Reading url.searchParams registers them as SvelteKit dependencies so this
  // load re-runs automatically whenever view/from/to change in the URL.
  const view = url.searchParams.get('view') ?? data.view;
  const from = url.searchParams.get('from') ?? data.from;
  const to = url.searchParams.get('to') ?? data.to;

  let mmData: MarkoutMmResponse | null = null;
  let mmError: string | null = null;

  const res = await fetch(`/api/markout/mm/${params.mm}?view=${view}&from=${from}&to=${to}`);
  if (!res.ok) {
    mmError = res.status === 404 ? '404' : `HTTP ${res.status}`;
  } else {
    mmData = await res.json();
  }

  // Spread server load data so PageData includes meta, slug, from, to, etc.
  return { ...data, mmData, mmError };
};
