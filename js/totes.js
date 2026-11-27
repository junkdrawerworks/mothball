// A tote's state and the home page's notice, from its records. No DOM here, so it is unit-tested.
import { SEASONS, seasonName, monthsUntil } from './sample.js';

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
