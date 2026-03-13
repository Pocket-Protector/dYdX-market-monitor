import { writable } from 'svelte/store';

export type PrefetchStatus = 'idle' | 'loading' | 'done' | 'error';

export interface TabPrefetchStatus {
  label: string;
  status: PrefetchStatus;
  active: boolean;
}

export const prefetchStatuses = writable<TabPrefetchStatus[]>([]);
export const lastPrefetchAt = writable<number | null>(null);
