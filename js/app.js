// Mothball: what's in each seasonal tote, and how to bring every build in it back to life next year.
import { $, h, mount, toast, sheet, confirmSheet, route, go, dayText, agoText, qrSvg, loadQr, today, lines, held, sampleLink, onRoute } from './kit/ui.js';
import { Ledger, watchConnectLinks, importSummary, refusedLine, STILL_LOADING } from './kit/ledger.js';
import { tagUrl } from './kit/tags.js';
import { nfcPanel } from './kit/panel.js';
import { SEASONS, seasonName, monthsUntil, SAMPLE } from './sample.js';
import { isOut, comingDown, tickKeys, mergeImport } from './totes.js';

const demo = new URLSearchParams(location.search).has('demo');
watchConnectLinks('mothball', toast);
const ledger = new Ledger('mothball', { demo: demo ? SAMPLE : null });
const app = $('#app');
const checked = new Set(); // contents ticked while unpacking (tickKeys): this visit only
// Build cards opened or closed on a tote's page ('01:pumpkins' -> open), so the redraw a tick makes keeps each as it was
// (a card read while unpacking stayed open only until the next tick). One not touched yet: open when it's the only one.
const cardOpen = new Map();

const totes = () => ledger.docs('totes').sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
const builds = () => ledger.docs('builds').sort((a, b) => a.name.localeCompare(b.name));
const tote = id => ledger.doc('totes', id);
const build = id => ledger.doc('builds', id);
const nextNumber = () => String(Math.max(0, ...totes().map(t => parseInt(t.id, 10) || 0)) + 1).padStart(2, '0');
// Every tote a build card is in (a card is shared by any tote it goes in), and how they read: 'tote 01', 'totes 01, 02'.
const totesOf = buildId => totes().filter(t => (t.builds || []).includes(buildId));
const toteList = ts => (ts.length > 1 ? 'totes ' : 'tote ') + ts.map(t => t.id).join(', ');
// A new tote or card waits until this phone has heard from the ledger (before that its copy can't say which numbers
// are taken, and a save would replace the tote another device has under that number), and asks for the latest first.
const COLLS = ['totes', 'builds'];
const fresh = then => e => held(e.currentTarget, ledger.catchUp(COLLS)).then(then);

// ---------------------------------------------------------------- home
// How long since, in a tote's line under its name ('Attic, by the hatch · packed 5 wk ago', '· out since Nov 2'), so the
// name has the row's width (beside a column of 'packed 10 mo ago' most names ran to two lines). The row keeps an 'out'
// chip for a tote that's out.
const shortDay = day => { const s = dayText(day), y = `, ${new Date().getFullYear()}`; return s.endsWith(y) ? s.slice(0, -y.length) : s; };
const since = t => isOut(t) ? (t.unpacked ? 'out since ' + shortDay(t.unpacked) : '') : t.packed ? 'packed ' + agoText(t.packed) : '';
function renderHome() {
  const list = totes();
  const order = SEASONS.map(s => s[0]).sort((a, b) => monthsUntil(a) - monthsUntil(b));
  const soon = comingDown(list), wait = ledger.notReady(...COLLS);
  return [
    soon ? h('div', { class: 'notice warn' }, h('p', {}, h('b', {}, soon.head), soon.text)) : null,
    order.map(k => {
      const in_ = list.filter(t => (t.season || 'other') === k);
      return in_.length ? h('section', {}, h('h2', {}, seasonName(k)), h('ul', { class: 'list' }, in_.map(t =>
        h('li', {}, h('a', { class: 'row', href: '#' + t.id },
          h('span', { class: 'num' }, t.id),
          h('span', { class: 'main' }, h('span', { class: 't' }, t.name), h('span', { class: 's' }, [t.place || 'No shelf yet', since(t)].filter(Boolean).join(' · '))),
          isOut(t) ? h('span', { class: 'meta' }, h('span', { class: 'chip' }, 'out')) : null))))) : null;
    }),
    !list.length || wait ? h('p', { class: 'empty' }, wait || 'No totes yet.') : null,
    h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', disabled: !!wait, onclick: fresh(() => editTote(null)) }, 'New tote'), h('a', { class: 'btn ghost', href: '#/builds' }, 'Build cards'),
      h('button', { type: 'button', class: 'btn ghost', disabled: !!wait, onclick: importFile }, 'Import')),
  ];
}

