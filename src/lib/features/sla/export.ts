import type { SlaLiquidityRow, SlaUptimeRow } from './types';

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return '';
  const raw = String(value);
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

// --- Liquidity ---

const LIQUIDITY_HEADERS = [
  'mm_slug',
  'from',
  'to',
  'ticker',
  'avg_liquidity_quoted_usd',
  'sla_usd',
  'liquidity_covered_pct',
  'uptime_pct',
  'maker_volume_usd',
  'taker_volume_usd',
  'total_volume_usd'
];

function toLiquidityCsvFields(row: SlaLiquidityRow, mmSlug: string, from: string, to: string) {
  return [
    mmSlug,
    from,
    to,
    row.ticker,
    row.avgLiquidityQuotedUsd,
    row.slaUsd,
    row.liquidityCoveredPct,
    row.uptimePct,
    row.makerVolumeUsd,
    row.takerVolumeUsd,
    row.totalVolumeUsd
  ];
}

export function buildSlaLiquidityCsv(rows: SlaLiquidityRow[], mmSlug: string, from: string, to: string): string {
  return [
    LIQUIDITY_HEADERS.join(','),
    ...rows.map((row) => toLiquidityCsvFields(row, mmSlug, from, to).map(escapeCsv).join(','))
  ].join('\n');
}

export function buildSlaLiquidityCsvFilename(mmSlug: string, from: string, to: string): string {
  return `sla-liquidity-${mmSlug}-${from}-${to}.csv`;
}

// --- Uptime Detail ---

const UPTIME_HEADERS = [
  'mm_slug',
  'from',
  'to',
  'group_name',
  'ticker',
  'tick_bps',
  'l1_adj_bps',
  'l1_usd',
  'l1_filled_at_bps',
  'l1_uptime_pct',
  'l2_adj_bps',
  'l2_usd',
  'l2_filled_at_bps',
  'l2_uptime_pct'
];

function toUptimeCsvFields(row: SlaUptimeRow, mmSlug: string, from: string, to: string) {
  return [
    mmSlug,
    from,
    to,
    row.groupName,
    row.ticker,
    row.tickBps,
    row.l1AdjBps,
    row.l1Usd,
    row.l1FilledAtBps,
    row.l1UptimePct,
    row.l2AdjBps,
    row.l2Usd,
    row.l2FilledAtBps,
    row.l2UptimePct
  ];
}

export function buildSlaUptimeCsv(rows: SlaUptimeRow[], mmSlug: string, from: string, to: string): string {
  return [
    UPTIME_HEADERS.join(','),
    ...rows.map((row) => toUptimeCsvFields(row, mmSlug, from, to).map(escapeCsv).join(','))
  ].join('\n');
}

export function buildSlaUptimeCsvFilename(mmSlug: string, from: string, to: string, leeway = 0): string {
  const leewayTag = leeway > 0 ? `-leeway${leeway}` : '';
  return `sla-uptime-${mmSlug}-${from}-${to}${leewayTag}.csv`;
}
