import { API_BASE_URL } from '$env/static/private';

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

interface ApiFetchOptions {
  bypassCache?: boolean;
}

const CACHE_TTL_MS = 8_000;
const MAX_CACHE_ITEMS = 250;

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

function pruneCache(now: number): void {
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }

  if (responseCache.size <= MAX_CACHE_ITEMS) return;

  const excess = responseCache.size - MAX_CACHE_ITEMS;
  let removed = 0;
  for (const key of responseCache.keys()) {
    responseCache.delete(key);
    removed += 1;
    if (removed >= excess) break;
  }
}

export async function apiFetch(
  path: string,
  params?: Record<string, string>,
  options: ApiFetchOptions = {}
): Promise<unknown> {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }

  const key = url.toString();

  if (options.bypassCache) {
    const res = await fetch(key, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      throw new Error(`API ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  const now = Date.now();

  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const res = await fetch(key, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      throw new Error(`API ${res.status}: ${await res.text()}`);
    }

    const payload = await res.json();
    const expiry = Date.now() + CACHE_TTL_MS;
    responseCache.set(key, { value: payload, expiresAt: expiry });
    pruneCache(Date.now());
    return payload;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, request);
  return request;
}
