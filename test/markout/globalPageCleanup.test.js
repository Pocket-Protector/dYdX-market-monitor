import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('global markout page removes cumulative chart and horizon selector wiring', () => {
  const pageSource = fs.readFileSync('src/routes/markoutPnL/+page.svelte', 'utf8');

  assert.doesNotMatch(pageSource, /Cumulative markout to date/);
  assert.doesNotMatch(pageSource, /MarkoutTimeSeriesChart/);
  assert.doesNotMatch(pageSource, /buildMarkoutHorizonUrl/);
  assert.doesNotMatch(pageSource, /ChartSkeleton/);
  assert.doesNotMatch(pageSource, /data\.horizon/);
  assert.doesNotMatch(pageSource, /initialSeries/);
  assert.match(pageSource, /Global MM table/);
  assert.match(pageSource, /Markout curve by horizon/);
});

test('global markout summary cards keep only the tracked-mm panel', () => {
  const pageSource = fs.readFileSync('src/routes/markoutPnL/+page.svelte', 'utf8');

  assert.doesNotMatch(pageSource, />MMs tracked</);
  assert.doesNotMatch(pageSource, />View</);
  assert.doesNotMatch(pageSource, /Best 5s markout/);
  assert.doesNotMatch(pageSource, /MMs with detail/);
});

test('global markout page keeps one consolidated info panel with trimmed copy', () => {
  const pageSource = fs.readFileSync('src/routes/markoutPnL/+page.svelte', 'utf8');

  assert.match(pageSource, /How Markout Works/);
  assert.match(pageSource, /Track maker-fill markout and view-specific price references only when needed/);
  assert.match(pageSource, /<details class="mt-6 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900\/75" open=\{false\}>/);
  assert.match(pageSource, /Maker fills only/);
  assert.match(pageSource, /How It's Measured/);
  assert.match(pageSource, /Data Availability/);
  assert.doesNotMatch(pageSource, /lg:grid-cols-\[1\.55fr_1fr\]/);
  assert.doesNotMatch(pageSource, /Table Notes And Caveats/);
  assert.doesNotMatch(pageSource, /Data through/);
  assert.doesNotMatch(pageSource, /Tracked horizons/);
  assert.doesNotMatch(pageSource, /Reference views/);
  assert.doesNotMatch(pageSource, /Avg Fill Size is average USD notional per fill/);
  assert.match(pageSource, /Markout PnL excludes taker fills/);
  assert.match(pageSource, /dYdX Mid uses dYdX's own orderbook mid/);
  assert.match(pageSource, /5s to 300s starts on 2026-04-08/);
  assert.match(pageSource, /2s and 3s start on 2026-04-24/);
  assert.match(pageSource, /All horizons start on 2026-04-24/);
  assert.match(pageSource, /border-sky-500\/40 bg-sky-500\/10 text-sky-200/);
  assert.match(pageSource, /Earlier ranges return no data/);
  assert.doesNotMatch(pageSource, /<span class="text-xs text-zinc-400">\{effectiveRange\}<\/span>/);
});

test('global markout server load no longer fetches cumulative series or parses horizon', () => {
  const serverSource = fs.readFileSync('src/routes/markoutPnL/+page.server.ts', 'utf8');

  assert.doesNotMatch(serverSource, /api\/markout\/series\/global/);
  assert.doesNotMatch(serverSource, /horizonParam/);
  assert.doesNotMatch(serverSource, /initialSeries/);
  assert.doesNotMatch(serverSource, /DEFAULT_MARKOUT_HORIZON/);
  assert.doesNotMatch(serverSource, /isValidMarkoutHorizon/);
});

test('obsolete cumulative chart helper and component are removed from the repo', () => {
  assert.equal(fs.existsSync('src/lib/features/markout/horizon-apply.js'), false);
  assert.equal(fs.existsSync('src/lib/features/markout/MarkoutTimeSeriesChart.svelte'), false);
});

test('mm detail markout route disables SSR for useSWR-driven page state', () => {
  const mmPageConfigSource = fs.readFileSync('src/routes/markoutPnL/[mm]/+page.ts', 'utf8');
  const mmPageSource = fs.readFileSync('src/routes/markoutPnL/[mm]/+page.svelte', 'utf8');

  assert.match(mmPageConfigSource, /export const ssr = false/);
  assert.match(mmPageSource, /useSWR<MarkoutMmResponse>\(/);
});

test('mm detail summary cards no longer include the 5s pnl panel', () => {
  const mmPageSource = fs.readFileSync('src/routes/markoutPnL/[mm]/+page.svelte', 'utf8');

  assert.doesNotMatch(mmPageSource, />5s PnL</);
});

test('mm detail summary cards show total volume and days tracked instead of avg fill size', () => {
  const mmPageSource = fs.readFileSync('src/routes/markoutPnL/[mm]/+page.svelte', 'utf8');

  assert.match(mmPageSource, />Total volume</);
  assert.match(mmPageSource, />Days tracked</);
  assert.doesNotMatch(mmPageSource, />Avg fill size</);
  assert.match(mmPageSource, /summaryRow\.totalVolume/);
  assert.match(mmPageSource, /range\.effectiveFrom/);
  assert.match(mmPageSource, /range\.effectiveTo/);
});

test('mm detail page removes the redundant mm detail context panel', () => {
  const mmPageSource = fs.readFileSync('src/routes/markoutPnL/[mm]/+page.svelte', 'utf8');

  assert.doesNotMatch(mmPageSource, /MM Detail Context/);
  assert.doesNotMatch(mmPageSource, /detailCopy/);
});
