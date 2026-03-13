import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

export function updateParams(patch: Record<string, string | null>): void {
  const current = get(page);
  const params = new URLSearchParams(current.url.searchParams);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) params.delete(k);
    else params.set(k, v);
  }

  const next = params.toString();
  const prev = current.url.searchParams.toString();
  if (next === prev) return;

  const target = `${current.url.pathname}${next ? `?${next}` : ''}`;
  goto(target, {
    replaceState: true,
    noScroll: true,
    keepFocus: true,
    invalidateAll: false
  });
}