// A JSON file of { builds: [...], totes: [...] }. It only fills in (mergeImport): a record new to this phone is added,
// one here gets what's blank in it and the file's new lines, and nothing typed here is blanked or replaced. A record
// deleted here stays deleted, and one the file has in the wrong shape is skipped and named.
function importFile() {
  const input = h('input', { type: 'file', accept: '.json,application/json' });
  input.addEventListener('change', async () => {
    if (!COLLS.every(c => ledger.synced(c))) { toast(STILL_LOADING, 'bad'); return; }
    await ledger.catchUp(COLLS);
    let merged;
    try { merged = mergeImport(JSON.parse(await input.files[0].text()), (c, id) => ledger.doc(c, id), (c, id) => ledger.gone(c, id)); }
    catch { toast('That file isn\'t a Mothball import.', 'bad'); return; }
    for (const [coll, doc] of merged.puts) ledger.put(coll, doc);
    toast(importSummary(merged.res, ['record', 'records']), merged.res.skipped.length ? 'bad' : ''); render();
  });
  input.click();
}

// ---------------------------------------------------------------- one tote
// here: the tote whose page it's on, so a card shared with another tote says which ('Also in tote 02').
function buildCard(b, open = false, key = '', here = null) {
  const also = here ? totesOf(b.id).filter(t => t.id !== here) : [];
  return h('details', { class: 'build card', open, ontoggle: key ? e => cardOpen.set(key, e.currentTarget.open) : null },
    h('summary', {}, h('b', {}, b.name), b.firmware ? h('span', { class: 'chip' }, b.firmware) : null),
    also.length ? h('p', { class: 'muted also' }, `Also in ${toteList(also)}.`) : null,
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
  const items = t.items || [], keys = tickKeys(t.id, items);
  const bs = (t.builds || []).map(build).filter(Boolean);
  const out = isOut(t), away = !out && !!t.packed;
  // the press that comes next is the filled one: unpacking a tote that's put away, packing one that's out
  const pack = h('button', { type: 'button', class: away ? 'btn ghost' : 'btn', onclick: () => packed(t) }, 'I packed it');
  const unpack = h('button', { type: 'button', class: away ? 'btn' : 'btn ghost', onclick: () => unpacked(t) }, 'I unpacked it');
  return [
    h('p', { class: 'crumb' }, h('a', { href: '#' }, '‹ All totes')),
    h('div', { class: 'tape-wrap' }, h('span', { class: 'tape-cap' }, `Tote ${t.id} · ${seasonName(t.season)}`), h('div', { class: 'tape' }, t.name)),
    h('p', { class: 'where' }, h('b', {}, 'Lives: '), t.place || 'not set', t.box ? ` · moving box ${t.box}` : ''),
    h('p', { class: 'muted' }, out ? (t.unpacked ? `Out since ${dayText(t.unpacked)}.` : 'Out.') : t.packed ? `Packed ${dayText(t.packed)}.` : 'Not packed yet.'),
    h('div', { class: 'btns pack' }, away ? [unpack, pack] : [pack, unpack]),
    t.note ? h('div', { class: 'notice warn note' }, h('p', {}, h('b', {}, 'Note from last time: '), t.note),
      h('p', { class: 'done' }, h('button', { type: 'button', class: 'linkish', onclick: () => noteDone(t) }, 'Done'))) : null,
    h('h2', {}, 'In this tote'),
    items.length ? h('ul', { class: 'list checks' }, items.map((it, i) => {
      const k = keys[i];
      return h('li', {}, h('label', { class: 'row check' + (checked.has(k) ? ' dim' : '') },
        h('input', { type: 'checkbox', checked: checked.has(k), onchange: e => { e.target.checked ? checked.add(k) : checked.delete(k); render(); } }),
        h('span', { class: 'main' }, h('span', { class: 't' }, it))));
    })) : h('p', { class: 'muted' }, 'Nothing listed.'),
    items.length ? h('p', { class: 'muted small' }, `${keys.filter(k => checked.has(k)).length} of ${items.length} found`) : null,
    bs.length ? [h('h2', {}, bs.length > 1 ? 'Builds inside' : 'Build inside'), bs.map(b => {
      const key = `${t.id}:${b.id}`;
      return buildCard(b, cardOpen.has(key) ? cardOpen.get(key) : bs.length === 1, key, t.id);
    })] : null,
    h('div', { class: 'btns' },
      h('button', { type: 'button', class: 'btn ghost', onclick: () => editTote(t) }, 'Edit'),
      h('a', { class: 'btn ghost', href: '#/label/' + t.id }, 'Label')),
    nfcPanel(tagUrl('t', t.id), { sample: !!ledger.demo, tagged: t.tagged, onWritten: () => { ledger.put('totes', { ...(tote(t.id) || t), tagged: today() }); render(); } }),
  ];
}

async function packed(t) {
  const made = v => ({ ...(tote(t.id) || t), packed: today(), out: false, note: v.note, place: v.place });
  const v = await sheet({ title: `Packing tote ${t.id}`, ok: 'Packed', fields: [
    { name: 'note', label: 'Note to next year', type: 'textarea', rows: 4, value: t.note, placeholder: 'What broke, what you ran out of, what to buy before it comes out again.' },
    { name: 'place', label: 'Where it\'s going', value: t.place },
  ], check: v => refusedLine(made(v)) });
  if (!v || v.__danger) return;
  ledger.put('totes', made(v));
  [...checked].filter(k => k.startsWith(t.id + ':')).forEach(k => checked.delete(k));
  toast(`Tote ${t.id} packed.`); render();
}
function unpacked(t) {
  ledger.put('totes', { ...(tote(t.id) || t), unpacked: today(), out: true });
  toast(`Tote ${t.id} is out.`); render();
}
// The note was seen to (the new supply bought): it goes, after a yes.
async function noteDone(t) {
  if (!await confirmSheet('Clear the note?', `"${t.note}" goes. A new one can go in Edit, or when you pack it.`, 'Clear it', { danger: true })) return;
  ledger.put('totes', { ...(tote(t.id) || t), note: '' });
  toast('Note cleared.'); render();
}

async function editTote(t) {
  const exists = !!(t?._updated && tote(t.id));   // a sticker page's stub has no saved time: always a new tote
  // The build cards inside: every card to tick (its name and season), the tote's ticked; saved as the same list of ids,
  // in the order they were, new ones after. An id with no card here (a card since deleted) stays as it was.
  const cards = builds(), had = t?.builds || [];
  const picks = cards.length ? h('fieldset', { class: 'picks' }, h('legend', {}, 'Build cards inside'),
    cards.map(b => h('label', { class: 'pick' }, h('input', { type: 'checkbox', name: 'card', value: b.id, checked: had.includes(b.id) }),
      h('span', {}, b.name), h('small', {}, seasonName(b.season)))))
    : h('p', { class: 'picks none' }, h('b', {}, 'Build cards inside: '), 'Make cards under Build cards.');
  const picked = () => {
    const on = [...picks.querySelectorAll('input:checked')].map(i => i.value);
    return [...had.filter(id => on.includes(id) || !build(id)), ...on.filter(id => !had.includes(id))];
  };
  // the tote as typed: its number made safe for a sticker, the contents as a list
  const made = v => {
    const id = (v.id || nextNumber()).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12) || nextNumber();
    return { ...(t || {}), id, name: v.name, season: v.season, place: v.place, box: v.box, note: v.note, items: lines(v.items), builds: picked() };
  };
  // a Save that can't go keeps the sheet open with everything typed: a number another tote has, or not heard from the ledger yet
  const check = v => {
    const doc = made(v), id = doc.id;
    if (!tote(id) && !ledger.synced('totes')) return STILL_LOADING;
    if ((!exists || t.id !== id) && tote(id)) return { field: 'id', line: `There's already a tote ${id}.` };
    return refusedLine(doc);
  };
  const v = await sheet({ title: t?.id ? `Tote ${t.id}` : 'New tote', danger: exists ? 'Delete' : null, check, body: picks, fields: [
    { name: 'id', label: 'Number', value: t?.id || nextNumber(), inputmode: 'numeric', hint: exists ? 'The number on its sticker. Changing it needs a new sticker.' : 'Write it big on the tote too.' },
    { name: 'name', label: 'What it is', value: t?.name, required: true, placeholder: 'Christmas lights and the porch train' },
    { name: 'season', label: 'Season', type: 'select', value: t?.season || 'christmas', options: SEASONS.map(s => [s[0], s[1]]) },
    { name: 'place', label: 'Where it lives', value: t?.place, placeholder: 'Garage, top shelf, left' },
    { name: 'items', label: 'Contents (one per line)', type: 'textarea', rows: 6, value: (t?.items || []).join('\n') },
    { name: 'note', label: 'Note to next year', type: 'textarea', rows: 3, value: t?.note, placeholder: 'What broke, what you ran out of, what to buy before it comes out again.' },
    { name: 'box', label: 'Moving box number', value: t?.box, hint: 'From Manifest, while it travels.' },
  ] });
  if (!v) return;
  if (v.__danger) {
    if (await confirmSheet(`Delete tote ${t.id}?`, 'Its list and notes go. The build cards stay.', 'Delete', { danger: true })) { ledger.del('totes', t.id); go('#'); }
    return;
  }
  const doc = made(v), id = doc.id;
  if (exists && t.id !== id) { ledger.del('totes', t.id); delete doc.tagged; }   // a new number needs a new sticker
  ledger.put('totes', doc);
  go('#' + id); render();
}

