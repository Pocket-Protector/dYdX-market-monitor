export type Preset = '24h' | '7d' | '14d' | '30d';

const todayUtc = () => new Date().toISOString().slice(0, 10);

/**
 * Returns a `to` param for use in API calls.
 * - If the date is today: returns a full ISO timestamp so live/partial-day data is included.
 * - If the date is a past day: returns YYYY-MM-DD (midnight boundary) so the full completed day is included.
 */
export function toParam(date: Date): string {
  return date.toISOString().slice(0, 10) === todayUtc()
    ? date.toISOString()
    : date.toISOString().slice(0, 10);
}

export function presetToFromTo(preset: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === '24h') { /* from = today, no adjustment needed */ }
  else if (preset === '7d') from.setDate(from.getDate() - 7);
  else if (preset === '14d') from.setDate(from.getDate() - 14);
  else from.setDate(from.getDate() - 30);

  return {
    from: from.toISOString().slice(0, 10),
    to: toParam(to)
  };
}

export function isCurrent24hRange(from: string, to: string): boolean {
  const current = presetToFromTo('24h');
  return from === current.from && to.slice(0, 10) === current.to.slice(0, 10);
}

export function formatDateRange(from: string, to: string): string {
  return `${from} -> ${to}`;
}
