// A tote's state, its ticks and the home page's notice, from its records. No DOM here, so it is unit-tested.
import { SEASONS, seasonName, monthsUntil } from './sample.js';
import { lines } from './kit/ui.js';
import { fillIn, refusal } from './kit/ledger.js';
import { found } from './kit/find.js';

// Out of storage? Each press saves it (out: true for "I unpacked it", false for "I packed it"), so the last press wins,
// even on the same day; a tote saved before that goes by its two dates.
export function isOut(t) {
  if (typeof t.out === 'boolean') return t.out;
  return !!t.unpacked && (!t.packed || t.unpacked > t.packed);
}

// 'Tote 02', 'Totes 01 and 02', 'Totes 04, 05 and 06'.
export function toteNames(ids) {
  if (ids.length < 2) return `Tote ${ids[0]}`;
  return `Totes ${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

// The notice for the season that's here or next month: its totes still put away. None left (or none at all): null.
export function comingDown(totes, now = new Date()) {
  const order = SEASONS.map(s => s[0]).filter(k => monthsUntil(k, now) <= 1).sort((a, b) => monthsUntil(a, now) - monthsUntil(b, now));
  for (const k of order) {
    const ids = totes.filter(t => t.season === k && !isOut(t)).map(t => t.id);
    if (ids.length) return { head: `${seasonName(k)} ${monthsUntil(k, now) === 0 ? 'is here' : 'is next month'}. `,
      text: `${toteNames(ids)} ${ids.length > 1 ? 'come' : 'comes'} down.` };
  }
  return null;
}

// What a tick is kept under: the line's text (the second line with the same text gets #2), so a tick stays on its
// thing when other lines are added or taken out.
export function tickKeys(id, items) {
  const seen = {};
  return items.map(it => { const n = (seen[it] = (seen[it] || 0) + 1); return `${id}:${it}${n > 1 ? '#' + n : ''}`; });
}

// Do I have…: what has every word typed (the kit's search, as Larder's), one row each, by tote number: a tote by its
// name, a contents line, a build card in it by its card's name ({ tote, what: 'tote' | 'line' | 'card', text, card });
// then a card in no tote ({ tote: null, what: 'card', ... }). cards: every card, to look each tote's ids up.
export function findIn(q, totes, cards) {
  const byId = new Map(cards.map(b => [b.id, b])), packed = new Set(), out = [];
  for (const t of totes) {
    if (found(q, t.name)) out.push({ tote: t, what: 'tote', text: t.name });
    for (const line of t.items || []) if (found(q, line)) out.push({ tote: t, what: 'line', text: line });
    for (const id of t.builds || []) {
      const b = byId.get(id);
      if (b) packed.add(id);
      if (b && found(q, b.name)) out.push({ tote: t, what: 'card', text: b.name, card: b });
    }
  }
  for (const b of cards) if (!packed.has(b.id) && found(q, b.name)) out.push({ tote: null, what: 'card', text: b.name, card: b });
  return out;
}

// Moving a contents line or a build card to another tote: both totes as they're saved, together, [from, to], or null
// when it isn't in `from` any more (moved or deleted on another device while the sheet was open). The line is the one
// at index i if it still reads the same, else the first that does, and goes at the end of `to`'s contents; a card `to`
// already has isn't listed in it twice.
export function lineMoved(from, to, i, text) {
  const items = [...(from.items || [])], at = items[i] === text ? i : items.indexOf(text);
  if (at < 0 || from.id === to.id) return null;
  items.splice(at, 1);
  return [{ ...from, items }, { ...to, items: [...(to.items || []), text] }];
}
export function cardMoved(from, to, card) {
  const had = to.builds || [];
  if (!(from.builds || []).includes(card) || from.id === to.id) return null;
  return [{ ...from, builds: from.builds.filter(b => b !== card) }, { ...to, builds: had.includes(card) ? had : [...had, card] }];
}

// ---- import
// A record from an import file, checked before it goes in: { rec } (its id as a sticker reads it, its lists as lists of
// lines) or { why }, naming it for the toast. A tote's number follows New tote's rule (letters, digits and dashes, up
// to 12); a card's id the sticker rule. Contents or build cards given as one block of text are split into lines.
const TOTE_ID = /^[a-z0-9][a-z0-9-]{0,11}$/, CARD_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export function checkImport(coll, d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { why: 'a line that isn\'t a record' };
  const id = typeof d.id === 'string' ? d.id.trim().toLowerCase() : '';
  if (!(coll === 'totes' ? TOTE_ID : CARD_ID).test(id)) return { why: `id ${JSON.stringify(d.id ?? '')}` };
  if (d.name != null && typeof d.name !== 'string') return { why: `"${id}" (its name isn't text)` };
  const rec = { ...d, id };
  for (const k of coll === 'totes' ? ['items', 'builds'] : []) {
    if (rec[k] == null) continue;
    if (typeof rec[k] === 'string') rec[k] = lines(rec[k]);
    if (!Array.isArray(rec[k]) || rec[k].some(x => typeof x !== 'string')) return { why: `"${id}" (its ${k === 'items' ? 'contents' : 'build cards'} aren't a list)` };
    rec[k] = rec[k].map(s => (k === 'builds' ? s.trim().toLowerCase() : s.trim())).filter(Boolean);
  }
  return { rec };
}

// An import file ({ builds: [...], totes: [...] }) over this phone's records. here(coll, id) is the record here,
// gone(coll, id) true for one deleted here. Each record only fills in (the kit's fillIn): nothing typed here is blanked
// or replaced, contents and build cards gain the file's lines they don't have, and a record deleted here stays deleted.
// Returns { puts: [[coll, doc]], res, back } (res for the kit's importSummary). Throws on a file that isn't this shape.
// With back (the file is a saved copy), a record deleted here goes in back, whole ([coll, doc]), for the app to offer.
export function mergeImport(data, here, gone, { back = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || (data.builds == null && data.totes == null)) throw new Error('not a Mothball import');
  const puts = [], mine = {}, res = { added: 0, filled: 0, kept: 0, gone: 0, skipped: [] }, offer = [];
  for (const [coll, list] of [['builds', data.builds], ['totes', data.totes]]) {
    if (list == null) continue;
    if (!Array.isArray(list)) throw new Error('not a Mothball import');
    for (const d of list) {
      const c = checkImport(coll, d);
      if (c.why) { res.skipped.push(c.why); continue; }
      const id = c.rec.id, key = coll + '/' + id;
      if (gone(coll, id) && !mine[key]) {
        if (back && typeof c.rec.name === 'string' && c.rec.name.trim() && !refusal(c.rec) && !offer.some(([k, d]) => k === coll && d.id === id)) offer.push([coll, c.rec]); else res.gone++;
        continue;
      }
      const was = mine[key] || here(coll, id);
      const { doc, filled, kept } = was ? fillIn(was, c.rec) : { doc: c.rec, filled: [], kept: [] };
      if (typeof doc.name !== 'string' || !doc.name.trim()) { res.skipped.push(`"${id}" (no name)`); continue; }
      if (refusal(doc)) { res.skipped.push(`"${id}" (too big to save)`); continue; }
      if (!was) res.added++; else if (filled.length && !mine[key]) res.filled++;
      if (kept.length && !mine[key]) res.kept++;
      if (!was || filled.length) { mine[key] = doc; puts.push([coll, doc]); }
    }
  }
  return { puts, res, back: offer };
}
