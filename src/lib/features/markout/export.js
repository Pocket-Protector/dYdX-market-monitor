/** @typedef {import('./types').MarkoutOverviewRow} MarkoutOverviewRow */
/** @typedef {import('./types').MarkoutMmDetailRow} MarkoutMmDetailRow */
/** @typedef {import('./types').MarkoutView} MarkoutView */
/** @typedef {import('./types').MarkoutHorizon} MarkoutHorizon */

/** @type {MarkoutHorizon[]} */
const MARKOUT_HORIZONS = ['2s', '3s', '5s', '10s', '20s', '30s', '60s', '300s'];

/** @type {string[]} */
const CSV_HEADERS = [
  'view',
  'mm',
  'fills',
  'avg_fill_size',
  'tickers',
  'total_pnl',
  'net_funding',
  'total_volume',
  'maker_vol_pct',
  'maker_taker_ratio',
  ...MARKOUT_HORIZONS.map((horizon) => `${horizon}_pnl`)
];

/**
 * @param {string | number | null | undefined} value
 */
function escapeCsv(value) {
  if (value == null) return '';
  const raw = String(value);
  if (!/[",\n]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

/**
 * @param {MarkoutOverviewRow & { color: string }} row
 * @param {MarkoutView} view
 */
function toCsvFields(row, view) {
  /** @type {(string | number | null)[]} */
  const horizonValues = [];
  for (const horizon of MARKOUT_HORIZONS) {
    horizonValues.push(row.horizons[horizon]);
  }

  return [
    view,
    row.name,
    row.fills,
    row.avgOrderSize,
    row.tickerCount,
    row.totalPnl,
    row.netFunding,
    row.totalVolume,
    row.makerVolPct,
    row.makerTakerRatio,
    ...horizonValues
  ];
}

/**
 * @param {(MarkoutOverviewRow & { color: string })[]} rows
 * @param {MarkoutView} view
 */
export function buildMarkoutGlobalCsv(rows, view) {
  return [CSV_HEADERS.join(','), ...rows.map((row) => toCsvFields(row, view).map(escapeCsv).join(','))].join('\n');
}

/**
 * @param {MarkoutView} view
 * @param {Date} [now]
 */
export function buildMarkoutGlobalCsvFilename(view, now = new Date()) {
  const isoDate = now.toISOString().slice(0, 10);
  return `markout-global-${view}-${isoDate}.csv`;
}

/** @type {string[]} */
const TICKER_CSV_HEADERS = [
  'view',
  'mm',
  'ticker',
  'fills',
  'avg_fill_size',
  'net_funding',
  ...MARKOUT_HORIZONS.map((horizon) => `${horizon}_pnl`)
];

/**
 * @param {MarkoutMmDetailRow} row
 * @param {MarkoutView} view
 * @param {string} mmName
 */
function toTickerCsvFields(row, view, mmName) {
  /** @type {(string | number | null)[]} */
  const horizonValues = [];
  for (const horizon of MARKOUT_HORIZONS) {
    horizonValues.push(row.horizons[horizon]);
  }
  return [view, mmName, row.ticker, row.fills, row.avgOrderSize, row.netFunding, ...horizonValues];
}

/**
 * @param {MarkoutMmDetailRow[]} rows
 * @param {MarkoutView} view
 * @param {string} mmName
 */
export function buildMarkoutTickerCsv(rows, view, mmName) {
  return [
    TICKER_CSV_HEADERS.join(','),
    ...rows.map((row) => toTickerCsvFields(row, view, mmName).map(escapeCsv).join(','))
  ].join('\n');
}

/**
 * @param {string} mmSlug
 * @param {MarkoutView} view
 * @param {Date} [now]
 */
export function buildMarkoutTickerCsvFilename(mmSlug, view, now = new Date()) {
  const isoDate = now.toISOString().slice(0, 10);
  return `markout-${mmSlug}-${view}-${isoDate}.csv`;
}
