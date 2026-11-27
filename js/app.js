// Mothball: what's in each seasonal tote, and how to bring every build in it back to life next year.
import { $, h, mount, toast, sheet, confirmSheet, route, go, dayText, agoText, qrSvg, today, lines } from './kit/ui.js';
import { Ledger, watchConnectLinks, refusal, importText } from './kit/ledger.js';
import { tagUrl } from './kit/tags.js';
import { nfcPanel } from './kit/panel.js';
import { SEASONS, seasonName, monthsUntil, SAMPLE } from './sample.js';
import { isOut, comingDown } from './totes.js';

const demo = new URLSearchParams(location.search).has('demo');
watchConnectLinks('mothball', toast);
const ledger = new Ledger('mothball', { demo: demo ? SAMPLE : null });
const app = $('#app');
const checked = new Set(); // contents ticked while unpacking: this visit only

const totes = () => ledger.docs('totes').sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
const builds = () => ledger.docs('builds').sort((a, b) => a.name.localeCompare(b.name));
const tote = id => ledger.doc('totes', id);
const build = id => ledger.doc('builds', id);
const nextNumber = () => String(Math.max(0, ...totes().map(t => parseInt(t.id, 10) || 0)) + 1).padStart(2, '0');
const toteOf = buildId => totes().find(t => (t.builds || []).includes(buildId));

// ---------------------------------------------------------------- home
function renderHome() {
  const list = totes();
  const order = SEASONS.map(s => s[0]).sort((a, b) => monthsUntil(a) - monthsUntil(b));
  const soon = comingDown(list);
  return [
    soon ? h('div', { class: 'notice warn' }, h('p', {}, h('b', {}, soon.head), soon.text)) : null,
    order.map(k => {
      const in_ = list.filter(t => (t.season || 'other') === k);
      return in_.length ? h('section', {}, h('h2', {}, seasonName(k)), h('ul', { class: 'list' }, in_.map(t =>
        h('li', {}, h('a', { class: 'row', href: '#' + t.id },
          h('span', { class: 'num' }, t.id),
          h('span', { class: 'main' }, h('span', { class: 't' }, t.name), h('span', { class: 's' }, t.place || 'No shelf yet')),
          h('span', { class: 'meta' }, isOut(t) ? 'out' : t.packed ? 'packed ' + agoText(t.packed) : '')))))) : null;
    }),
    !list.length ? h('p', { class: 'empty' }, ledger.notReady('totes') || 'No totes yet.') : null,
    h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: () => editTote(null) }, 'New tote'), h('a', { class: 'btn ghost', href: '#/builds' }, 'Build cards'),
      h('button', { type: 'button', class: 'btn ghost', onclick: importFile }, 'Import')),
  ];
}

// A JSON file of { builds: [...], totes: [...] }: each record is added, or merged over the one with the same id.
function importFile() {
  const input = h('input', { type: 'file', accept: '.json,application/json' });
  input.addEventListener('change', async () => {
    try {
      const data = JSON.parse(await input.files[0].text());
      let n = 0;
      const skipped = {};
      for (const [coll, list] of [['builds', data.builds], ['totes', data.totes]]) for (const d of list || []) {
        if (!d) continue;
        const rec = { ...(ledger.doc(coll, d.id) || {}), ...d }, why = refusal(rec);
        if (why) { skipped[why] = (skipped[why] || 0) + 1; continue; }
        ledger.put(coll, rec); n++;
      }
      toast(importText(n, skipped), Object.keys(skipped).length ? 'bad' : ''); render();
    } catch { toast('That file isn\'t a Mothball import.', 'bad'); }
  });
  input.click();
}

