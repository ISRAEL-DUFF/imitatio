import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTheme, TEXT_SIZES } from '../src/lib/appearance.ts';

test('an explicit theme wins over the system; "system" follows it', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

test('text sizes scale from the browser default', () => {
  assert.equal(TEXT_SIZES.medium.percent, 100);
  assert.ok(TEXT_SIZES.small.percent < 100 && TEXT_SIZES.larger.percent > TEXT_SIZES.large.percent);
});
