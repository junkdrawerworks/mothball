import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthsUntil, seasonName } from '../js/sample.js';
import { isOut, comingDown, toteNames, tickKeys } from '../js/totes.js';

test('months until a season comes round', () => {
  const nov = new Date(2026, 10, 26);
  assert.equal(monthsUntil('christmas', nov), 1);
  assert.equal(monthsUntil('halloween', nov), 11);
  assert.equal(monthsUntil('thanksgiving', nov), 0);
  assert.equal(monthsUntil('other', nov), 99);
  assert.equal(seasonName('winter'), 'Winter');
});

test('out or put away: the last press wins, and older records go by their dates', () => {
  // a wrong "I packed it", then "I unpacked it", both today: out
  assert.equal(isOut({ packed: '2026-11-27', unpacked: '2026-11-27', out: true }), true);
  assert.equal(isOut({ packed: '2026-11-27', unpacked: '2026-11-27', out: false }), false);
  // saved before each press said which: by the dates
  assert.equal(isOut({ packed: '2026-01-06', unpacked: '2026-11-27' }), true);
  assert.equal(isOut({ packed: '2026-11-27', unpacked: '2026-01-06' }), false);
  assert.equal(isOut({ packed: '2026-11-27', unpacked: '2026-11-27' }), false);
  assert.equal(isOut({ unpacked: '2026-11-27' }), true);
  assert.equal(isOut({}), false);
});
test('the season notice lists only the totes still put away, in words that fit how many', () => {
  const nov = new Date(2026, 10, 27);
  assert.deepEqual([toteNames(['02']), toteNames(['01', '02']), toteNames(['04', '05', '06'])], ['Tote 02', 'Totes 01 and 02', 'Totes 04, 05 and 06']);
  const t = (id, season, more = {}) => ({ id, season, packed: '2026-01-06', ...more });
  assert.deepEqual(comingDown([t('02', 'christmas')], nov), { head: 'Christmas is next month. ', text: 'Tote 02 comes down.' });
  const totes = [t('01', 'halloween'), t('02', 'christmas', { unpacked: '2026-11-20', out: true }), t('04', 'christmas'), t('05', 'christmas'), t('06', 'christmas')];
  assert.equal(comingDown(totes, nov).text, 'Totes 04, 05 and 06 come down.', 'tote 02 is already out');
  assert.equal(comingDown(totes.map(x => ({ ...x, out: true })), nov), null, 'all out: no notice');
  assert.equal(comingDown([t('07', 'thanksgiving'), t('08', 'christmas')], nov).text, 'Tote 07 comes down.', 'the season that is here first');
  assert.equal(comingDown([t('07', 'thanksgiving', { out: true }), t('08', 'christmas')], nov).text, 'Tote 08 comes down.', 'then the next one');
  assert.equal(comingDown([t('01', 'halloween')], nov), null, 'nothing this month or next');
});
test('a tick stays on its thing when the list changes', () => {
  assert.deepEqual(tickKeys('04', ['Lights', 'Spare fuses', 'Lights']), ['04:Lights', '04:Spare fuses', '04:Lights#2']);
  assert.equal(tickKeys('04', ['Spare fuses', 'Timer'])[0], tickKeys('04', ['Lights', 'Spare fuses'])[1], 'line 1 taken out');
});
