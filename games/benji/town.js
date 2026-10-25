// Benji's Town: the town and its jobs. (No DOM: tested in Node.)
//
// The town is a 13 x 13 grid of tiles: three streets each way, three tiles
// apart (room to queue between the corners), each running on two tiles past
// its last corner to a turning circle at the edge of town; and between them
// blocks of places -- houses, the post office, the dump, the builders'
// yard, the park and lots to build on. Every place has a door on a street.
// Helpers (the garbage truck, the postal worker's van, a dog walker, the cement mixer)
// drive or walk along the streets to do the level's jobs.

export const SIZE = 13;
export const ROADS = [2, 6, 10]; // the rows and columns that are streets

export const isRoad = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && (ROADS.includes(x) || ROADS.includes(y));

// The end of a street past its last corner, out to the turning circle at
// the edge of town (only for going to a door there): which one ('n2' -- the
// north end of the street at x = 2 -- and so on), or null.
export function stubOf(x, y) {
  const [lo, hi] = [ROADS[0], ROADS[ROADS.length - 1]];
  if (ROADS.includes(x) && (y < lo || y > hi)) return `${y < lo ? 'n' : 's'}${x}`;
  if (ROADS.includes(y) && (x < lo || x > hi)) return `${x < lo ? 'w' : 'e'}${y}`;
  return null;
}

// The places, by tile, each with its door: the street tile next to it.
const PLACES = [
  { id: 'post', kind: 'post', x: 3, y: 1 },
  { id: 'dump', kind: 'dump', x: 11, y: 11 },
  { id: 'yard', kind: 'yard', x: 1, y: 11 },
  { id: 'park', kind: 'park', x: 7, y: 7, w: 2, h: 2 },
  { id: 'h1', kind: 'home', x: 1, y: 1, color: '#ff6b6b' },
  { id: 'h2', kind: 'home', x: 7, y: 1, color: '#ffd166' },
  { id: 'h3', kind: 'home', x: 11, y: 3, color: '#4cc9f0' },
  { id: 'h4', kind: 'home', x: 3, y: 5, color: '#b388ff' },
  { id: 'h5', kind: 'home', x: 5, y: 3, color: '#06d6a0' },
  { id: 'h6', kind: 'home', x: 1, y: 7, color: '#f78c6b' },
  { id: 'h7', kind: 'home', x: 5, y: 11, color: '#ff8fab' },
  { id: 'h8', kind: 'home', x: 11, y: 7, color: '#ffd166' },
  { id: 'h9', kind: 'home', x: 9, y: 9, color: '#a0c4ff' },
  { id: 'h10', kind: 'home', x: 3, y: 3, color: '#ffadad' },
  { id: 'shop', kind: 'shop', x: 9, y: 3 },
  { id: 'cafe', kind: 'cafe', x: 3, y: 9 },
  // Lots to build on: each becomes a house, in turn, as the town grows.
  { id: 'lot1', kind: 'lot', x: 5, y: 7, color: '#90be6d' },
  { id: 'lot2', kind: 'lot', x: 7, y: 11, color: '#f9c74f' },
  { id: 'lot3', kind: 'lot', x: 11, y: 1, color: '#577590' },
  { id: 'lot4', kind: 'lot', x: 9, y: 5, color: '#f3722c' },
];
export const LOTS = PLACES.filter((p) => p.kind === 'lot').map((p) => p.id);

// The street tiles beside a place (along any side of it): pull up at any
// of them and you're there. The first is its door (where its path and the
// bin are, and where helpers head for).
function doorsOf(p) {
  const w = p.w || 1;
  const h = p.h || 1;
  const out = [];
  for (let x = p.x - 1; x <= p.x + w; x++) {
    for (let y = p.y - 1; y <= p.y + h; y++) {
      const side = (x === p.x - 1 || x === p.x + w) !== (y === p.y - 1 || y === p.y + h);
      if (side && isRoad(x, y)) out.push({ x, y });
    }
  }
  if (!out.length) throw new Error(`no street beside ${p.id}`);
  return out;
}

