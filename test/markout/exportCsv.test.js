import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMarkoutGlobalCsv, buildMarkoutGlobalCsvFilename } from '../../src/lib/features/markout/export.js';

test('buildMarkoutGlobalCsv exports headers and rows in the provided order', () => {
  const rows = [
    {
      slug: 'beta-mm',
      name: 'Beta MM',
      fills: 120,
      avgOrderSize: 1520.25,
      tickerCount: 14,
      totalPnl: 12500.75,
      netFunding: -420.5,
      totalVolume: 450000.5,
      makerVolPct: 0.64,
      takerVolPct: 0.36,
      makerTakerRatio: 1.78,
      color: '#fff',
      hasDetail: false,
      horizons: {
        '2s': 1.1,
        '3s': 1.2,
        '5s': 1.3,
        '10s': 1.4,
        '20s': 1.5,
        '30s': 1.6,
        '60s': 1.7,
        '300s': 1.8
      }
    },
    {
      slug: 'alpha-mm',
      name: 'Alpha MM',
      fills: 95,
      avgOrderSize: 980.4,
      tickerCount: 9,
      totalPnl: null,
      netFunding: 150.25,
      totalVolume: 220100,
      makerVolPct: 0.51,
      takerVolPct: 0.49,
      makerTakerRatio: null,
      color: '#000',
      hasDetail: true,
      horizons: {
        '2s': -0.1,
        '3s': -0.2,
        '5s': -0.3,
        '10s': -0.4,
        '20s': -0.5,
        '30s': -0.6,
        '60s': -0.7,
        '300s': -0.8
      }
    }
  ];

  const csv = buildMarkoutGlobalCsv(rows, 'index');
  const lines = csv.split('\n');

  assert.equal(
    lines[0],
    'view,mm,fills,avg_fill_size,tickers,total_pnl,net_funding,total_volume,maker_vol_pct,maker_taker_ratio,2s_pnl,3s_pnl,5s_pnl,10s_pnl,20s_pnl,30s_pnl,60s_pnl,300s_pnl'
  );
  assert.equal(lines[1], 'index,Beta MM,120,1520.25,14,12500.75,-420.5,450000.5,0.64,1.78,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8');
  assert.equal(lines[2], 'index,Alpha MM,95,980.4,9,,150.25,220100,0.51,,-0.1,-0.2,-0.3,-0.4,-0.5,-0.6,-0.7,-0.8');
});

test('buildMarkoutGlobalCsvFilename includes view and date', () => {
  assert.equal(buildMarkoutGlobalCsvFilename('dydx', new Date('2026-05-05T03:04:05Z')), 'markout-global-dydx-2026-05-05.csv');
});

test('buildMarkoutTickerCsv exports net funding between avg fill size and horizons', async () => {
  const { buildMarkoutTickerCsv } = await import('../../src/lib/features/markout/export.js');
  const rows = [
    {
      ticker: 'BTC-USD',
      fills: 12,
      avgOrderSize: 5000,
      netFunding: -12.34,
      horizons: {
        '2s': 2.1,
        '3s': 2.2,
        '5s': 2.3,
        '10s': 2.4,
        '20s': 2.5,
        '30s': 2.6,
        '60s': 2.7,
        '300s': 2.8
      }
    },
    {
      ticker: 'ETH-USD',
      fills: 8,
      avgOrderSize: 2500,
      netFunding: null,
      horizons: {
        '2s': -1.1,
        '3s': -1.2,
        '5s': -1.3,
        '10s': -1.4,
        '20s': -1.5,
        '30s': -1.6,
        '60s': -1.7,
        '300s': -1.8
      }
    }
  ];

  const csv = buildMarkoutTickerCsv(rows, 'dydx', 'MM, With Comma');
  const lines = csv.split('\n');

  assert.equal(
    lines[0],
    'view,mm,ticker,fills,avg_fill_size,net_funding,2s_pnl,3s_pnl,5s_pnl,10s_pnl,20s_pnl,30s_pnl,60s_pnl,300s_pnl'
  );
  assert.equal(lines[1], 'dydx,"MM, With Comma",BTC-USD,12,5000,-12.34,2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.8');
  assert.equal(lines[2], 'dydx,"MM, With Comma",ETH-USD,8,2500,,-1.1,-1.2,-1.3,-1.4,-1.5,-1.6,-1.7,-1.8');
});