// ---------------------------------------------------------------- one tote
function buildCard(b, open = false) {
  return h('details', { class: 'build card', open },
    h('summary', {}, h('b', {}, b.name), b.firmware ? h('span', { class: 'chip' }, b.firmware) : null),
    h('dl', { class: 'facts' },
      b.power ? [h('dt', {}, 'Power'), h('dd', {}, b.power)] : null,
      b.wifi ? [h('dt', {}, 'Wi-Fi'), h('dd', {}, b.wifi)] : null,
      b.code ? [h('dt', {}, 'Code'), h('dd', {}, b.code)] : null),
    lines(b.bringup).length ? [h('h3', {}, 'Bring it up'), h('ol', { class: 'steps' }, lines(b.bringup).map(l => h('li', {}, l)))] : null,
    b.quirks ? h('div', { class: 'notice' }, h('p', {}, h('b', {}, 'Watch for: '), b.quirks)) : null,
    lines(b.packing).length ? [h('h3', {}, 'Packing it'), h('ul', {}, lines(b.packing).map(l => h('li', {}, l)))] : null,
    h('div', { class: 'btns' },
      b.guide ? h('a', { class: 'btn ghost', href: b.guide, target: '_blank', rel: 'noopener' }, 'Build guide') : null,
      h('a', { class: 'btn ghost', href: '#/build/' + b.id }, 'Edit card')));
}

function renderTote(t) {
  const items = t.items || [];
  const bs = (t.builds || []).map(build).filter(Boolean);
  const out = isOut(t);
  return [
    h('p', { class: 'crumb' }, h('a', { href: '#' }, '‹ All totes')),
    h('div', { class: 'tape-wrap' }, h('span', { class: 'tape-cap' }, `Tote ${t.id} · ${seasonName(t.season)}`), h('div', { class: 'tape' }, t.name)),
    h('p', { class: 'where' }, h('b', {}, 'Lives: '), t.place || 'not set', t.box ? ` · moving box ${t.box}` : ''),
    h('p', { class: 'muted' }, out ? (t.unpacked ? `Out since ${dayText(t.unpacked)}.` : 'Out.') : t.packed ? `Packed ${dayText(t.packed)}.` : 'Not packed yet.'),
    t.note ? h('div', { class: 'notice warn note' }, h('p', {}, h('b', {}, 'Note from last time: '), t.note),
      h('p', { class: 'done' }, h('button', { type: 'button', class: 'linkish', onclick: () => noteDone(t) }, 'Done'))) : null,
    h('h2', {}, 'In this tote'),
    items.length ? h('ul', { class: 'list checks' }, items.map((it, i) => {
      const k = t.id + ':' + i;
      return h('li', {}, h('label', { class: 'row check' + (checked.has(k) ? ' dim' : '') },
        h('input', { type: 'checkbox', checked: checked.has(k), onchange: e => { e.target.checked ? checked.add(k) : checked.delete(k); render(); } }),
        h('span', { class: 'main' }, h('span', { class: 't' }, it))));
    })) : h('p', { class: 'muted' }, 'Nothing listed.'),
    items.length ? h('p', { class: 'muted small' }, `${[...checked].filter(k => k.startsWith(t.id + ':')).length} of ${items.length} found`) : null,
    bs.length ? [h('h2', {}, bs.length > 1 ? 'Builds inside' : 'Build inside'), bs.map(b => buildCard(b, bs.length === 1))] : null,
    h('div', { class: 'btns' },
      h('button', { type: 'button', class: 'btn', onclick: () => packed(t) }, 'I packed it'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => unpacked(t) }, 'I unpacked it'),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => editTote(t) }, 'Edit'),
      h('a', { class: 'btn ghost', href: '#/label/' + t.id }, 'Label')),
    nfcPanel(tagUrl('t', t.id), { tagged: t.tagged, onWritten: () => { ledger.put('totes', { ...(tote(t.id) || t), tagged: today() }); render(); } }),
  ];
}

async function packed(t) {
  const v = await sheet({ title: `Packing tote ${t.id}`, ok: 'Packed', fields: [
    { name: 'note', label: 'Note to next year', type: 'textarea', rows: 4, value: t.note, placeholder: 'What broke, what you ran out of, what to buy before it comes out again.' },
    { name: 'place', label: 'Where it\'s going', value: t.place },
  ] });
  if (!v || v.__danger) return;
  ledger.put('totes', { ...(tote(t.id) || t), packed: today(), out: false, note: v.note, place: v.place });
  [...checked].filter(k => k.startsWith(t.id + ':')).forEach(k => checked.delete(k));
  toast(`Tote ${t.id} packed.`); render();
}
function unpacked(t) {
  ledger.put('totes', { ...(tote(t.id) || t), unpacked: today(), out: true });
  toast(`Tote ${t.id} is out.`); render();
}
// The note was seen to (the new supply bought): it goes, after a yes.
async function noteDone(t) {
  if (!await confirmSheet('Clear the note?', `"${t.note}" goes. A new one can go in Edit, or when you pack it.`, 'Clear it')) return;
  ledger.put('totes', { ...(tote(t.id) || t), note: '' });
  toast('Note cleared.'); render();
}

