// Made-up totes and builds for the sample mode, and the season calendar.
export const SEASONS = [
  ['halloween', 'Halloween', 10], ['thanksgiving', 'Thanksgiving', 11], ['christmas', 'Christmas', 12],
  ['winter', 'Winter', 1], ['spring', 'Spring', 4], ['summer', 'Summer', 6], ['other', 'Any time', 0],
];
export const seasonName = k => (SEASONS.find(s => s[0] === k) || SEASONS[6])[1];

// Months until a season's month comes round again (0 = it's that month now).
export function monthsUntil(key, now = new Date()) {
  const s = SEASONS.find(x => x[0] === key);
  if (!s || !s[2]) return 99;
  return (s[2] - 1 - now.getMonth() + 12) % 12;
}

export const SAMPLE = {
  'mothball.totes': [
    { id: '01', name: 'Animated hand and hanging skeleton', season: 'halloween', place: 'Garage, top shelf, left', packed: '2026-11-02',
      items: ['Skeleton hand in its base box', '5 V 3 A supply and barrel lead', 'Hanging skeleton, 15 bones on rings', 'Spare jump rings (bag)'],
      builds: ['skeleton-hand', 'hanging-skeleton'],
      note: 'The ring finger tendon frayed in week two. Bring spare braided line and a new knot.' },
    { id: '02', name: 'Skating rink', season: 'christmas', place: 'Garage, top shelf, middle', packed: '2026-01-04',
      items: ['Rink base with mirror ice', 'Six skaters in the egg carton', 'USB-C supply', 'Microfiber cloth'],
      builds: ['skating-rink'], note: '' },
  ],
  'mothball.builds': [
    { id: 'skeleton-hand', name: 'Animated skeleton hand', season: 'halloween',
      power: '5 V 3 A supply into the servo board\'s screw terminal. Never USB at the same time.',
      firmware: 'v1.2', code: 'skeleton-hand folder, firmware/hand', wifi: 'None. It runs on its own.',
      bringup: 'Plug in the 5 V supply, then the board.\nWait for the wave: it means calibration loaded.\nIf a finger doesn\'t close, run the calibration over serial (115200).',
      packing: 'Fingers open. Wrap the hand in the foam sleeve. Supply in the zip bag taped to the box.',
      quirks: 'The radar sees you at the bench: type auto off to stop it gesturing.' },
    { id: 'hanging-skeleton', name: 'Hanging skeleton', season: 'halloween', power: 'None',
      bringup: 'Hang from the head ring.\nCheck every ring is closed: pliers in the bag.', packing: 'Lay flat, ribcage on top, in the bubble wrap.' },
    { id: 'skating-rink', name: 'Skating rink', season: 'christmas', power: 'USB-C, 5 V 2 A, socket in the middle of the back.',
      firmware: 'v1.0', wifi: 'None.', bringup: 'Wipe the ice.\nSet the skaters on the marks, magnets down.\nPower on: the lights fade up, then the skaters move.',
      packing: 'Skaters off the ice and into the carton, or the magnets pull them together.' },
  ],
};
