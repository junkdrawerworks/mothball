// Mothball's own checks, run by test/e2e.mjs on a phone-sized page.
const fakeNfc = () => { window.__nfc = { writes: [] }; window.NDEFReader = class { async write(m) { window.__nfc.writes.push(m.records[0].data); } async scan() {} }; };
export async function appChecks({ page, ctx, base, assert, problems }) {
  assert.match(await page.locator('#app').innerText(), /connect first/i);
  await page.addInitScript(fakeNfc);
  await page.goto(base + '?demo');
  await page.waitForSelector('.row .num');
  assert.equal(await page.locator('.row .num').count(), 2);
  await page.click('text=Skating rink >> nth=0');
  await page.waitForSelector('.tape >> text=Skating rink');
  assert.equal(await page.locator('.checks li').count(), 4);
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
  // a new tote, set up from a tag that isn't in the list yet
  await page.goto(base + '?demo#05');
  await page.click('text=Set up tote 05');
  await page.fill('#f-name', 'Wreaths');
  await page.fill('#f-items', 'Front door wreath\nWreath hanger');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.tape >> text=Wreaths');
  await page.goto(base + '?demo#/label/01');
  await page.waitForSelector('.label-qr svg');
  assert.match(await page.locator('.label-num').innerText(), /01/);
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