async function editTote(t) {
  const exists = !!(t && tote(t.id));
  const v = await sheet({ title: t?.id ? `Tote ${t.id}` : 'New tote', danger: exists ? 'Delete' : null, fields: [
    { name: 'id', label: 'Number', value: t?.id || nextNumber(), inputmode: 'numeric', hint: exists ? 'The number on its sticker. Changing it needs a new sticker.' : 'Write it big on the tote too.' },
    { name: 'name', label: 'What it is', value: t?.name, required: true, placeholder: 'Christmas lights and the rink' },
    { name: 'season', label: 'Season', type: 'select', value: t?.season || 'christmas', options: SEASONS.map(s => [s[0], s[1]]) },
    { name: 'place', label: 'Where it lives', value: t?.place, placeholder: 'Garage, top shelf, left' },
    { name: 'items', label: 'Contents (one per line)', type: 'textarea', rows: 6, value: (t?.items || []).join('\n') },
    { name: 'note', label: 'Note to next year', type: 'textarea', rows: 3, value: t?.note, placeholder: 'What broke, what you ran out of, what to buy before it comes out again.' },
    { name: 'builds', label: 'Build cards inside (comma-separated ids)', value: (t?.builds || []).join(', '), hint: builds().length ? 'Cards: ' + builds().map(b => b.id).join(', ') : 'Make cards under Build cards.' },
    { name: 'box', label: 'Moving box number', value: t?.box, hint: 'From Manifest, while it travels.' },
  ] });
  if (!v) return;
  if (v.__danger) {
    if (await confirmSheet(`Delete tote ${t.id}?`, 'Its list and notes go. The build cards stay.', 'Delete')) { ledger.del('totes', t.id); go('#'); }
    return;
  }
  const id = (v.id || nextNumber()).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12) || nextNumber();
  if ((!exists || t.id !== id) && tote(id)) { toast(`There's already a tote ${id}.`, 'bad'); return; }
  const doc = { ...(t || {}), id, name: v.name, season: v.season, place: v.place, box: v.box, note: v.note,
    items: lines(v.items), builds: v.builds.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) };
  if (exists && t.id !== id) ledger.del('totes', t.id);
  ledger.put('totes', doc);
  go('#' + id); render();
}

// ---------------------------------------------------------------- build cards
function renderBuilds() {
  return [
    h('p', { class: 'crumb' }, h('a', { href: '#' }, '‹ All totes')),
    h('h2', {}, 'Build cards'),
    h('p', { class: 'muted' }, 'One card per build: how it\'s powered, which firmware it runs, and the steps to bring it up again.'),
    h('ul', { class: 'list' }, builds().map(b => h('li', {}, h('a', { class: 'row', href: '#/build/' + b.id },
      h('span', { class: 'main' }, h('span', { class: 't' }, b.name), h('span', { class: 's' }, seasonName(b.season) + (toteOf(b.id) ? ` · tote ${toteOf(b.id).id}` : ' · not in a tote'))),
      h('span', { class: 'meta' }, b.firmware || ''))))),
    h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: () => editBuild(null) }, 'New build card')),
  ];
}
function renderBuild(b) {
  return [h('p', { class: 'crumb' }, h('a', { href: '#/builds' }, '‹ Build cards')), buildCard(b, true),
    h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: () => editBuild(b) }, 'Edit'))];
}
async function editBuild(b) {
  const v = await sheet({ title: b ? b.name : 'New build card', danger: b ? 'Delete' : null, fields: [
    { name: 'name', label: 'Name', value: b?.name, required: true },
    { name: 'season', label: 'Season', type: 'select', value: b?.season || 'christmas', options: SEASONS.map(s => [s[0], s[1]]) },
    { name: 'power', label: 'Power', value: b?.power, placeholder: '5 V 3 A barrel supply, centre positive' },
    { name: 'firmware', label: 'Firmware version', value: b?.firmware },
    { name: 'code', label: 'Where the code is', value: b?.code },
    { name: 'wifi', label: 'Wi-Fi, and how to point it at a new network', type: 'textarea', rows: 2, value: b?.wifi },
    { name: 'bringup', label: 'Bring it up (one step per line)', type: 'textarea', rows: 5, value: b?.bringup },
    { name: 'packing', label: 'Packing it (one per line)', type: 'textarea', rows: 3, value: b?.packing },
    { name: 'quirks', label: 'Watch for', type: 'textarea', rows: 2, value: b?.quirks },
    { name: 'guide', label: 'Build guide link', type: 'url', value: b?.guide },
  ] });
  if (!v) return;
  if (v.__danger) { if (await confirmSheet(`Delete ${b.name}?`, 'The card goes; totes keep their contents list.', 'Delete')) { ledger.del('builds', b.id); go('#/builds'); } return; }
  const id = b?.id || uniqueBuildId(v.name);
  ledger.put('builds', { ...(b || {}), id, ...v });
  go('#/build/' + id); render();
}
function uniqueBuildId(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'build';
  let id = base, n = 2;
  while (build(id)) id = `${base}-${n++}`;
  return id;
}

