// Mothball's own checks, run by test/e2e.mjs on a phone-sized page.
const fakeNfc = () => { window.__nfc = { writes: [] }; window.NDEFReader = class { async write(m) { window.__nfc.writes.push(m.records[0].data); } async scan() {} }; };
export async function appChecks({ page, ctx, base, assert, problems }) {
  assert.match(await page.locator('#app').innerText(), /connect first/i);
  assert.equal(await page.locator('#sync').isVisible(), false, 'a lone status dot under the name on the Connect first screen');
  await page.addInitScript(fakeNfc);
  await page.goto(base + '?demo');
  await page.waitForSelector('.row .num');
  assert.equal(await page.locator('.row .num').count(), 2);
  await page.click('text=Porch train >> nth=0');
  await page.waitForSelector('.tape >> text=Porch train');
  assert.equal(await page.locator('.checks li').count(), 4);
  // put away since January: the next press, I unpacked it, is the filled button, right under the date, above the list
  const packRow = () => page.locator('.btns.pack button').evaluateAll(bs => bs.map(b => [b.textContent, b.className]));
  assert.deepEqual(await packRow(), [['I unpacked it', 'btn'], ['I packed it', 'btn ghost']]);
  assert.ok(await page.locator('.btns.pack').evaluate(el => el.getBoundingClientRect().bottom <= document.querySelector('.checks').getBoundingClientRect().top),
    'Pack and Unpack sit under the list');
  assert.equal(await page.locator('.where + p').textContent(), 'Packed Jan 4, 2026.');
  assert.equal(await page.locator('.where + p + .btns.pack').count(), 1, 'the row is not right under the date');
  await page.click('.checks li >> nth=0');
  await page.waitForSelector('text=1 of 4 found');
  assert.equal(await page.locator('details.build[open] ol.steps li').count(), 3, 'one build, open, with its three steps');
  await page.click('text=Write sticker');
  await page.waitForFunction(() => window.__nfc.writes[0] === 'https://tag.junkdrawer.works/t/02');
  await page.waitForFunction(() => /^Written [A-Z][a-z]{2} \d{1,2}, \d{4}\.$/.test(document.querySelector('.nfc .state')?.textContent || ''));
  assert.equal(await page.locator('.nfc > .msg:last-child').textContent(), 'Written. Tap it with the phone to check it opens this page.');
  await page.click('text=I packed it');
  await page.fill('#f-note', 'Buy a spare USB-C supply.');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.note >> text=spare USB-C');
  // packed today reads that way at home, not "packed today ago"
  await page.click('text=‹ All totes');
  await page.waitForSelector('.row .num');
  assert.equal(await page.locator('.row', { hasText: '02' }).locator('.s').textContent(), 'Basement, rack by the door, middle · packed today');
  assert.equal(await page.locator('.row', { hasText: '02' }).locator('.meta').count(), 0, 'a column beside the name of a tote that isn\'t out');
  // that was a mistake: I unpacked it the same day wins
  await page.click('text=Porch train >> nth=0');
  await page.click('text=I unpacked it');
  await page.waitForSelector('.toast.show >> text=Tote 02 is out.');
  assert.match(await page.locator('.where + p').textContent(), /^Out since [A-Z][a-z]{2} \d{1,2}, \d{4}\.$/, 'a same-day unpack still reads packed');
  assert.deepEqual(await packRow(), [['I packed it', 'btn'], ['I unpacked it', 'btn ghost']]);
  const t02 = await page.evaluate(() => window.__mothball.ledger.doc('totes', '02'));
  assert.deepEqual([t02.packed === t02.unpacked, t02.out], [true, true]);
  await page.click('text=‹ All totes');
  await page.waitForSelector('.row .num');
  assert.equal(await page.locator('.row', { hasText: '02' }).locator('.meta .chip').textContent(), 'out');
  assert.match(await page.locator('.row', { hasText: '02' }).locator('.s').textContent(), /^Basement, rack by the door, middle · out since [A-Z][a-z]{2}\u00a0\d{1,2}$/);
  // tote 01: the note to next year is in Edit, and Done clears it
  await page.click('text=Pumpkins and the porch web');
  await page.click('#app button:text-is("Edit")');
  assert.match(await page.locator('#f-note').inputValue(), /^The middle pumpkin's candle stopped/);
  await page.fill('#f-note', 'Buy a spare candle.');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.note >> text=Buy a spare candle.');
  await page.click('.note >> text=Done');
  // the button that does the thing for good is the red one, not the app's colour in Save's place
  assert.equal(await page.locator('dialog[open] button[type=submit]').getAttribute('class'), 'btn danger');
  await page.click('dialog >> text=Clear it');
  await page.waitForSelector('.toast.show >> text=Note cleared.');
  assert.equal(await page.locator('.note').count(), 0);
  assert.equal(await page.evaluate(() => window.__mothball.ledger.doc('totes', '01').note), '');
  await page.click('text=‹ All totes');
  // ticks stay on their things when a line is taken out in Edit
  await page.click('text=Pumpkins and the porch web');
  await page.locator('.checks input').nth(0).check();
  await page.locator('.checks input').nth(1).check();
  await page.waitForSelector('text=2 of 4 found');
  await page.click('#app button:text-is("Edit")');
  await page.locator('#f-items').fill((await page.locator('#f-items').inputValue()).split('\n').slice(1).join('\n'));
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('text=of 3 found');
  assert.deepEqual(await page.locator('.checks label').evaluateAll(ls => ls.filter(l => l.querySelector('input').checked).map(l => l.innerText.trim())),
    ['AA batteries (bag of 12) and the remote'], 'the ticks moved to other things');
  assert.equal(await page.locator('text=of 3 found').textContent(), '1 of 3 found');
  // the season notice, on Nov 27: one tote reads as one, and it goes once the tote is down
  const nov = await ctx.newPage();
  await nov.clock.setFixedTime(new Date(2026, 10, 27, 12));
  await nov.goto(base + '?demo');
  assert.equal(await nov.locator('.notice.warn').innerText(), 'Christmas is next month. Tote 02 comes down.');
  await nov.goto(base + '?demo#02');
  await nov.click('text=I unpacked it');
  await nov.click('text=‹ All totes');
  await nov.waitForSelector('.row .num');
  assert.equal(await nov.locator('.notice.warn').count(), 0, 'the notice lists a tote already down');
  await nov.close();
  // a new tote, set up from a tag that isn't in the list yet
  await page.goto(base + '?demo#05');
  await page.click('text=Set up tote 05');
  await page.fill('#f-name', 'Wreaths');
  await page.fill('#f-items', 'Front door wreath\nWreath hanger');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.tape >> text=Wreaths');
  // long things fit the phone: a pasted link in the note to next year, a long tote number in its badge
  await page.evaluate(() => { window.__mothball.ledger.put('totes', { id: '2026-xmas', name: 'Spare lights', season: 'christmas', items: [], builds: [],
    note: 'https://example.com/averyverylonglinkwithnospacesorhyphensthatkeepsgoingandgoingpasttheedgeofthephone' }); });
  await page.goto(base + '?demo#2026-xmas');
  await page.waitForSelector('.note');
  assert.equal(await page.locator('.note').evaluate(el => el.scrollWidth <= el.clientWidth), true, 'a long link runs out of the note');
  await page.evaluate(() => { location.hash = ''; });   // the same page: the sample keeps the new tote
  await page.waitForSelector('.row .num');
  const badge = await page.locator('.row', { hasText: 'Spare lights' }).locator('.num').evaluate(el => [el.scrollWidth <= el.clientWidth, el.getBoundingClientRect().width]);
  assert.equal(badge[0], true, 'a long tote number runs out of its badge');
  assert.ok(badge[1] >= 46, 'the badge got narrower than 46 px');
  await page.goto(base + '?demo#/label/01');
  await page.waitForSelector('.label-qr svg');
  assert.match(await page.locator('.label-num').innerText(), /01/);
  await printChecks(page, assert, '.label');
  await page.goto(base + '?demo#/builds');
  assert.equal(await page.locator('.list .row').count(), 3);
  // an import, the totes and a card then filled in at the tote, and the file imported again: what was typed stays, the
  // file's new lines go in, a tote deleted here stays deleted, and records in the wrong shape are named, not saved
  await page.goto(base + '?demo');
  const importing = async (data, said) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Import')]);
    await chooser.setFiles({ name: 'mothball.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await page.waitForSelector(`.toast.show >> text=${said}`);
  };
  const file = { builds: [{ id: 'sleigh', name: 'Light-up sleigh', season: 'christmas', power: '', firmware: '', wifi: '', bringup: 'Plug in the base\nPress the button' }],
    totes: [{ id: '07', name: 'Garlands and the sleigh', season: 'christmas', builds: ['sleigh'], items: [] }, { id: '08', name: 'Tree skirt', season: 'christmas', items: [] },
      { id: '09', name: 'Fans', season: 'other', items: 'Fan\nCooler' }, { id: 'Tree topper', name: 'A name, not a number' }] };
  await importing(file, 'Added 4 records; skipped 1 (id "Tree topper").');
  await page.waitForSelector('.row >> text=Garlands and the sleigh');
  await page.click('.row >> text=Fans');
  await page.waitForSelector('.tape >> text=Fans');
  assert.deepEqual(await page.locator('.checks .t').allTextContents(), ['Fan', 'Cooler'], 'contents given as text');
  await page.evaluate(() => { location.hash = '#07'; });
  await page.waitForSelector('.tape >> text=Garlands and the sleigh');
  await page.click('#app button:text-is("Edit")');
  await page.fill('#f-items', 'Garland (3)\n2.5 m extension lead\n- Magnets');
  await page.fill('#f-place', 'Basement shelf');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.where >> text=Basement shelf');
  assert.deepEqual(await page.locator('.checks .t').allTextContents(), ['Garland (3)', '2.5 m extension lead', 'Magnets'], 'a number at the start of a line was cut');
  await page.click('text=Edit card');
  await page.click('#app button:text-is("Edit")');
  await page.fill('#f-firmware', 'v1.3');
  await page.fill('#f-power', '12 V 2 A');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('summary .chip >> text=v1.3');
  await page.evaluate(() => { location.hash = '#08'; });
  await page.waitForSelector('.tape >> text=Tree skirt');
  await page.click('#app button:text-is("Edit")');
  await page.click('dialog >> text=Delete');
  assert.deepEqual(await page.locator('dialog[open] button[type=submit]').evaluate(b => [b.textContent, b.className]), ['Delete', 'btn danger'], 'Delete tote looks like Save');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.row >> text=Garlands and the sleigh');
  // an updated file: a Wi-Fi line for the card and a line for tote 07, blanks everywhere else
  file.builds[0].wifi = 'Sleigh-AP: hold the button 5 s';
  file.totes[0].items = ['Spare magnets'];
  await importing(file, 'Filled in 2, kept your edits; left out 1 you deleted; skipped 1 (id "Tree topper").');
  await importing(file, 'Nothing new in the file; your edits stay; left out 1 you deleted; skipped 1 (id "Tree topper").');
  const [t07, sleigh, t08] = await page.evaluate(() => [window.__mothball.ledger.doc('totes', '07'), window.__mothball.ledger.doc('builds', 'sleigh'), window.__mothball.ledger.doc('totes', '08')]);
  assert.deepEqual([t07.items, t07.place], [['Garland (3)', '2.5 m extension lead', 'Magnets', 'Spare magnets'], 'Basement shelf'], 'the contents typed at the tote went');
  assert.deepEqual([sleigh.firmware, sleigh.power, sleigh.wifi], ['v1.3', '12 V 2 A', 'Sleigh-AP: hold the button 5 s'], 'the card lost its firmware or power');
  assert.equal(t08, null, 'a tote deleted here came back');
  assert.equal(await page.locator('.row >> text=Tree skirt').count(), 0);

  await homeLineChecks({ page, base, assert });
  await pickChecks({ page, base, assert });
  await reusedCardChecks({ page, base, assert });
  await oneDigitChecks({ page, base, assert });
  await cardChecks({ page, base, assert });
  await sharedChecks({ page, base, assert });
  await searchChecks({ page, base, assert });
  await refusedChecks({ page, base, assert });
  await heldChecks({ ctx, base, assert });
  await ledgerChecks({ page, ctx, base, assert, problems });
  await secondDevice({ ctx, base, assert });
  await stickerPage({ ctx, base, assert });
  await renumberChecks({ page, base, assert });
  // Back from a tote 40 rows down lands where the list was
  const { backKeepsPlace } = await import('./kit-checks.mjs');
  // every link, button and card header on the sample's screens is a 44 px target
  await (await import('./kit-checks.mjs')).targetsAudit({ browser: ctx.browser(), base, assert, hashes: ['', '#01', '#02', '#/builds', '#/build/pumpkins', '#/label/01', '#09'] });
  await backKeepsPlace({ browser: ctx.browser(), base, assert, app: 'mothball', colls: { builds: [],
    totes: Array.from({ length: 50 }, (_, i) => ({ id: String(i + 1).padStart(2, '0'), name: `Tote of things ${i + 1}`, season: 'christmas', place: 'Garage', items: [], builds: [] })) } });
}

// A sticker t/1 for a tote that's 01 (the ledger script mends a tote typed as 1 under its first version to 01) opens
// tote 01, not "Set up tote 1"; a number with no tote of either kind is offered as before.
async function oneDigitChecks({ page, base, assert }) {
  await page.goto('about:blank');
  await page.goto(base + '?demo#1');
  await page.waitForSelector('.tape >> text=Pumpkins and the porch web');
  assert.equal(await page.evaluate(() => location.hash), '#01');
  assert.equal(await page.locator('text=Set up tote 1').count(), 0);
  await page.evaluate(() => { location.hash = '#3'; });
  await page.waitForSelector('text=No tote 3 yet.');
  assert.equal(await page.locator('button', { hasText: 'Set up tote 3' }).count(), 1);
}

// Edit tote: the build cards are a checklist of every card (name and season), the tote's ticked; two ticked and Save
// puts both under Builds inside.
async function pickChecks({ page, base, assert }) {
  await page.goto('about:blank');
  await page.goto(base + '?demo#02');
  await page.waitForSelector('.tape >> text=Porch train');
  await page.click('#app button:text-is("Edit")');
  const picks = () => page.locator('dialog[open] .pick').evaluateAll(ls => ls.map(l => [l.querySelector('span').textContent, l.querySelector('small').textContent, l.querySelector('input').checked]));
  assert.deepEqual(await picks(), [['Light-up pumpkins', 'Halloween', false], ['Porch spider web', 'Halloween', false], ['Porch train', 'Christmas', true]]);
  assert.ok((await page.locator('dialog[open] .pick').first().boundingBox()).height >= 44, 'a card to tick is smaller than a thumb');
  assert.equal(await page.locator('dialog[open] input[name=builds]').count(), 0, 'the build card ids are still typed');
  await page.click('dialog[open] .pick >> text=Porch train');
  await page.click('dialog[open] .pick >> text=Light-up pumpkins');
  await page.click('dialog[open] .pick >> text=Porch spider web');
  await page.click('dialog[open] button[type=submit]');
  await page.waitForSelector('h2 >> text=Builds inside');
  assert.deepEqual(await page.locator('details.build summary b').allTextContents(), ['Light-up pumpkins', 'Porch spider web']);
  assert.deepEqual(await page.evaluate(() => window.__mothball.ledger.doc('totes', '02').builds), ['pumpkins', 'porch-web']);
}

// A card ticked in a tote, then deleted (the tote keeps its id, by design, so FALSE in the sheet brings it back to its
// totes), then a new card with the same name: the new one gets an id of its own, so it isn't in that tote unticked.
async function reusedCardChecks({ page, base, assert }) {
  await page.goto('about:blank');
  await page.goto(base + '?demo#/builds');
  await page.click('button:text-is("New build card")');
  await page.fill('dialog[open] [name=name]', 'Porch lights');
  await page.click('dialog[open] button[type=submit]');
  await page.waitForFunction(() => location.hash === '#/build/porch-lights');
  await page.evaluate(() => { location.hash = '#02'; });
  await page.waitForSelector('.tape >> text=Porch train');
  await page.click('#app button:text-is("Edit")');
  await page.click('dialog[open] .pick >> text=Porch lights');
  await page.click('dialog[open] button[type=submit]');
  await page.waitForFunction(() => document.querySelectorAll('details.build').length === 2);
  assert.deepEqual(await page.locator('details.build summary b').allTextContents(), ['Porch train', 'Porch lights']);
  await page.evaluate(() => { location.hash = '#/build/porch-lights'; });
  await page.click('#app button:text-is("Edit")');
  await page.click('dialog[open] button:text-is("Delete")');
  await page.click('dialog[open] button[type=submit]:text-is("Delete")');
  await page.waitForFunction(() => location.hash === '#/builds' && !document.querySelector('dialog[open]'));
  await page.click('button:text-is("New build card")');
  await page.fill('dialog[open] [name=name]', 'Porch lights');
  await page.click('dialog[open] button[type=submit]');
  await page.waitForFunction(() => /^#\/build\//.test(location.hash) && !document.querySelector('dialog[open]'));
  assert.equal(await page.evaluate(() => location.hash), '#/build/porch-lights-2', 'the new card took the deleted one\'s id');
  await page.evaluate(() => { location.hash = '#02'; });
  await page.waitForSelector('.tape >> text=Porch train');
  assert.deepEqual(await page.locator('details.build summary b').allTextContents(), ['Porch train'], 'a new card appeared in a tote nobody ticked it in');
}

// The home page at 390 px: a tote's name has the row's width, its age in the line under it, so names like these stay
// on one line; and one put away last year says how long.
async function homeLineChecks({ page, base, assert }) {
  await page.goto('about:blank');
  await page.goto(base + '?demo');
  await page.waitForSelector('.row .num');
  await page.evaluate(() => {
    const { ledger, render } = window.__mothball, ago = d => { const t = new Date(); t.setDate(t.getDate() - d); return t.toISOString().slice(0, 10); };
    for (const [id, name, place, d] of [['15', 'Tote of beach gear 15', 'Attic, by the hatch', 35], ['16', 'Inflatable snowman', 'Garage, top shelf, left', 300]])
      ledger.put('totes', { id, name, season: 'summer', place, packed: ago(d), items: [], builds: [] });
    render();
  });
  const line = await page.locator('.row', { hasText: 'Tote of beach gear 15' }).evaluate(r => {
    const t = r.querySelector('.t'); return { h: t.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(t).lineHeight), s: r.querySelector('.s').textContent, meta: !!r.querySelector('.meta') };
  });
  assert.ok(line.h < line.lh * 1.5, `"Tote of beach gear 15" runs to ${Math.round(line.h / line.lh)} lines at 390 px`);
  assert.deepEqual([line.s, line.meta], ['Attic, by the hatch · packed 5\u00a0wk\u00a0ago', false], 'the age wraps apart');
  assert.match(await page.locator('.row', { hasText: 'Inflatable snowman' }).locator('.s').textContent(), /^Garage, top shelf, left · packed (9|10)\u00a0mo\u00a0ago$/);
}

// A tick draws the tote's page again: a build card opened to read its steps stays open, and one closed stays closed.
async function cardChecks({ page, base, assert }) {
  const cards = () => page.locator('details.build').evaluateAll(ds => ds.map(d => [d.querySelector('summary b').textContent, d.open]));
  await page.goto('about:blank');
  await page.goto(base + '?demo#01');
  await page.waitForSelector('details.build');
  assert.deepEqual(await cards(), [['Light-up pumpkins', false], ['Porch spider web', false]], 'two builds: both cards start closed');
  await page.click('details.build summary >> text=Light-up pumpkins');
  await page.locator('.checks input').nth(0).check();
  await page.waitForSelector('text=1 of 4 found');
  assert.deepEqual(await cards(), [['Light-up pumpkins', true], ['Porch spider web', false]], 'a tick closed the build card being read');
  await page.click('details.build summary >> text=Light-up pumpkins');
  await page.locator('.checks input').nth(1).check();
  await page.waitForSelector('text=2 of 4 found');
  assert.deepEqual(await cards(), [['Light-up pumpkins', false], ['Porch spider web', false]], 'a tick opened a card that was closed');
  // one build: open to start with, and closed by hand it stays closed
  await page.evaluate(() => { location.hash = '#02'; });
  await page.waitForSelector('.tape >> text=Porch train');
  assert.deepEqual(await cards(), [['Porch train', true]]);
  await page.click('details.build summary >> text=Porch train');
  await page.locator('.checks input').nth(0).check();
  await page.waitForSelector('text=1 of 4 found');
  assert.deepEqual(await cards(), [['Porch train', false]], 'a tick opened the one card again');
}

// A build card in two totes: Build cards names both, and each tote's page says where else it is. A tote with only build
// cards (as the starter file sets them up) prints them on its label, builds first, six lines in all.
async function sharedChecks({ page, base, assert }) {
  await page.goto('about:blank');
  await page.goto(base + '?demo');
  await page.waitForSelector('.row .num');
  await page.evaluate(() => {
    const { ledger } = window.__mothball;
    ledger.put('totes', { ...ledger.doc('totes', '02'), builds: ['porch-train', 'pumpkins'] });
    ledger.put('totes', { id: '07', name: 'Porch scarecrows', season: 'halloween', place: 'Attic', items: [], builds: ['pumpkins', 'porch-web'] });
    ledger.put('totes', { id: '08', name: 'Garlands', season: 'christmas', items: ['Garland 1', 'Garland 2', 'Garland 3', 'Garland 4', 'Garland 5', 'Garland 6'], builds: ['porch-train'] });
  });
  await page.evaluate(() => { location.hash = '#/builds'; });
  await page.waitForSelector('.list .row');
  assert.deepEqual(await page.locator('.list .row .s').allTextContents(), ['Halloween · totes 01, 02, 07', 'Halloween · totes 01, 07', 'Christmas · totes 02, 08'],
    'Build cards names only the first tote a card is in');
  await page.evaluate(() => { location.hash = '#02'; });
  await page.waitForSelector('.tape >> text=Porch train');
  assert.deepEqual(await page.locator('details.build').evaluateAll(ds => ds.map(d => [d.querySelector('summary b').textContent, d.querySelector('.also')?.textContent || ''])),
    [['Porch train', 'Also in tote 08.'], ['Light-up pumpkins', 'Also in totes 01, 07.']]);
  await page.evaluate(() => { location.hash = '#/label/07'; });
  await page.waitForSelector('.label-qr svg');
  assert.deepEqual(await page.locator('.label-body li').allTextContents(), ['Light-up pumpkins (build)', 'Porch spider web (build)'], 'a tote with only builds prints only its name');
  await page.evaluate(() => { location.hash = '#/label/08'; });
  await page.waitForSelector('.label-body >> text=Garlands');
  assert.deepEqual(await page.locator('.label-body li').allTextContents(), ['Porch train (build)', 'Garland 1', 'Garland 2', 'Garland 3', 'Garland 4', 'and 2 more']);
}

// Do I have…: what's typed is looked for in every tote's name, contents lines and build cards, each found under its
// tote's number; a card in no tote opens the card; a phone's curly apostrophe finds a straight one; nothing found says
// so; Back from a tote comes back to the same answers, and an emptied box shows the totes by season again.
async function searchChecks({ page, base, assert }) {
  await page.goto('about:blank');
  await page.goto(base + '?demo');
  await page.waitForSelector('.row .num');
  await page.evaluate(() => { const { ledger, render } = window.__mothball;
    ledger.put('totes', { id: '03', name: 'Wreaths', season: 'christmas', place: 'Attic, left', items: ['Grandma’s wreath', 'Spare fuses (pack of 10)'], builds: [], unpacked: '2026-11-20', out: true });
    ledger.put('builds', { id: 'relay-board', name: 'Spare relay board', season: 'other' });
    render(); });
  const rows = () => page.locator('.found .row').evaluateAll(rs => rs.map(r => [r.querySelector('.num')?.textContent || '', r.querySelector('.t').textContent, r.querySelector('.s').textContent, r.querySelector('.chip')?.textContent || '', r.getAttribute('href')]));
  const search = page.locator('input.search');
  assert.equal(await search.getAttribute('placeholder'), 'Do I have…');
  await search.fill('porch');
  // (a tote found by its name has its home page line: where it lives, and how long since it was packed)
  const packed = (await rows()).map(r => r[2].replace(/ · packed .*$/, ' · packed …'));
  assert.deepEqual((await rows()).map((r, i) => [r[0], r[1], packed[i], r[3], r[4]]), [
    ['01', 'Pumpkins and the porch web', 'Basement, rack by the door, top · packed …', '', '#01'],
    ['01', 'Porch spider web and four stakes', 'Pumpkins and the porch web · Basement, rack by the door, top', '', '#01'],
    ['01', 'Porch spider web (build)', 'Pumpkins and the porch web · Basement, rack by the door, top', '', '#01'],
    ['02', 'Porch train', 'Basement, rack by the door, middle · packed …', '', '#02'],
    ['02', 'Porch train (build)', 'Porch train · Basement, rack by the door, middle', '', '#02']]);
  assert.equal(await page.locator('.seasons').isHidden(), true, 'the totes by season stay up under the answers');
  await search.fill('Fuses ');
  assert.deepEqual(await rows(), [['03', 'Spare fuses (pack of 10)', 'Wreaths · Attic, left', 'out', '#03']], 'a tote that\'s out says so');
  await search.fill("grandma's");
  assert.deepEqual((await rows()).map(r => r[1]), ['Grandma’s wreath'], "a straight apostrophe finds a phone's curly one");
  await search.fill('usb supply');
  assert.deepEqual((await rows()).map(r => r.slice(0, 3)), [['02', 'USB-C supply', 'Porch train · Basement, rack by the door, middle']]);
  await search.fill('relay');
  assert.deepEqual(await rows(), [['', 'Spare relay board (build)', 'Build card, in no tote', '', '#/build/relay-board']]);
  await search.fill('saffron');
  assert.equal(await page.locator('.found .empty').textContent(), 'No "saffron" in any tote.');
  assert.equal(await page.locator('.found .row').count(), 0);
  // a tote opened from the answers, and Back: the same answers
  await search.fill('snowflakes');
  await page.click('.found .row >> text=Window snowflakes (pack of 12)');
  await page.waitForSelector('.tape >> text=Porch train');
  await page.goBack();
  await page.waitForSelector('.found .row');
  assert.equal(await page.inputValue('input.search'), 'snowflakes');
  assert.deepEqual((await rows()).map(r => r[1]), ['Window snowflakes (pack of 12)']);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the answers run off the side at 390 px');
  await search.fill('');
  assert.equal(await page.locator('.seasons').isVisible(), true);
  assert.equal(await page.locator('.found').isHidden(), true);
  assert.equal(await page.locator('.seasons .row .num').count(), 3);
}

// A Save the app refuses (a number another tote has) keeps the sheet open with everything typed, says why above the
// buttons and puts the focus on the number; Number 03 then saves what was typed.
async function refusedChecks({ page, base, assert }) {
  await page.goto('about:blank');
  await page.goto(base + '?demo#01');
  await page.click('#app button:text-is("Edit")');
  const typed = 'Three foam pumpkins\nSpare LED candles x6\nExtension lead, 10 m\nZip ties\nTimer plug';
  await page.fill('#f-items', typed);
  await page.fill('#f-place', 'Garage, top shelf');
  await page.fill('#f-id', '02');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector("dialog[open] .sheet-msg >> text=There's already a tote 02.");
  assert.equal(await page.locator('dialog[open]').count(), 1);
  assert.deepEqual([await page.inputValue('#f-items'), await page.inputValue('#f-place')], [typed, 'Garage, top shelf'], 'the refused Save lost what was typed');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'f-id', 'the focus is not on the number');
  assert.equal(await page.evaluate(() => window.__mothball.ledger.doc('totes', '02').name), 'Porch train', 'tote 02 was saved over');
  await page.fill('#f-id', '03');
  await page.click('dialog >> button[type=submit]');
  await page.waitForFunction(() => location.hash === '#03' && !document.querySelector('dialog[open]'));
  assert.deepEqual(await page.evaluate(() => window.__mothball.ledger.doc('totes', '03').items), typed.split('\n'));
  assert.equal(await page.evaluate(() => window.__mothball.ledger.doc('totes', '01')), null, 'tote 01 stayed under its old number');
}

// New tote on a page open a while asks the ledger first; with Google taking 3 s, the button says so meanwhile, at its
// own width, then the sheet opens and the button is as it was.
async function heldChecks({ ctx, base, assert }) {
  const { DemoLedger } = await import(new URL('../js/kit/ledger.js', import.meta.url));
  const google = new DemoLedger({ 'mothball.totes': [{ id: '01', name: 'Porch lights', season: 'christmas', items: [] }] });
  const phone = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  let slow = false;
  try {
    await phone.route('https://script.google.com/**', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (slow && body.op === 'list') await new Promise(r => setTimeout(r, 3000));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(google.handle(body)) });
    });
    await phone.addInitScript(() => { try { localStorage.getItem('mothball.ledger') || localStorage.setItem('mothball.ledger',
      JSON.stringify({ url: 'https://script.google.com/macros/s/AKfyTEST/exec', key: 'k'.repeat(40) })); } catch {} });
    const p = await phone.newPage();
    await p.goto(base);
    await p.waitForSelector('.row >> text=Porch lights');
    await p.evaluate(() => { window.__mothball.ledger.listedAt = Date.now() - 60000; });   // the last list over 30 s ago
    slow = true;
    const btn = p.locator('#app .btns button').first();
    const before = await btn.evaluate(b => [b.textContent, Math.round(b.getBoundingClientRect().width)]);
    assert.equal(before[0], 'New tote');
    await btn.click();
    await p.waitForTimeout(500);
    const during = await btn.evaluate(b => [b.textContent, b.disabled, b.getAttribute('aria-busy'), Math.round(b.getBoundingClientRect().width)]);
    assert.deepEqual(during.slice(0, 3), ['Checking…', true, 'true'], 'New tote sat greyed with no words while it asked the ledger');
    assert.ok(during[3] >= before[1], `the button shrank from ${before[1]} to ${during[3]} px`);
    await p.waitForSelector('dialog[open]', { timeout: 6000 });
    assert.equal(await p.inputValue('#f-id'), '02');
    assert.deepEqual(await p.locator('#app .btns button').first().evaluate(b => [b.textContent, b.disabled, b.hasAttribute('aria-busy')]), ['New tote', false, false]);
  } finally { await phone.close(); }
}

