export function shortTicker(raw: string): string {
  if (!raw.includes(',')) return raw;
  return raw.split(',')[0] + '-USD';
}

export function formatCompact(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  if (val > 0) return `$${val.toFixed(0)}`;
  return '—';
}

export function formatUsd(val: number | null | undefined): string {
  if (val == null) return '—';
  const abs = Math.abs(val);
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export function formatBps(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${val.toFixed(1)}`;
}

export function formatPct(val: number | null | undefined): string {
  if (val == null) return '—';
  return `${val.toFixed(1)}%`;
}
