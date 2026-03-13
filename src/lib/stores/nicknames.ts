import { browser } from '$app/environment';
import { writable } from 'svelte/store';

const STORAGE_KEY = 'mm-nicknames';

function load(): Record<string, string> {
  if (!browser) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(map: Record<string, string>) {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export const nicknamesStore = writable<Record<string, string>>(load());

export function getNickname(map: Record<string, string>, address: string): string | null {
  return map[address] ?? null;
}

export function setNickname(address: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    removeNickname(address);
    return;
  }
  nicknamesStore.update(map => {
    const next = { ...map, [address]: trimmed };
    persist(next);
    return next;
  });
}

export function removeNickname(address: string) {
  nicknamesStore.update(map => {
    const next = { ...map };
    delete next[address];
    persist(next);
    return next;
  });
}
