// Benji's Town: the town and its jobs. (No DOM: tested in Node.)
//
// The town is a 17 x 17 grid of tiles: four streets each way, three tiles
// apart (room to queue between the corners), each running on two tiles past
// its last corner to a turning circle at the edge of town; and between them
// blocks of places -- houses, the post office, the dump, the builders'
// yard, the firehouse, the police station (with its jail), the school, the
// bank, the shop, the café, the park and lots to build on. Every place has
// a door on a street. Helpers (the garbage truck, the postal worker's van, a
// dog walker, the cement mixer, the school bus, the money truck, the fire
// engine, the police car) drive or walk along the streets to do the day's
// jobs.

export const SIZE = 17;
export const ROADS = [2, 6, 10, 14]; // the rows and columns that are streets

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

// The places, by tile, each with its door: the street tile next to it --
// or, for a place whose truck parks there (stub), the one at the end of a
// street past its last corner, out of the traffic.
const PLACES = [
  { id: 'post', kind: 'post', x: 3, y: 1 },
  { id: 'dump', kind: 'dump', x: 15, y: 11, stub: true },
  { id: 'yard', kind: 'yard', x: 1, y: 11 },
  { id: 'park', kind: 'park', x: 7, y: 7, w: 2, h: 2 },
  { id: 'fire', kind: 'firehouse', x: 5, y: 1 },
  { id: 'police', kind: 'police', x: 15, y: 7, stub: true },
  { id: 'school', kind: 'school', x: 12, y: 15, w: 2, h: 2, stub: true },
  { id: 'bank', kind: 'bank', x: 15, y: 3, stub: true },
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
  { id: 'h11', kind: 'home', x: 11, y: 9, color: '#caffbf' },
  { id: 'h12', kind: 'home', x: 11, y: 13, color: '#ffc6ff' },
  { id: 'h13', kind: 'home', x: 13, y: 7, color: '#9bf6ff' },
  { id: 'h14', kind: 'home', x: 3, y: 13, color: '#fdffb6' },
  { id: 'h15', kind: 'home', x: 7, y: 15, color: '#ff9b85' },
  { id: 'h16', kind: 'home', x: 9, y: 11, color: '#bdb2ff' },
  { id: 'h17', kind: 'home', x: 15, y: 13, color: '#ffd6a5' },
  { id: 'h18', kind: 'home', x: 1, y: 15, color: '#a8dadc' },
  { id: 'shop', kind: 'shop', x: 9, y: 3 },
  { id: 'cafe', kind: 'cafe', x: 3, y: 9 },
  // Lots to build on: each becomes a house, in turn, as the town grows.
  { id: 'lot1', kind: 'lot', x: 5, y: 7, color: '#90be6d' },
  { id: 'lot2', kind: 'lot', x: 7, y: 11, color: '#f9c74f' },
  { id: 'lot3', kind: 'lot', x: 11, y: 1, color: '#577590' },
  { id: 'lot4', kind: 'lot', x: 9, y: 5, color: '#f3722c' },
  { id: 'lot5', kind: 'lot', x: 13, y: 11, color: '#43aa8b' },
  { id: 'lot6', kind: 'lot', x: 5, y: 15, color: '#f94144' },
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
//   garbage: bins out at that many houses -- every other one recycling --
//            to pick up, in any order, and take to the dump
//   mail:    that many letters and packages to deliver (every other one a
//            package)
//   dog:     a walk to the park and home
//   build:   a house to build on the next lot (three trips)
//   bus:     that many children to pick up from their houses, in any
//            order, and take to school
//   money:   that many shops (the shop, the café, the post office) with
//            money to collect, in any order, and take to the bank
// And once a day, a little while into one part of it, a fire breaks out at
// a house: the fire engine to the rescue (play.js lights it, and adds the
// job). In another part of the day, a robber turns up at the shop, the
// café or the bank: the police car to catch them and take them to jail. (Whether you
// drive them yourself or watch them go is yours to choose.)
export const PARTS = ['morning', 'midday', 'evening'];
const DAYS = [
  { morning: { garbage: 2 }, evening: { dog: 1 } },
  { morning: { mail: 3 }, midday: { build: 1 } },
  { morning: { garbage: 2, bus: 2 }, midday: { mail: 2 }, evening: { dog: 1 } },
  { morning: { garbage: 2 }, midday: { build: 1, money: 2 }, evening: { dog: 1 } },
  { morning: { garbage: 3, mail: 2 }, midday: { mail: 2 }, evening: { dog: 1 } },
  { morning: { mail: 3 }, midday: { build: 1 }, evening: { dog: 1 } },
];
export function dayPlan(day) {
  if (day <= DAYS.length) return DAYS[day - 1];
  // After those, a bit of everything.
  const k = day - DAYS.length;
  return {
    morning: { garbage: 2 + (k % 2), bus: 2 + ((k >> 1) % 2) },
    midday: k % 3 === 0 ? { build: 1, money: 2 } : { mail: 2 + ((k >> 1) % 2), money: 2 + (k % 2) },
    evening: { dog: 1 },
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
    let doors = doorsOf(p);
    // (Its truck parks down the end of the street, out of the traffic: that
    // door first.)
    if (p.stub) doors = [...doors.filter((d) => stubOf(d.x, d.y)), ...doors.filter((d) => !stubOf(d.x, d.y))];
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
      pick(homes, p.garbage).forEach((h, k) => jobs.push({ helper: 'garbage', kind: k % 2 ? 'recycle' : 'bin', place: h.id }));
      jobs.push({ helper: 'garbage', kind: 'dump', place: 'dump' });
    }
    if (p.mail) {
      helper({ id: 'mail', kind: 'mail', at: by('post').door, home: 'post' });
      pick(homes, p.mail).forEach((h, k) => jobs.push({ helper: 'mail', kind: k % 2 ? 'parcel' : 'letter', place: h.id }));
    }
    if (p.bus) {
      helper({ id: 'bus', kind: 'bus', at: by('school').door, home: 'school' });
      pick(homes, p.bus).forEach((h) => jobs.push({ helper: 'bus', kind: 'kid', place: h.id }));
      jobs.push({ helper: 'bus', kind: 'school', place: 'school' });
    }
    if (p.money) {
      helper({ id: 'money', kind: 'money', at: by('bank').door, home: 'bank' });
      pick(['shop', 'cafe', 'post'], p.money).forEach((id) => jobs.push({ helper: 'money', kind: 'cash', place: id }));
      jobs.push({ helper: 'money', kind: 'bank', place: 'bank' });
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
  // (The fire engine's always at the firehouse, ready -- parked down the
  // end of the street beside it, like the other trucks, out of the way.)
  const station = by('fire');
  helper({ id: 'fire', kind: 'fire', at: station.doors.find((d) => stubOf(d.x, d.y)) || station.door, home: 'fire' });
  // The day's fire: in which part, at which house, how many seconds in.
  const fire = phases[Math.floor(r() * phases.length)];
  fire.fire = { place: pick(homes, 1)[0].id, after: 8 + r() * 8 };
  // (The police car waits at the police station, as the fire engine does.)
  const police = by('police');
  helper({ id: 'police', kind: 'police', at: police.doors.find((d) => stubOf(d.x, d.y)) || police.door, home: 'police' });
  // The day's robbery: in another part of the day (if there is one), at the
  // shop or the café.
  const others = phases.filter((q) => q !== fire);
  const rob = others.length ? others[Math.floor(r() * others.length)] : fire;
  rob.rob = { place: ['shop', 'cafe', 'bank'][Math.floor(r() * 3)], after: 8 + r() * 8 };
  return { n, day: n, plan, places, helpers, phases, jobs: phases[0].jobs };
}

// Picked up along the way, in any order (a bin, a child, money), and then
// dropped off all together: kind -> where it goes.
export const COLLECT = { bin: 'dump', recycle: 'dump', kid: 'school', cash: 'bank' };
export const DROP = new Set(Object.values(COLLECT));

// Can a helper do this job now (wherever it is)? Its own, not done: any
// bin, child, money, letter or parcel in any order (and the dump, the
// school, the bank whenever there's something on board -- see play.js); but home from the park only after the
// walk, and a house's stages in order.
export function canDo(town, helper, job, done) {
  if (job.helper !== helper.id || done.has(job.i)) return false;
  const mine = town.jobs.filter((j) => j.helper === helper.id && !done.has(j.i));
  if (job.last && mine.some((o) => !o.last)) return false;
  if (job.kind === 'build' && mine.some((o) => o.kind === 'build' && o.place === job.place && o.stage < job.stage)) return false;
  if (job.kind === 'home' && mine.some((o) => o.kind === 'walk')) return false;
  return true;
}

// A helper's next job, unless you choose another: the first it can do (bins
// before the dump, the walk before home, a house from the ground up).
export const nextJob = (town, helper, done) => town.jobs.find((j) => canDo(town, helper, j, done)) || null;

// The job a helper can do at a street tile, if any: one it can do now,
// whose place is beside that tile.
export function jobAt(town, helper, tile, done) {
  for (const j of town.jobs) {
    if (!canDo(town, helper, j, done)) continue;
    const { doors } = town.places.find((p) => p.id === j.place);
    if (doors.some((d) => d.x === tile.x && d.y === tile.y)) return j;
  }
  return null;
}
