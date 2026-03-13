import { readFileSync } from 'fs';
import { join } from 'path';

export interface MmConfig {
  slug: string;
  name: string;
  address: string;
  subaccounts: number[];
}

let _cache: MmConfig[] | null = null;

export function getMmConfigs(): MmConfig[] {
  if (_cache) return _cache;
  try {
    const raw = readFileSync(join(process.cwd(), 'mm-config.json'), 'utf-8');
    _cache = JSON.parse(raw) as MmConfig[];
    return _cache;
  } catch {
    return [];
  }
}

export function getMmBySlug(slug: string): MmConfig | undefined {
  return getMmConfigs().find((m) => m.slug === slug);
}

export function getMmSubaccounts(slug: string): number[] {
  return getMmBySlug(slug)?.subaccounts ?? [];
}