// A tote given a new number: its sticker still holds the old one, so the panel doesn't say Written.
async function renumberChecks({ page, base, assert }) {
  await page.goto('about:blank');
  await page.goto(base + '?demo#02');
  await page.waitForSelector('.nfc');
  await page.evaluate(() => { const { ledger, render } = window.__mothball; ledger.put('totes', { ...ledger.doc('totes', '02'), tagged: '2026-11-20' }); render(); });
  await page.waitForSelector('.nfc .state >> text=Written Nov 20, 2026.');
  await page.click('#app button:text-is("Edit")');
  await page.fill('#f-id', '05');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.tape >> text=Porch train');
  await page.waitForFunction(() => location.hash === '#05');
  assert.equal(await page.locator('.nfc .state', { hasText: /^Written/ }).count(), 0, 'tote 05 says its sticker is written, but the sticker holds t/02');
  assert.equal(await page.evaluate(() => window.__mothball.ledger.doc('totes', '05').tagged), undefined);
  // and an edit that keeps the number keeps the written date
  await page.evaluate(() => { const { ledger, render } = window.__mothball; ledger.put('totes', { ...ledger.doc('totes', '05'), tagged: '2026-11-21' }); render(); });
  await page.click('#app button:text-is("Edit")');
  await page.fill('#f-place', 'Basement, rack by the door, bottom');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.where >> text=bottom');
  assert.equal(await page.evaluate(() => window.__mothball.ledger.doc('totes', '05').tagged), '2026-11-21');
}

