// Benji's Town: the time of day. (No DOM: tested in Node.)
//
// The clock goes round from 0 (dawn) to 1 (the end of the night). Each part
// of the day with jobs has its time: the clock goes at an easy pace while
// you're on them, and waits at the end of that time till they're done --
// nobody's ever late. With nothing to do, it goes on quickly to the next
// part: through the evening, the night and the dawn of the next day.

export const DAY = 240; // seconds a whole day would take, at an easy pace
export const QUICK = 40; // ... and with nothing to do
export const WINDOW = { morning: [0.06, 0.3], midday: [0.3, 0.54], evening: [0.54, 0.72] };
export const NIGHT = 0.76; // night falls: everyone home to bed

// The clock dt seconds on: busy with a part's jobs (part, not done yet), or
// not.
export function tick(t, dt, part = null, done = true) {
  if (part && !done) return Math.min(WINDOW[part][1], t + dt / DAY);
  return t + dt / QUICK;
}

// What part of the day it is at t: 'dawn', 'morning', 'midday', 'evening'
// or 'night'.
export function partAt(t) {
  if (t >= NIGHT) return 'night';
  for (const [part, [a, b]] of Object.entries(WINDOW)) if (t >= a && t < b) return part;
  return t < WINDOW.morning[0] ? 'dawn' : 'evening';
}

// How light it is at t (bright: 0 at night, 1 in the day) and how warm (the
// gold of sunrise and sunset), between these points.
const KEYS = [
  [0, 0.3, 0.8], [0.06, 0.75, 0.5], [0.12, 1, 0], [0.6, 1, 0], [0.7, 0.75, 1],
  [0.76, 0.3, 0.4], [0.82, 0.08, 0], [0.96, 0.08, 0], [1, 0.3, 0.8],
];
export function light(t) {
  t = ((t % 1) + 1) % 1;
  const k = KEYS.findIndex((q) => q[0] > t);
  const [a, b] = [KEYS[k - 1], KEYS[k]];
  const u = (t - a[0]) / (b[0] - a[0]);
  return { bright: a[1] + (b[1] - a[1]) * u, warm: a[2] + (b[2] - a[2]) * u };
}

// The sky at t: [top, bottom] colours -- blue by day, gold at sunrise and
// sunset, deep blue at night.
const mix = (p, q, u) => p.map((v, i) => v + (q[i] - v) * u);
const css = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
const SKY = {
  day: [[169, 220, 255], [228, 246, 255]],
  warm: [[255, 158, 122], [255, 216, 168]],
  night: [[11, 16, 51], [42, 53, 102]],
};
export function sky(t) {
  const { bright, warm } = light(t);
  return [0, 1].map((i) => css(mix(mix(SKY.night[i], SKY.day[i], bright), SKY.warm[i], warm * 0.8)));
}

// Where the sun (or, at night, the moon) is across the sky: u from 0 (just
// up, on the left) to 1 (setting, on the right) -- null when it's down.
export function sunAt(t) {
  const [up, down] = [0.02, 0.78];
  return t >= up && t <= down ? { sun: true, u: (t - up) / (down - up) } : { sun: false, u: (((t - down + 1) % 1)) / (1 - down + up) };
}
