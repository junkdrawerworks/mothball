// Mothball's own checks, run by test/e2e.mjs on a phone-sized page.
const fakeNfc = () => { window.__nfc = { writes: [] }; window.NDEFReader = class { async write(m) { window.__nfc.writes.push(m.records[0].data); } async scan() {} }; };
export async function appChecks({ page, ctx, base, assert, problems }) {
  assert.match(await page.locator('#app').innerText(), /connect first/i);
  assert.equal(await page.locator('#sync').isVisible(), false, 'a lone status dot under the name on the Connect first screen');
  await page.addInitScript(fakeNfc);
  await page.goto(base + '?demo');
  await page.waitForSelector('.row .num');
  assert.equal(await page.locator('.row .num').count(), 2);
  await page.click('text=Skating rink >> nth=0');
  await page.waitForSelector('.tape >> text=Skating rink');
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
  assert.equal(await page.locator('.row', { hasText: '02' }).locator('.meta').textContent(), 'packed today');
  // that was a mistake: I unpacked it the same day wins
  await page.click('text=Skating rink >> nth=0');
  await page.click('text=I unpacked it');
  await page.waitForSelector('.toast.show >> text=Tote 02 is out.');
  assert.match(await page.locator('.where + p').textContent(), /^Out since [A-Z][a-z]{2} \d{1,2}, \d{4}\.$/, 'a same-day unpack still reads packed');
  assert.deepEqual(await packRow(), [['I packed it', 'btn'], ['I unpacked it', 'btn ghost']]);
  const t02 = await page.evaluate(() => window.__mothball.ledger.doc('totes', '02'));
  assert.deepEqual([t02.packed === t02.unpacked, t02.out], [true, true]);
  await page.click('text=‹ All totes');
  await page.waitForSelector('.row .num');
  assert.equal(await page.locator('.row', { hasText: '02' }).locator('.meta').textContent(), 'out');
  // tote 01: the note to next year is in Edit, and Done clears it
  await page.click('text=Animated hand and hanging skeleton');
  await page.click('#app button:text-is("Edit")');
  assert.match(await page.locator('#f-note').inputValue(), /^The ring finger tendon frayed/);
  await page.fill('#f-note', 'Bring braided line.');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.note >> text=Bring braided line.');
  await page.click('.note >> text=Done');
  await page.click('dialog >> text=Clear it');
  await page.waitForSelector('.toast.show >> text=Note cleared.');
  assert.equal(await page.locator('.note').count(), 0);
  assert.equal(await page.evaluate(() => window.__mothball.ledger.doc('totes', '01').note), '');
  await page.click('text=‹ All totes');
  // ticks stay on their things when a line is taken out in Edit
  await page.click('text=Animated hand and hanging skeleton');
  await page.locator('.checks input').nth(0).check();
  await page.locator('.checks input').nth(1).check();
  await page.waitForSelector('text=2 of 4 found');
  await page.click('#app button:text-is("Edit")');
  await page.locator('#f-items').fill((await page.locator('#f-items').inputValue()).split('\n').slice(1).join('\n'));
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('text=of 3 found');
  assert.deepEqual(await page.locator('.checks label').evaluateAll(ls => ls.filter(l => l.querySelector('input').checked).map(l => l.innerText.trim())),
    ['5 V 3 A supply and barrel lead'], 'the ticks moved to other things');
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
  // an import with a record the ledger would refuse: the rest go in, and the toast says what was left out
  await page.goto(base + '?demo');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('text=Import')]);
  await chooser.setFiles({ name: 'totes.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ totes: [{ id: 'Tree topper', name: 'A name, not a number' }, { id: '07', name: 'Garlands', season: 'christmas' }] })) });
  await page.waitForSelector('.toast.show >> text=Imported 1, skipped 1 with a bad id.');
  await page.waitForSelector('.row >> text=Garlands');

  await ledgerChecks({ page, ctx, base, assert, problems });
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