// A phone that synced earlier, so Set up tote N shows at once from its copy, opens tote 03's sticker while the ledger
// takes a moment to answer; meanwhile another device has filled tote 03 in. Set up tote 03 then opens that tote's page,
// and when the tote comes in while the sheet is open, Save refuses: either way the sheet's tote 03 keeps everything.
async function stickerPage({ ctx, base, assert }) {
  const { DemoLedger } = await import(new URL('../js/kit/ledger.js', import.meta.url));
  const t03 = { id: '03', name: 'Wreaths', season: 'christmas', place: 'Attic, left', items: ['Front door wreath', 'Wreath hangers (2)'], builds: [] };
  const google = new DemoLedger({ 'mothball.totes': [t03] });
  let hold = 1000;
  const phone = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block' });
  const errors = [];
  phone.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  try {
    await phone.route('https://script.google.com/**', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.op === 'list') await new Promise(r => setTimeout(r, hold));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(google.handle(body)) });
    });
    // each new tab starts from a copy that has heard from the ledger but hasn't got tote 03
    await phone.addInitScript(() => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear();
      localStorage.setItem('mothball.ledger', JSON.stringify({ url: 'https://script.google.com/macros/s/AKfyTEST/exec', key: 'k'.repeat(40) }));
      for (const c of ['totes', 'builds']) localStorage.setItem('mothball.m.' + c, JSON.stringify({ docs: {}, since: 0, listed: true })); } } catch {} });
    const unchanged = what => { const { _updated, ...now } = google.store['mothball.totes']['03']; assert.deepEqual(now, t03, what); };
    // the press asks the ledger first, and the tote is in its answer
    let p = await phone.newPage();
    await p.goto(base + '#03');
    await p.waitForSelector('text=No tote 03 yet.');
    await p.click('text=Set up tote 03');
    await p.waitForSelector('dialog[open], .tape >> text=Wreaths');
    if (await p.locator('dialog[open]').count()) { await p.fill('#f-name', 'Typed on the phone'); await p.click('dialog >> button[type=submit]'); }
    await p.waitForTimeout(1500);
    unchanged('Set up tote 03 replaced the tote another device filled in');
    assert.equal(await p.locator('.tape').textContent(), 'Wreaths');
    await p.close();
    // the tote comes in while the sheet is open
    hold = 3000;
    p = await phone.newPage();
    await p.goto(base + '#03');
    await p.waitForSelector('text=No tote 03 yet.');
    await p.evaluate(() => { window.__mothball.ledger.listedAt = Date.now(); });   // asked a moment ago: no catch-up
    await p.click('text=Set up tote 03');
    await p.waitForSelector('dialog[open]');
    await p.fill('#f-name', 'Typed on the phone');
    await p.waitForFunction(() => !!window.__mothball.ledger.doc('totes', '03'), null, { timeout: 8000 });
    await p.click('dialog >> button[type=submit]');
    await p.waitForSelector("dialog[open] .sheet-msg >> text=There's already a tote 03.");
    assert.equal(await p.inputValue('dialog[open] #f-name'), 'Typed on the phone', 'the refused Save lost what was typed');
    await p.waitForTimeout(1000);
    unchanged('a tote that came in while the sheet was open was saved over');
    assert.deepEqual(errors, [], 'errors on the phone');
  } finally { await phone.close(); }
}