// ---------------------------------------------------------------- build cards
function renderBuilds() {
  const wait = ledger.notReady(...COLLS);
  return [
    h('p', { class: 'crumb' }, h('a', { href: '#' }, '‹ All totes')),
    h('h2', {}, 'Build cards'),
    h('p', { class: 'muted' }, 'One card per build: how it\'s powered, which firmware it runs, and the steps to bring it up again.'),
    h('ul', { class: 'list' }, builds().map(b => h('li', {}, h('a', { class: 'row', href: '#/build/' + b.id },
      h('span', { class: 'main' }, h('span', { class: 't' }, b.name), h('span', { class: 's' }, seasonName(b.season) + ' · ' + (totesOf(b.id).length ? toteList(totesOf(b.id)) : 'not in a tote'))),
      h('span', { class: 'meta' }, b.firmware || ''))))),
    wait ? h('p', { class: 'empty' }, wait) : null,
    h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', disabled: !!wait, onclick: fresh(() => editBuild(null)) }, 'New build card')),
  ];
}
function renderBuild(b) {
  return [h('p', { class: 'crumb' }, h('a', { href: '#/builds' }, '‹ Build cards')), buildCard(b, true),
    h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: () => editBuild(b) }, 'Edit'))];
}
async function editBuild(b) {
  const made = v => ({ ...(b || {}), id: b?.id || uniqueBuildId(v.name), ...v });
  const check = v => !b && !ledger.synced('builds') ? STILL_LOADING : refusedLine(made(v));
  const v = await sheet({ title: b ? b.name : 'New build card', danger: b ? 'Delete' : null, check, fields: [
    { name: 'name', label: 'Name', value: b?.name, required: true },
    { name: 'season', label: 'Season', type: 'select', value: b?.season || 'christmas', options: SEASONS.map(s => [s[0], s[1]]) },
    { name: 'power', label: 'Power', value: b?.power, placeholder: '12 V 1 A barrel supply, centre positive' },
    { name: 'firmware', label: 'Firmware version', value: b?.firmware },
    { name: 'code', label: 'Where the code is', value: b?.code },
    { name: 'wifi', label: 'Wi-Fi, and how to point it at a new network', type: 'textarea', rows: 2, value: b?.wifi },
    { name: 'bringup', label: 'Bring it up (one step per line)', type: 'textarea', rows: 5, value: b?.bringup },
    { name: 'packing', label: 'Packing it (one per line)', type: 'textarea', rows: 3, value: b?.packing },
    { name: 'quirks', label: 'Watch for', type: 'textarea', rows: 2, value: b?.quirks },
    { name: 'guide', label: 'Build guide link', type: 'url', value: b?.guide },
  ] });
  if (!v) return;
  if (v.__danger) { if (await confirmSheet(`Delete ${b.name}?`, 'The card goes; totes keep their contents list.', 'Delete', { danger: true })) { ledger.del('builds', b.id); go('#/builds'); } return; }
  const doc = made(v);
  ledger.put('builds', doc);
  go('#/build/' + doc.id); render();
}
function uniqueBuildId(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'build';
  let id = base, n = 2;
  while (build(id)) id = `${base}-${n++}`;
  return id;
}

