export type Preset = '24h' | '7d' | '14d' | '30d';

export function presetToFromTo(preset: Preset): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (preset === '24h') from.setDate(from.getDate() - 1);
  else if (preset === '7d') from.setDate(from.getDate() - 7);
  else if (preset === '14d') from.setDate(from.getDate() - 14);
  else from.setDate(from.getDate() - 30);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

export function isCurrent24hRange(from: string, to: string): boolean {
  const current = presetToFromTo('24h');
  return from === current.from && to === current.to;
}

export function formatDateRange(from: string, to: string): string {
  return `${from} -> ${to}`;
}