// The laptop, connected while Google takes 3 s to answer its first list (a cold start), with the phone's tote 01 filled
// in on the sheet: New tote and Import wait for the list, then New tote offers 02, and tote 01 keeps everything.
async function secondDevice({ ctx, base, assert }) {
  const { DemoLedger } = await import(new URL('../js/kit/ledger.js', import.meta.url));
  const t01 = { id: '01', name: 'Porch lights', season: 'christmas', place: 'Garage, top shelf', items: ['Light strings (4)', 'Timer plug', 'Clips (bag)'],
    builds: [], packed: '2026-11-27', out: false, note: 'Buy a new bag of clips.' };
  const google = new DemoLedger({ 'mothball.totes': [t01] });
  const laptop = await ctx.browser().newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  const errors = [];
  laptop.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  try {
    await laptop.route('https://script.google.com/**', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.op === 'list') await new Promise(r => setTimeout(r, 3000));
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(google.handle(body)) });
    });
    await laptop.addInitScript(() => { try { localStorage.getItem('mothball.ledger') || localStorage.setItem('mothball.ledger',
      JSON.stringify({ url: 'https://script.google.com/macros/s/AKfyTEST/exec', key: 'k'.repeat(40) })); } catch {} });
    const p = await laptop.newPage();
    await p.goto(base);
    await p.waitForSelector('.empty >> text=Loading…');
    const off = () => p.locator('#app .btns button').evaluateAll(bs => bs.map(b => [b.textContent, b.disabled]));
    assert.deepEqual(await off(), [['New tote', true], ['Import', true]], 'New tote or Import offered before the ledger answered');
    await p.goto(base + '#/builds');
    assert.equal(await p.locator('button', { hasText: 'New build card' }).isDisabled(), true, 'New build card offered before the ledger answered');
    await p.goto(base);
    await p.waitForSelector('.row >> text=Porch lights', { timeout: 10000 });
    assert.deepEqual(await off(), [['New tote', false], ['Import', false]]);
    assert.equal(await p.locator('.empty').count(), 0);
    await p.click('text=New tote');
    assert.equal(await p.inputValue('#f-id'), '02', 'New tote offered a number the sheet already has');
    assert.equal(await p.locator('dialog[open] .picks').textContent(), 'Build cards inside: Make cards under Build cards.');
    await p.fill('#f-name', 'Wreaths');
    await p.fill('#f-items', 'Front door wreath');
    await p.click('dialog >> button[type=submit]');
    await p.waitForSelector('.tape >> text=Wreaths');
    await p.waitForFunction(() => !/Saving/.test(document.querySelector('#sync').textContent));
    const { _updated, ...was } = google.store['mothball.totes']['01'];
    assert.deepEqual(was, t01, "the phone's tote 01 was changed");
    assert.equal(google.store['mothball.totes']['02'].name, 'Wreaths');
    // a sheet opened, then the copy forgotten before Save (say a new ledger in another tab): it isn't saved from nothing
    await p.goto(base);
    await p.click('text=New tote');
    await p.waitForSelector('dialog[open]');
    await p.evaluate(() => { const m = window.__mothball.ledger.m('totes'); m.since = 0; m.listed = false; });
    await p.fill('#f-name', 'Garlands');
    await p.click('dialog >> button[type=submit]');
    await p.waitForSelector('dialog[open] .sheet-msg >> text=Still loading from the ledger. Try again in a moment.');
    assert.equal(await p.inputValue('dialog[open] #f-name'), 'Garlands', 'the refused Save lost what was typed');
    assert.equal(google.store['mothball.totes']['03'], undefined, 'saved over the sheet before the ledger answered');
    assert.deepEqual(errors, [], 'errors on the laptop');
  } finally { await laptop.close(); }
}

