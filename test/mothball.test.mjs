import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthsUntil, seasonName } from '../js/sample.js';
import { isOut, comingDown, toteNames, tickKeys, checkImport, mergeImport } from '../js/totes.js';

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

test('an import only fills in: contents, notes and a card typed at the tote stay, and a deleted tote stays deleted', () => {
  const here = {
    'totes/01': { id: '01', name: 'Porch lights', season: 'christmas', items: ['Light strings (4)', 'Timer plug'], builds: ['sleigh'], place: 'Garage, top shelf',
      packed: '2026-01-06', note: 'Buy a new bag of clips.' },
    'builds/sleigh': { id: 'sleigh', name: 'Light-up sleigh', season: 'christmas', firmware: 'v1.3', power: '12 V 2 A', wifi: '', bringup: 'Plug in the base' },
  };
  const file = { builds: [{ id: 'sleigh', name: 'Light-up sleigh', season: 'christmas', firmware: '', power: '', wifi: 'Sleigh-AP: hold the button 5 s', bringup: 'Plug in the base' },
      { id: 'cauldron', name: 'Bubbling cauldron', season: 'halloween' }],
    totes: [{ id: '01', name: 'Porch lights', season: 'christmas', items: [], builds: ['sleigh', 'Cauldron'] }, { id: '06', name: 'Tree skirt' },
      { id: 'Tote 6', name: 'A name, not a number' }, { id: '05', name: 'Fans', items: 'Fan\n- Cooler\n\n' }, { id: '07', items: ['Wreath'] },
      { id: '08', name: 'Bad lines', items: [1, 2] }, { id: '09', name: 4 }, 'not a record'] };
  const { puts, res } = mergeImport(file, (c, id) => here[c + '/' + id], (c, id) => c === 'totes' && id === '06');
  const put = Object.fromEntries(puts.map(([c, d]) => [c + '/' + d.id, d]));
  assert.deepEqual(Object.keys(put).sort(), ['builds/cauldron', 'builds/sleigh', 'totes/01', 'totes/05']);
  assert.deepEqual(put['builds/sleigh'], { ...here['builds/sleigh'], wifi: 'Sleigh-AP: hold the button 5 s' }, 'the blank firmware and power wiped what was typed');
  assert.deepEqual(put['totes/01'], { ...here['totes/01'], builds: ['sleigh', 'cauldron'] }, 'the contents, place, packed date or note went');
  assert.deepEqual(put['totes/05'].items, ['Fan', 'Cooler'], 'contents as a block of text');
  assert.deepEqual(res, { added: 2, filled: 2, kept: 2, gone: 1, skipped: ['id "Tote 6"', '"07" (no name)', '"08" (its contents aren\'t a list)', '"09" (its name isn\'t text)',
    'a line that isn\'t a record'] });
  // the same file again over what it just did: nothing new
  const after = { ...here, ...put };
  assert.deepEqual(mergeImport(file, (c, id) => after[c + '/' + id], (c, id) => c === 'totes' && id === '06').puts, []);
  assert.equal(checkImport('totes', { id: '0123456789abc', name: 'x' }).why, 'id "0123456789abc"', 'a tote number longer than New tote allows');
  assert.equal(checkImport('totes', { id: ' 2026-XMAS ', name: 'x' }).rec.id, '2026-xmas');
  assert.throws(() => mergeImport([{ id: '01' }], () => null, () => false), /not a Mothball import/);
  assert.throws(() => mergeImport({ totes: { id: '01' } }, () => null, () => false), /not a Mothball import/);
});