// The shortest way along the streets from one street tile to another: the
// tiles in order (both ends included) -- not through any tile in avoid (keys
// "x,y"). No way there: just [to].
export function route(from, to, avoid = null) {
  const key = (t) => t.y * SIZE + t.x;
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const t = queue.shift();
    if (t.x === to.x && t.y === to.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: t.x + dx, y: t.y + dy };
      if (!isRoad(n.x, n.y) || prev.has(key(n)) || avoid?.has(`${n.x},${n.y}`)) continue;
      prev.set(key(n), t);
      queue.push(n);
    }
  }
  const path = [];
  for (let t = to; t; t = prev.get(key(t))) path.unshift(t);
  return path;
}

// The shortest way for a car in street tile from, facing dir, to drive to
// another: on along the street, turning only at intersections (and round
// at a dead end) -- no turning round in the middle of the street. The
// tiles in order (both ends included). (Round the turning circle at the end
// of a street; but not down the end of a street unless it's going there.)
export function drivePath(from, dir, to) {
  const junction = (x, y) => isRoad(x + 1, y) && isRoad(x - 1, y) && isRoad(x, y + 1) && isRoad(x, y - 1);
  const key = (t, d) => `${t.x},${t.y},${d.x},${d.y}`;
  const start = { t: from, d: dir, prev: null };
  const seen = new Set([key(from, dir)]);
  const queue = [start];
  while (queue.length) {
    const s = queue.shift();
    if (s.t.x === to.x && s.t.y === to.y) {
      const path = [];
      for (let q = s; q; q = q.prev) path.unshift(q.t);
      return path;
    }
    const ways = [];
    const { x, y } = s.d;
    if (junction(s.t.x, s.t.y)) ways.push(s.d, { x: y, y: -x }, { x: -y, y: x });
    else ways.push(isRoad(s.t.x + x, s.t.y + y) ? s.d : { x: -x, y: -y });
    for (const d of ways) {
      const t = { x: s.t.x + d.x, y: s.t.y + d.y };
      if (!isRoad(t.x, t.y) || seen.has(key(t, d))) continue;
      const stub = stubOf(t.x, t.y);
      if (stub && stub !== stubOf(s.t.x, s.t.y) && stub !== stubOf(to.x, to.y)) continue;
      seen.add(key(t, d));
      queue.push({ t, d, prev: s });
    }
  }
  return route(from, to);
}

// The street tile nearest a point (in tiles).
export function nearestRoad(px, py) {
  let best = null;
  let bd = Infinity;
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      if (!isRoad(x, y)) continue;
      const d = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
      if (d < bd) [bd, best] = [d, { x, y }];
    }
  }
  return best;
}

// -------------------------------------------------------------------- days

// The town goes on from day to day -- no levels: each day has jobs in the
// morning, at midday and in the evening (then night falls, and it's the
// next morning), a few more as the days go by, and houses built stay
// built. Each part of the day: some jobs, by helper --
//   garbage: bins out at that many houses -- collect them, then to the dump
//   mail:    that many letters and packages to deliver (every other one a
//            package)
//   dog:     a walk to the park and home
//   build:   a house to build on the next lot (three trips)
// -- and from day 4, on the days marked drive, you drive them yourself, from
// the driver's seat (tapping, they go by themselves).
export const PARTS = ['morning', 'midday', 'evening'];
const DAYS = [
  { morning: { garbage: 2 }, evening: { dog: 1 } },
  { morning: { mail: 3 }, midday: { build: 1 } },
  { morning: { garbage: 3 }, midday: { mail: 2 }, evening: { dog: 1 } },
  { morning: { garbage: 2 }, midday: { build: 1 }, evening: { dog: 1 }, drive: true },
  { morning: { garbage: 3, mail: 2 }, midday: { mail: 2 }, evening: { dog: 1 } },
  { morning: { mail: 3 }, midday: { build: 1 }, evening: { dog: 1 }, drive: true },
];
export function dayPlan(day) {
  if (day <= DAYS.length) return DAYS[day - 1];
  // After those, a bit of everything -- driving every other day.
  const k = day - DAYS.length;
  return {
    morning: { garbage: 2 + (k % 2), mail: 2 + ((k >> 1) % 2) },
    midday: k % 3 === 0 ? { build: 1 } : { mail: 2 },
    evening: { dog: 1 },
    drive: k % 2 === 1,
  };
}

