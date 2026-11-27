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
    { id: '01', name: 'Pumpkins and the porch web', season: 'halloween', place: 'Basement, rack by the door, top', packed: '2026-11-02',
      items: ['Three foam pumpkins with LED candles', 'AA batteries (bag of 12) and the remote', 'Porch spider web and four stakes', 'Big spider and two small ones'],
      builds: ['pumpkins', 'porch-web'],
      note: 'The middle pumpkin\'s candle stopped flickering in week two. Buy a spare LED candle before October.' },
    { id: '02', name: 'Porch train', season: 'christmas', place: 'Basement, rack by the door, middle', packed: '2026-01-04',
      items: ['Track pieces in the long box', 'Engine and three cars in the cloth', 'USB-C supply', 'Window snowflakes (pack of 12)'],
      builds: ['porch-train'], note: '' },
  ],
  'mothball.builds': [
    { id: 'pumpkins', name: 'Light-up pumpkins', season: 'halloween',
      power: 'Three AA batteries in each candle. A set lasts about two weeks at six hours a night.',
      firmware: 'v1.1', code: 'pumpkins folder, firmware/candle', wifi: 'None. The remote runs them.',
      bringup: 'Fresh batteries in each candle, flat end to the spring.\nPress TIMER on the remote at dusk: they stay on six hours a day.\nIf one stays dark, press the button under its candle once.',
      packing: 'Batteries out, or they leak over the summer. Candles in the egg carton, pumpkins nested.',
      quirks: 'ON on the remote also restarts the six-hour timer.' },
    { id: 'porch-web', name: 'Porch spider web', season: 'halloween', power: 'None',
      bringup: 'Stake the four corners into the lawn.\nHook the top edge over the porch rail.', packing: 'Fold the web in four round the stakes so it doesn\'t tangle.' },
    { id: 'porch-train', name: 'Porch train', season: 'christmas', power: 'USB-C, 5 V 2 A, into the back of the station.',
      firmware: 'v2.0', wifi: 'Runs on a schedule from the house Wi-Fi. Hold the station button 5 s for its setup network.',
      bringup: 'Lay the track in a loop and push each join home.\nSet the engine and cars on the rails.\nPower the station: its lights come on, then the train sets off.',
      packing: 'Engine and cars in the cloth. Track in the long box, never loose in the tote.' },
  ],
};
