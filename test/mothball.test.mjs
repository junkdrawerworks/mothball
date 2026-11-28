import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthsUntil, seasonName } from '../js/sample.js';
import { isOut, comingDown, toteNames, tickKeys, findIn, lineMoved, cardMoved, checkImport, mergeImport } from '../js/totes.js';

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
test('a line or a card moved to another tote: both totes, together, and nothing listed twice', () => {
  const a = { id: '01', name: 'Porch lights', items: ['Light strings (4)', 'Timer plug', 'Clips', 'Timer plug'], builds: ['sleigh', 'train'] };
  const b = { id: '02', name: 'Christmas: windows', items: ['Window candles'], builds: ['train'] };
  assert.deepEqual(lineMoved(a, b, 1, 'Timer plug'), [{ ...a, items: ['Light strings (4)', 'Clips', 'Timer plug'] }, { ...b, items: ['Window candles', 'Timer plug'] }]);
  assert.deepEqual(lineMoved(a, b, 3, 'Timer plug')[0].items, ['Light strings (4)', 'Timer plug', 'Clips'], 'the second of two the same');
  // the list changed on another device meanwhile: the line by its words, or nothing
  assert.deepEqual(lineMoved({ ...a, items: ['Timer plug', 'Clips'] }, b, 2, 'Clips')[0].items, ['Timer plug']);
  assert.equal(lineMoved({ ...a, items: ['Clips'] }, b, 1, 'Timer plug'), null);
  assert.equal(lineMoved(a, a, 1, 'Timer plug'), null, 'to the same tote');
  assert.deepEqual(lineMoved({ id: '01', name: 'x', items: ['Fan'] }, { id: '03', name: 'y' }, 0, 'Fan')[1].items, ['Fan'], 'a tote with no list yet');
  assert.deepEqual(cardMoved(a, b, 'sleigh'), [{ ...a, builds: ['train'] }, { ...b, builds: ['train', 'sleigh'] }]);
  assert.deepEqual(cardMoved(a, b, 'train'), [{ ...a, builds: ['sleigh'] }, b], 'a card the other tote has already');
  assert.equal(cardMoved(b, a, 'sleigh'), null, 'a card that isn\'t in it');
  assert.deepEqual(cardMoved(a, { id: '03', name: 'y' }, 'sleigh')[1].builds, ['sleigh'], 'a tote with no cards yet');
  assert.deepEqual([a.items.length, a.builds.length, b.items.length], [4, 2, 1], 'the totes given were changed');
});
test('Do I have…: a tote by its name, its contents lines and its build cards, each under its tote, then cards in no tote', () => {
  const totes = [
    { id: '01', name: 'Porch lights', items: ['Light strings (4)', 'Spare fuses', 'Timer plug'], builds: ['sleigh', 'gone-card'] },
    { id: '02', name: 'Christmas: windows', items: ['Window candles', 'Spare Fuses (big)'], builds: ['sleigh'] },
    { id: '03', name: 'Fuse box spares', season: 'other' },
  ];
  const cards = [{ id: 'sleigh', name: 'Light-up sleigh' }, { id: 'relay', name: 'Spare relay board' }];
  const show = q => findIn(q, totes, cards).map(x => `${x.tote ? x.tote.id : '--'} ${x.what}: ${x.text}`);
  assert.deepEqual(show('spare fuses'), ['01 line: Spare fuses', '02 line: Spare Fuses (big)'], 'any case');
  assert.deepEqual(show('fuse'), ['01 line: Spare fuses', '02 line: Spare Fuses (big)', '03 tote: Fuse box spares'], 'by tote number, the tote\'s name too');
  assert.deepEqual(show('sleigh'), ['01 card: Light-up sleigh', '02 card: Light-up sleigh'], 'a card in two totes, under each');
  assert.deepEqual(show('spare'), ['01 line: Spare fuses', '02 line: Spare Fuses (big)', '03 tote: Fuse box spares', '-- card: Spare relay board'], 'a card in no tote, last');
  assert.deepEqual(show('christmas windows'), ['02 tote: Christmas: windows'], 'a colon in a name');
  assert.deepEqual(show('lights fuses'), [], 'every word in one line or one name, not across a tote\'s name and a line');
  assert.deepEqual(show('saffron'), []);
  assert.deepEqual(findIn('timer', [{ id: '09', name: 'No lists' }], []), [], 'a tote with no contents or cards');
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

test('the QR library is not on the page: only the screen that draws codes loads it, and it stays in the offline copy', async () => {
  const { readFile } = await import('node:fs/promises');
  const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /qrcode\.js/, 'index.html loads js/kit/qrcode.js on every page, a tenant\'s first tap too');
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw.match(/SHELL = \[([^\]]*)\]/)[1], /'js\/kit\/qrcode\.js'/, 'printing offline needs qrcode.js in the offline copy');
});

test('a saved copy imported: records deleted here since are offered back whole, not left out', () => {
  const copy = { copy: { app: 'mothball', saved: '2026-11-20T15:00:00Z' }, builds: [{ id: 'sleigh', name: 'Light-up sleigh', bringup: 'Plug in the base' }],
    totes: [{ id: '07', name: 'Garlands', items: ['Garland', 'Magnets'], builds: ['sleigh'] }, { id: '09', name: 'Fans', items: ['Fan'] }] };
  const here = { 'totes/07': { id: '07', name: 'Garlands', items: [], builds: ['sleigh'] } }, gone = (c, id) => (c === 'totes' && id === '09') || (c === 'builds' && id === 'sleigh');
  const r = mergeImport(copy, (c, id) => here[c + '/' + id] || null, gone, { back: true });
  assert.deepEqual(r.back, [['builds', copy.builds[0]], ['totes', copy.totes[1]]]);
  assert.deepEqual(r.puts, [['totes', { id: '07', name: 'Garlands', items: ['Garland', 'Magnets'], builds: ['sleigh'] }]]);
  assert.equal(r.res.gone, 0);
  // the same file without back (an import file, not a copy): deleted stays deleted, as before
  const plain = mergeImport(copy, (c, id) => here[c + '/' + id] || null, gone);
  assert.deepEqual([plain.back, plain.res.gone], [[], 2]);
});
