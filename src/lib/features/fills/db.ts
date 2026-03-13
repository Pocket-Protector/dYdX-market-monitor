/**
 * IndexedDB cache for raw indexer fills.
 *
 * Storing raw fills (not aggregated) means:
 *   - Repeat visits are instant — skip the indexer entirely
 *   - If aggregation logic changes, just clear the cache;
 *     no re-fetch from the indexer is needed
 *
 * TTL strategy:
 *   - `to` < today  →  7 days  (historical data is immutable)
 *   - `to` >= today →  5 min   (intraday data is still changing)
 */

import type { IndexerFill } from './types';

export interface CachedFillsEntry {
  fills: IndexerFill[];
  isCapped: boolean;
  cachedAt: number;
  from: string;
  to: string;
}

const DB_NAME = 'dydx-mm-fills';
const STORE = 'fills_raw';
const DB_VERSION = 1;

// Singleton DB promise — opened once, reused across calls
let _db: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return _db;
  _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      _db = null; // allow retry on next call
      reject(req.error);
    };
  });
  return _db;
}

function ttlMs(to: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return to < today
    ? 7 * 24 * 60 * 60 * 1000  // 7 days for historical
    : 5 * 60 * 1000;            // 5 min for live ranges
}

function isFresh(entry: CachedFillsEntry): boolean {
  return Date.now() - entry.cachedAt < ttlMs(entry.to);
}

export async function getFillsCache(key: string): Promise<CachedFillsEntry | null> {
  try {
    const db = await openDb();
    const entry = await new Promise<CachedFillsEntry | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as CachedFillsEntry | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!entry || !isFresh(entry)) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function setFillsCache(
  key: string,
  data: Omit<CachedFillsEntry, 'cachedAt'>
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...data, cachedAt: Date.now() } satisfies CachedFillsEntry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // fail silently — cache is best-effort
    });
  } catch {
    // fail silently
  }
}

/** Quick existence check without deserializing the fills array. */
export async function hasFreshFillsCache(key: string): Promise<boolean> {
  return (await getFillsCache(key)) !== null;
}

/** Wipe the entire fills cache (useful when aggregation logic changes). */
export async function clearFillsCache(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // fail silently
  }
}