// Houses built before day n (the town grows as you build).
export function builtBefore(n) {
  let b = 0;
  for (let k = 1; k < n; k++) for (const part of PARTS) b += dayPlan(k)[part]?.build || 0;
  return Math.min(LOTS.length, b);
}

// A little pseudo-random sequence, the same every time for a day.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// The town on day n: its places (lots already built are homes), the
// helpers out that day, and the parts of the day with jobs: [{ part, jobs }]
// (jobs: the first part's, to begin with).
export function makeTown(n) {
  const plan = dayPlan(n);
  const r = rng(n * 7919 + 17);
  let built = builtBefore(n);
  const places = PLACES.map((p) => {
    const doors = doorsOf(p);
    const q = { ...p, door: doors[0], doors };
    if (p.kind === 'lot' && LOTS.indexOf(p.id) < built) q.kind = 'home';
    return q;
  });
  const by = (id) => places.find((p) => p.id === id);
  const homes = places.filter((p) => p.kind === 'home');
  const pick = (list, k) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  };
  const helpers = [];
  const helper = (h) => helpers.some((o) => o.id === h.id) || helpers.push(h);
  const walker = pick(homes, 1)[0];
  const phases = [];
  for (const part of PARTS) {
    if (!plan[part]) continue;
    // (Every house built: letters to take instead.)
    const p = plan[part].build && !LOTS[built] ? { mail: 2 } : plan[part];
    const jobs = [];
    if (p.garbage) {
      helper({ id: 'garbage', kind: 'garbage', at: by('dump').door, home: 'dump' });
      for (const h of pick(homes, p.garbage)) jobs.push({ helper: 'garbage', kind: 'bin', place: h.id });
      jobs.push({ helper: 'garbage', kind: 'dump', place: 'dump', last: true });
    }
    if (p.mail) {
      helper({ id: 'mail', kind: 'mail', at: by('post').door, home: 'post' });
      pick(homes, p.mail).forEach((h, k) => jobs.push({ helper: 'mail', kind: k % 2 ? 'parcel' : 'letter', place: h.id }));
    }
    if (p.dog) {
      helper({ id: 'dog0', kind: 'walker', at: walker.door, home: walker.id, color: walker.color });
      jobs.push({ helper: 'dog0', kind: 'walk', place: 'park' }, { helper: 'dog0', kind: 'home', place: walker.id, last: true });
    }
    if (p.build && LOTS[built]) {
      helper({ id: 'mixer', kind: 'mixer', at: by('yard').door, home: 'yard' });
      for (let s = 1; s <= 3; s++) jobs.push({ helper: 'mixer', kind: 'build', place: LOTS[built], stage: s });
      built++;
    }
    if (!jobs.length) continue;
    jobs.forEach((j, i) => (j.i = i));
    phases.push({ part, jobs });
  }
  return { n, day: n, plan, drive: !!plan.drive, places, helpers, phases, jobs: phases[0].jobs };
}

// A helper's next job: the first not done (in order; bins nearest first is
// the player's choice, so any bin will do -- see jobAt).
export const nextJob = (town, helper, done) => town.jobs.find((j) => j.helper === helper.id && !done.has(j.i)
  && !(j.last && town.jobs.some((o) => o.helper === helper.id && !o.last && !done.has(o.i))));

// The job a helper can do at a street tile, if any: one of its own, not
// done, whose place's door is that tile (a "last" job only once the rest
// are done; building stages in order).
export function jobAt(town, helper, tile, done) {
  const mine = town.jobs.filter((j) => j.helper === helper.id && !done.has(j.i));
  const rest = mine.filter((j) => !j.last);
  for (const j of mine) {
    if (j.last && rest.length) continue;
    if (j.kind === 'build' && mine.some((o) => o.kind === 'build' && o.place === j.place && o.stage < j.stage)) continue;
    if (j.kind === 'home' && mine.some((o) => o.kind === 'walk')) continue;
    const { doors } = town.places.find((p) => p.id === j.place);
    if (doors.some((d) => d.x === tile.x && d.y === tile.y)) return j;
  }
  return null;
}