// ---------------------------------------------------------------- label
function renderLabel(t) {
  return [
    h('div', { class: 'no-print' }, h('p', { class: 'crumb' }, h('a', { href: '#' + t.id }, '‹ Tote ' + t.id)),
      h('p', { class: 'muted' }, 'Print it, trim it and tape it to the end of the tote, with the NFC sticker under the tape.'),
      h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: () => print() }, 'Print'))),
    h('div', { class: 'label' },
      h('div', { class: 'label-num' }, t.id),
      h('div', { class: 'label-body' }, h('b', {}, t.name), h('span', {}, seasonName(t.season)),
        h('ul', {}, (t.items || []).slice(0, 6).map(i => h('li', {}, i)), (t.items || []).length > 6 ? h('li', {}, `and ${(t.items || []).length - 6} more`) : null)),
      h('div', { class: 'label-qr', html: qrSvg(tagUrl('t', t.id), { size: 120 }) })),
  ];
}

// ---------------------------------------------------------------- frame
function render() {
  const r = route();
  if (!ledger.connected) {
    mount(app, h('div', { class: 'card' }, h('h2', {}, 'Connect first'),
      h('p', {}, 'Mothball keeps its lists in your Switchboard ledger. Open Switchboard and press Connect beside Mothball.'),
      h('div', { class: 'btns' }, h('a', { class: 'btn', href: 'https://tag.junkdrawer.works/#apps' }, 'Open Switchboard'), h('a', { class: 'btn ghost', href: '?demo' }, 'Try the sample'))));
    return;
  }
  let body;
  if (r.view === 'builds') body = renderBuilds();
  else if (r.view === 'build') { const b = build(r.arg); body = b ? renderBuild(b) : [h('p', { class: 'empty' }, 'No such card.')]; }
  else if (r.view === 'label') { const t = tote(r.arg); body = t ? renderLabel(t) : [h('p', { class: 'empty' }, 'No such tote.')]; }
  else if (r.view === 'item') {
    const t = tote(r.id), wait = ledger.notReady('totes');
    body = t ? renderTote(t) : [h('p', { class: 'crumb' }, h('a', { href: '#' }, '‹ All totes')), h('p', { class: 'empty' }, wait || `No tote ${r.id} yet.`),
      !wait ? h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: () => editTote({ id: r.id, name: '', items: [], builds: [] }).catch(() => {}) }, `Set up tote ${r.id}`)) : null];
  } else body = renderHome();
  mount(app, body);
  const st = $('#sync'); st.className = 'sync ' + ledger.state; st.textContent = ledger.statusText();
  document.title = r.view === 'item' && tote(r.id) ? `Tote ${r.id} · Mothball` : 'Mothball';
}

window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
ledger.on(() => { const st = $('#sync'); if (st) { st.className = 'sync ' + ledger.state; st.textContent = ledger.statusText(); } });
render();
ledger.keepUp(['totes', 'builds'], render);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__mothball = { ledger, render };
