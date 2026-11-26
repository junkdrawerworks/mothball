import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthsUntil, seasonName } from '../js/sample.js';

test('months until a season comes round', () => {
  const nov = new Date(2026, 10, 26);
  assert.equal(monthsUntil('christmas', nov), 1);
  assert.equal(monthsUntil('halloween', nov), 11);
  assert.equal(monthsUntil('thanksgiving', nov), 0);
  assert.equal(monthsUntil('other', nov), 99);
  assert.equal(seasonName('winter'), 'Winter');
});
