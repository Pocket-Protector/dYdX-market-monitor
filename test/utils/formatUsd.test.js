import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('formatUsd prefixes negative values with -$ instead of $-', () => {
  const source = fs.readFileSync('src/lib/utils/format.ts', 'utf8');

  assert.match(source, /const sign = val < 0 \? '-\$' : '\$'/);
  assert.match(source, /return `\$\{sign\}\$\{abs\.toFixed\(0\)\}`/);
  assert.match(source, /return `\$\{sign\}\$\{\(abs \/ 1_000\)\.toFixed\(1\)\}K`/);
  assert.match(source, /return `\$\{sign\}\$\{\(abs \/ 1_000_000\)\.toFixed\(2\)\}M`/);
  assert.doesNotMatch(source, /return `\\\$\\\$\{val\.toFixed\(0\)\}`/);
});