// Connected to a pretend ledger (the kit's own DemoLedger behind script.google.com), which goes down and comes back.
// Every request to Google is answered here: the route stays in place, refusing, once these checks are done.
async function ledgerChecks({ page, ctx, base, assert, problems }) {
  const from = problems.length;
  const { DemoLedger } = await import(new URL('../js/kit/ledger.js', import.meta.url));
  const google = new DemoLedger({ 'mothball.totes': [{ id: '04', name: 'Wreaths', season: 'christmas', items: ['Front door wreath'] }] });
  let mode = 'down';
  await page.route('https://script.google.com/**', route => (mode === 'up'
    ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(google.handle(JSON.parse(route.request().postData() || '{}'))) })
    : mode === 'badkey' ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'bad key' }) })
    : route.abort('internetdisconnected')));
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem('mothball.ledger', JSON.stringify({ url: 'https://script.google.com/macros/s/AKfyTEST/exec', key: 'k'.repeat(40) })));
  // a new phone, connected while Google can't be reached: a tapped sticker says so, then opens by itself
  await page.goto('about:blank');
  await page.goto(base + '#04');
  await page.waitForSelector("text=Can't reach the ledger yet");
  mode = 'up';
  await page.waitForSelector('.tape >> text=Wreaths', { timeout: 12000 });
  // a change made with no signal goes as soon as the signal is back, without another change or a reload
  await ctx.setOffline(true); mode = 'down';           // (a route answers even with the browser offline)
  await page.click('text=I unpacked it');
  await page.waitForFunction(() => /waiting/.test(document.querySelector('#sync').textContent));
  mode = 'up'; await ctx.setOffline(false);
  const t0 = Date.now();
  await page.waitForFunction(() => !/waiting|Saving/.test(document.querySelector('#sync').textContent), null, { timeout: 4000 });
  assert.ok(Date.now() - t0 < 4000);
  assert.ok(google.store['mothball.totes']['04'].unpacked, 'the change reached the ledger');
  // the key changed (setup run again): the line says so, not "Offline"
  mode = 'badkey';
  await page.goto('about:blank');
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#sync').textContent === 'Wrong key — connect again from Switchboard');
  assert.equal(await page.locator('#sync.badkey').count(), 1);
  mode = 'refuse';
  await page.evaluate(() => localStorage.clear());
  await page.goto(base);
  for (let i = problems.length - 1; i >= from; i--) if (/script\.google\.com|Failed to load resource: net::ERR_INTERNET_DISCONNECTED/.test(problems[i])) problems.splice(i, 1);
}