// ---------------------------------------------------------------- label
// What a label lists: the builds inside first ('Light-up pumpkins (build)'), then the contents; six lines in all, the
// sixth 'and 4 more' when there are more. (A tote set up with only its build cards, as a starter file makes them, would
// otherwise print just its name.)
function labelLines(t) {
  const all = [...(t.builds || []).map(build).filter(Boolean).map(b => `${b.name} (build)`), ...(t.items || [])];
  return all.length > 6 ? [...all.slice(0, 5), `and ${all.length - 5} more`] : all;
}
// The QR library comes the first time a label opens: until then a line says so, and the label is drawn again when it has.
let qrAsked = false, qrFailed = false;
function renderLabel(t) {
  if (!window.qrcode) {
    if (!qrAsked) { qrAsked = true; loadQr().then(render, () => { qrFailed = true; render(); }); }
    return [h('div', { class: 'no-print' }, h('p', { class: 'crumb' }, h('a', { href: '#' + t.id }, '‹ Tote ' + t.id)),
      h('p', { class: 'empty', role: 'status' }, qrFailed ? 'The QR code didn\'t load. Reload the page to try again.' : 'Making the QR code…'))];
  }
  return [
    h('div', { class: 'no-print' }, h('p', { class: 'crumb' }, h('a', { href: '#' + t.id }, '‹ Tote ' + t.id)),
      h('p', { class: 'muted' }, 'Print it, trim it and tape it to the end of the tote, with the NFC sticker under the tape.'),
      h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: () => print() }, 'Print'))),
    h('div', { class: 'label' },
      h('div', { class: 'label-num' }, t.id),
      h('div', { class: 'label-body' }, h('b', {}, t.name), h('span', {}, seasonName(t.season)), h('ul', {}, labelLines(t).map(l => h('li', {}, l)))),
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
    // A sticker written t/1 for a tote that's 01 now (typed as 1 on a sheet the ledger script's first version kept, which
    // 1.1 mends to 01): that tote, not "Set up tote 1" beside it
    if (!tote(r.id) && /^[0-9]$/.test(r.id) && tote('0' + r.id)) { history.replaceState(null, '', location.pathname + location.search + '#0' + r.id); render(); return; }
    const t = tote(r.id), wait = ledger.notReady(...COLLS);
    body = t ? renderTote(t) : [h('p', { class: 'crumb' }, h('a', { href: '#' }, '‹ All totes')), h('p', { class: 'empty' }, wait || `No tote ${r.id} yet.`),
      !wait ? h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn', onclick: fresh(() => tote(r.id) ? render() : editTote({ id: r.id, name: '', items: [], builds: [] }).catch(() => {})) }, `Set up tote ${r.id}`)) : null];
  } else body = renderHome();
  mount(app, body);
  const st = $('#sync'); st.className = 'sync ' + ledger.state; st.textContent = ledger.statusText();
  if (ledger.demo && !$('.sample-out')) st.after(sampleLink());
  document.title = r.view === 'item' && tote(r.id) ? `Tote ${r.id} · Mothball` : 'Mothball';
}

onRoute(render);
ledger.on(() => { const st = $('#sync'); if (st) { st.className = 'sync ' + ledger.state; st.textContent = ledger.statusText(); } });
render();
ledger.keepUp(COLLS, render);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__mothball = { ledger, render };
