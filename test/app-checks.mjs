// Mothball's own checks, run by test/e2e.mjs on a phone-sized page.
const fakeNfc = () => { window.__nfc = { writes: [] }; window.NDEFReader = class { async write(m) { window.__nfc.writes.push(m.records[0].data); } async scan() {} }; };
export async function appChecks({ page, base, assert }) {
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
  await page.click('text=I packed it');
  await page.fill('#f-note', 'Buy a spare USB-C supply.');
  await page.click('dialog >> button[type=submit]');
  await page.waitForSelector('.note >> text=spare USB-C');
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
}