// On Letter with 0.4 in margins the page is 739 px across: the printed thing fits inside it, nothing else prints, and a
// browser in dark mode prints the light palette.
export async function printChecks(page, assert, sel) {
  for (const colorScheme of ['light', 'dark']) {
    await page.setViewportSize({ width: 739, height: 1000 });
    await page.emulateMedia({ media: 'print', colorScheme });
    const p = await page.evaluate(sel => ({
      right: Math.max(...[...document.querySelectorAll(sel)].map(c => c.getBoundingClientRect().right)),
      shown: ['header.top', '#edit-link', '#demo-note', '.no-print', '.sync', '.jd-foot'].filter(s => [...document.querySelectorAll(s)].some(el => el.getClientRects().length)),
      ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(), bg: getComputedStyle(document.body).backgroundColor }), sel);
    assert.ok(p.right > 0 && p.right <= 739, `${colorScheme}: ${sel} reaches ${Math.round(p.right)} px of the 739 px printable width`);
    assert.deepEqual(p.shown, [], `${colorScheme}: printed beside the ${sel}`);
    assert.deepEqual([p.ink, p.bg], ['#000', 'rgb(255, 255, 255)'], `${colorScheme}: not the light palette in print`);
  }
  await page.emulateMedia({ media: null, colorScheme: null });
  await page.setViewportSize({ width: 390, height: 844 });
}
