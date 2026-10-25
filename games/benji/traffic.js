// Benji's Town: the traffic. Cars (and the helpers' trucks) keep to the
// right-hand lane, stop at the line on a red light, wait for anyone on the
// crosswalk they're about to drive over, and queue behind each other; where
// there are no lights, they go through one at a time, and where there are,
// nobody turns across anyone else. No car ever drives into another: held up
// behind one that's parked, it waits (a helper with nothing to do gets out
// of the way). People keep to the
// sidewalks and cross only at the crosswalks, when the walk signal shows
// (where there is one) -- and never while a car is going over it. (No DOM:
// tested in Node.)
//
// Cars: { x, y, tile, dir, path (street tiles), len (half its length) };
// people: { x, y, node, path (sidewalk points) }. drive() and walk() move one
// along, and say where it has just got to.
import { isRoad, stubOf } from './town.js';
import { isJunction, isLit, runsNS, atEdge, hasCrossing, armOf, zebra, mayDrive, mayWalk, crossingOf, circleAt, CIRCLE } from './streets.js';

export const LANE = 0.2; // a lane's middle, off the street's middle
// Where a car stops for the lights: its middle, back from the intersection
// -- clear of the crosswalk. (Along a street, every tile's stopping place
// is here, so a car parked at a door isn't on a crosswalk either.)
export const STOP = { ew: 0.86, ns: 0.84 };
const GAP = 0.16; // between cars in a queue, bumper to bumper
const HALF_W = 0.15; // half a car's width (wheels and all)
const PAD = 0.015; // room kept round a car, as it goes

// A car's body, as drawn: a box round (x, y) turned to heading a -- len (half
// its length: a car's 0.29, a truck's 0.38) along, HALF_W across.
export function body(c, x = c.x, y = c.y, a = headOf(c), pad = 0) {
  return { x, y, c: Math.cos(a), s: Math.sin(a), l: (c.len || 0.38) + pad, w: HALF_W + pad };
}
const headOf = (c) => c.head ?? Math.atan2(c.dir.y, c.dir.x);

// Do two bodies overlap? (Looking along each one's sides for a gap.)
export function bump(a, b) {
  for (const [ux, uy] of [[a.c, a.s], [-a.s, a.c], [b.c, b.s], [-b.s, b.c]]) {
    const r = (q) => Math.abs(q.l * (q.c * ux + q.s * uy)) + Math.abs(q.w * (q.c * uy - q.s * ux));
    if (Math.abs((b.x - a.x) * ux + (b.y - a.y) * uy) >= r(a) + r(b)) return false;
  }
  return true;
}

// Where a car is, as a box square to the streets: [x0, y0, x1, y1].
export function footprint(c) {
  const b = body(c);
  const ex = Math.abs(b.l * b.c) + Math.abs(b.w * b.s);
  const ey = Math.abs(b.l * b.s) + Math.abs(b.w * b.c);
  return [c.x - ex, c.y - ey, c.x + ex, c.y + ey];
}

// Turning smoothly toward heading a (k of the way): a car turns to face the
// way it's going within TURN of going that way.
const TURN = 0.15;
const turnTo = (h, a, k) => h + Math.atan2(Math.sin(a - h), Math.cos(a - h)) * k;

// At a lit intersection, two cars can go through together if they came in
// the same way, or from opposite ways both going straight on (a truck
// turning swings wide). arms: [the arm in, the arm out].
const OPPOSITE = { n: 's', s: 'n', w: 'e', e: 'w' };
const clash = (a, b) => a[0] !== b[0] && !(OPPOSITE[a[0]] === b[0] && a[1] === b[0] && b[1] === a[0]);

const dirOf = (a, b) => ({ x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) });
const same = (a, b) => a.x === b.x && a.y === b.y;

// The intersection a street tile leads into (each one leads into one).
function junctionBy(t) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isJunction(t.x + dx, t.y + dy)) return { x: t.x + dx, y: t.y + dy };
  return null;
}

// Where a car is in street tile t, going d: in the right-hand lane; in the
// middle of an intersection (or a dead end at the edge of town with no
// crosswalk), and elsewhere at the stopping place before (or after) the
// intersection. Turning in an intersection (to go e next), where the lane in
// meets the lane out: round the corner, and out along its lane.
export function lanePoint(t, d, e = null) {
  const p = { x: t.x + 0.5 - d.y * LANE, y: t.y + 0.5 + d.x * LANE };
  if (e && isJunction(t.x, t.y) && (e.x ? !d.x : !d.y)) {
    if (e.x) p.y = t.y + 0.5 + e.x * LANE;
    else p.x = t.x + 0.5 - e.y * LANE;
    return p;
  }
  const j = !isJunction(t.x, t.y) && hasCrossing(t.x, t.y) && junctionBy(t);
  if (!j) return p;
  if (runsNS(t.x, t.y)) p.y = j.y > t.y ? j.y - STOP.ns : j.y + 1 + STOP.ns;
  else p.x = j.x > t.x ? j.x - STOP.ew : j.x + 1 + STOP.ew;
  return p;
}

// The way round the turning circle at the end of a street (edge tile t,
// coming in going d): points out from the lane, round the island (on the
// left), and back into the other lane.
function roundPoints(t, d) {
  const o = circleAt(t, d);
  const R = CIRCLE.ring;
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / 12;
    pts.push({ x: o.x + d.x * R * Math.cos(a) + d.y * R * Math.sin(a), y: o.y + d.y * R * Math.cos(a) - d.x * R * Math.sin(a) });
  }
  // (And back into the lane, straight.)
  for (const [back, side] of [[0.35, 0.24], [0.6, LANE]]) pts.push({ x: o.x - d.x * back + d.y * side, y: o.y - d.y * back - d.x * side });
  return pts;
}

// Which way a car parked in street tile t faces, to begin with: toward the
// intersection it's by (into town, not off the edge of it).
export function startDir(t) {
  const j = junctionBy(t);
  if (j) return { x: Math.sign(j.x - t.x), y: Math.sign(j.y - t.y) };
  return runsNS(t.x, t.y) ? { x: 0, y: 1 } : { x: 1, y: 0 };
}

export class Traffic {
  // budge(car): a parked car is holding others up -- move it, if it can.
  constructor(ways, budge = null) {
    this.ways = ways;
    this.budge = budge;
    this.cars = [];
    this.people = [];
    this.t = 0;
  }

  // ------------------------------------------------------------- cars

  // One car along its way for dt seconds: the street tile it has just
  // reached, if any. (m.wait while it's held up: 'light' at a red light,
  // 'people' for someone on the crosswalk, 'turn' waiting its turn, 'car'
  // behind another -- m.blocker.) It turns smoothly to face the way it's
  // going (m.head).
  drive(m, speed, dt) {
    m.head ??= Math.atan2(m.dir.y, m.dir.x);
    m.blocker = null;
    if (!m.path.length) {
      m.wait = null;
      m.stuck = 0;
      return null;
    }
    const next = m.path[0];
    const d = same(next, m.tile) ? m.dir : dirOf(m.tile, next);
    // (Into the end of the street: round the turning circle, a point at a
    // time.)
    const end = !same(next, m.tile) && atEdge(next.x, next.y) ? `${next.x},${next.y}` : null;
    if (m.round?.key !== end) m.round = end && { key: end, pts: roundPoints(next, d), i: 0 };
    const goal = m.round ? m.round.pts[m.round.i] : lanePoint(next, d, m.path[1] && dirOf(next, m.path[1]));
    let dx = goal.x - m.x;
    let dy = goal.y - m.y;
    const dist = Math.hypot(dx, dy);
    // (Off its lane along a street -- turning round, say: back onto it, a
    // little way on, to go along it straight.)
    const along = dx * d.x + dy * d.y;
    const off = d.x ? m.y - goal.y : m.x - goal.x;
    const steer = !m.round && !isJunction(next.x, next.y) && !isJunction(m.tile.x, m.tile.y) && Math.abs(off) > 0.02 && along > 0.3;
    if (steer) [dx, dy] = d.x ? [0.3 * d.x, -off] : [-off, 0.3 * d.y];
    const reach = steer ? Math.hypot(dx, dy) : dist;
    let room = speed * dt;
    m.wait = null;
    const light = this.lightRoom(m);
    if (light.room < room) {
      room = light.room;
      m.wait = light.why;
      m.blocker = light.who || null;
    }
    if (reach > 1e-9) {
      const ahead = this.queueRoom(m, dx / reach, dy / reach);
      if (ahead.room < room) {
        room = ahead.room;
        m.wait = 'car';
        m.blocker = ahead.who;
      }
    }
    // Never into another car: as far as it can go, clear of them all.
    const step = Math.min(room, reach);
    let go = 0;
    if (step > 1e-9) {
      const a = Math.atan2(dy, dx);
      for (const u of [1, 0.5, 0.25]) {
        const hit = this.bumpInto(m, m.x + (dx / reach) * step * u, m.y + (dy / reach) * step * u, turnTo(m.head, a, Math.min(1, (step * u) / TURN)));
        if (!hit) {
          go = step * u;
          break;
        }
        m.blocker = hit;
      }
      if (go < step) m.wait = 'car';
    }
    // Held up behind a car that's parked: pull up here if this is where it
    // was going, or after a moment ask it to move.
    if (m.wait === 'car' && go < 1e-3) {
      m.stuck = (m.stuck || 0) + dt;
      if (m.stuck > (m.patience || 2) && this.parked(m)) {
        m.stuck = 0;
        return this.unstick(m, dist);
      }
    } else m.stuck = 0;
    if (go > 1e-3) m.movedAt = this.t;
    if (go > 1e-9) m.head = turnTo(m.head, Math.atan2(dy, dx), Math.min(1, go / TURN));
    if (Math.abs(dx) > 0.02 && go > 0) m.face = Math.sign(dx);
    if (!steer && dist - go < 1e-9 && go === step) {
      const from = m.tile;
      m.x = goal.x;
      m.y = goal.y;
      if (m.round && m.round.i < m.round.pts.length - 1) {
        m.round.i++;
        return null;
      }
      m.round = null;
      m.tile = next;
      m.dir = end ? { x: -d.x, y: -d.y } : d;
      m.path.shift();
      if (isJunction(from.x, from.y) && !isJunction(next.x, next.y)) m.pass = null;
      return next;
    }
    m.x += (dx / reach) * go;
    m.y += (dy / reach) * go;
    return null;
  }

  // The car m would run into, going on to (x, y) heading h -- one in front
  // of it it's not already touching -- if any.
  bumpInto(m, x, y, h) {
    const me = body(m, x, y, h, PAD);
    const now = body(m, m.x, m.y, m.head, PAD);
    return this.cars.find((o) => {
      if (o === m || (o.x - x) * Math.cos(h) + (o.y - y) * Math.sin(h) <= 0) return false;
      const them = body(o, o.x, o.y, headOf(o), PAD);
      return bump(me, them) && !bump(now, them);
    }) || null;
  }

  // Is what's holding m up a car that's parked, rather than a queue for the
  // lights, or for people crossing, or a car going through?
  parked(m) {
    const seen = new Set([m]);
    let why = 'car';
    for (let o = m.blocker; o; o = o.blocker) {
      if (seen.has(o)) return true;
      if (o.wait === 'light' || o.wait === 'people') return false;
      if (o.wait !== 'car' && o.wait !== 'turn') return why === 'car';
      why = o.wait;
      seen.add(o);
    }
    return why === 'car';
  }

  // Held up behind a parked car: there already (near enough -- pulled up
  // behind it), or ask it to move. The street tile it's reached, if that's
  // it.
  unstick(m, dist) {
    if (m.path.length === 1 && dist < 1.3) {
      const here = { x: Math.floor(m.x), y: Math.floor(m.y) };
      const there = m.path.shift();
      if (isRoad(here.x, here.y)) m.tile = here;
      return there;
    }
    // (The one at the front of the queue.)
    const seen = new Set([m]);
    let o = m.blocker;
    while (o.wait === 'car' && o.blocker && !seen.has(o.blocker)) {
      seen.add(o);
      o = o.blocker;
    }
    this.budge?.(o);
    return null;
  }

  // Is the way out of intersection j, onto street tile e, clear of cars
  // stopped there -- room to get out of the intersection? The car in the
  // way, if not.
  exitFor(m, j, e) {
    const u = dirOf(j, e);
    const lane = lanePoint(e, u);
    return this.cars.find((o) => {
      if (o === m || this.t - (o.movedAt ?? -1) < 0.3) return false;
      const rx = o.x - lane.x;
      const ry = o.y - lane.y;
      const along = rx * u.x + ry * u.y;
      return Math.abs(rx * u.y - ry * u.x) < 0.22 && along > -STOP.ew - 0.2 && along < (m.len || 0.38) + (o.len || 0.38) + GAP;
    }) || null;
  }

  // How far a car may go before the next intersection: to its stopping
  // place, unless it's let through -- on a green light, or (no lights) when
  // no one else is going through -- and the crosswalks it'll drive over are
  // clear. { room, why }
  lightRoom(m) {
    const go = { room: Infinity, why: null };
    // In an intersection, and someone's (just) stepped onto the crosswalk
    // on the way out -- or you've turned toward one they're on: wait for
    // them, short of it.
    const out = m.path[0];
    if (out && isJunction(m.tile.x, m.tile.y) && !same(out, m.tile) && this.peopleOn(m.tile, [armOf(m.tile, out)])) {
      const j = m.tile;
      const e = dirOf(j, out);
      const edge = e.x > 0 ? j.x + 1 - m.x : e.x < 0 ? m.x - j.x : e.y > 0 ? j.y + 1 - m.y : m.y - j.y;
      return { room: Math.max(0, edge - 0.32), why: 'people' };
    }
    let prev = m.tile;
    for (let k = 0; k < Math.min(2, m.path.length); k++) {
      const j = m.path[k];
      if (isJunction(j.x, j.y)) {
        const key = `${j.x},${j.y}`;
        if (same(prev, j) || m.pass === key) return go;
        const a = dirOf(prev, j);
        const axis = a.x ? 'ew' : 'ns';
        const edge = a.x > 0 ? j.x - m.x : a.x < 0 ? m.x - j.x - 1 : a.y > 0 ? j.y - m.y : m.y - j.y - 1;
        const room = edge - STOP[axis];
        if (room > 0.01) return { room, why: null };
        const exit = m.path[k + 1];
        const arms = [armOf(j, prev), ...(exit ? [armOf(j, exit)] : [])];
        const lit = isLit(j.x, j.y);
        if (lit && !mayDrive(j.x, j.y, axis, this.t)) return { room: Math.max(0, room), why: 'light' };
        if (this.peopleOn(j, arms)) return { room: Math.max(0, room), why: 'people' };
        const who = this.cars.find((o) => o !== m && this.through(o, key) && (!lit || clash(arms, o.passArms)));
        if (who) return { room: Math.max(0, room), why: 'turn', who };
        // (Not past anyone still waiting to go in ahead of it.)
        const first = this.cars.find((o) => {
          if (o === m || this.through(o, key)) return false;
          const along = (o.x - m.x) * a.x + (o.y - m.y) * a.y;
          return along > 0 && along < edge + 0.5 && Math.abs((o.x - m.x) * a.y - (o.y - m.y) * a.x) < 0.3;
        });
        if (first) return { room: Math.max(0, room), why: 'car', who: first };
        const stopped = exit && this.exitFor(m, j, exit);
        if (stopped) return { room: Math.max(0, room), why: 'car', who: stopped };
        m.pass = key;
        m.passArms = arms;
        return go;
      }
      prev = j;
    }
    return go;
  }

  // Is a car going through intersection key (let in, and not out yet)?
  through(c, key) {
    if (c.pass !== key) return false;
    const [x, y] = key.split(',').map(Number);
    return [c.tile, ...c.path.slice(0, 2)].some((t) => t.x === x && t.y === y);
  }

  // How far a car may go before it's right behind the car in front: { room,
  // who (that car) }.
  queueRoom(m, ux, uy) {
    let room = Infinity;
    let who = null;
    for (const o of this.cars) {
      if (o === m) continue;
      const rx = o.x - m.x;
      const ry = o.y - m.y;
      const along = rx * ux + ry * uy;
      if (along <= 0 || Math.abs(rx * uy - ry * ux) > 0.22) continue;
      const r = Math.max(0, along - (m.len || 0.38) - (o.len || 0.38) - GAP);
      if (r < room) {
        room = r;
        who = o;
      }
    }
    return { room, who };
  }

  // Anyone on these crosswalks of intersection j?
  peopleOn(j, arms) {
    return this.people.some((p) => p.crossing && p.crossing.ix === j.x && p.crossing.iy === j.y && arms.includes(p.crossing.arm));
  }

  // Is a car on (or about to drive over) a crosswalk?
  carsOn(cross) {
    const [x0, y0, x1, y1] = zebra(cross.ix, cross.iy, cross.arm);
    return this.cars.some((c) => {
      if (this.through(c, `${cross.ix},${cross.iy}`) && c.passArms.includes(cross.arm)) return true;
      const [a0, b0, a1, b1] = footprint(c);
      return a1 > x0 && a0 < x1 && b1 > y0 && b0 < y1;
    });
  }

  // ----------------------------------------------------------- people

  // One person along their way for dt seconds: the sidewalk point they've
  // just reached, if any. (m.wait while they wait at the curb: 'walk' for
  // the walk signal, 'car' for a car to go by.)
  walk(m, speed, dt) {
    if (!m.path.length) {
      m.wait = null;
      return null;
    }
    const b = m.path[0];
    if (!m.crossing) {
      const cross = crossingOf(this.ways, m.node, b);
      if (cross) {
        const lit = isLit(cross.ix, cross.iy);
        if ((lit && !mayWalk(cross, this.t)) || this.carsOn(cross)) {
          m.wait = lit && !mayWalk(cross, this.t) ? 'walk' : 'car';
          return null;
        }
        m.crossing = cross;
      }
    }
    m.wait = null;
    const goal = this.ways.nodes[b];
    const dx = goal.x - m.x;
    const dy = goal.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.02) m.face = Math.sign(dx);
    const step = speed * dt;
    if (dist <= step) {
      m.x = goal.x;
      m.y = goal.y;
      m.node = b;
      m.path.shift();
      m.crossing = null;
      return b;
    }
    m.x += (dx / dist) * step;
    m.y += (dy / dist) * step;
    return null;
  }
}

// Somewhere for a car out for a drive to go: a street tile in town (not an
// intersection, nor out at the end of a street).
export function streetTiles(size) {
  const list = [];
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) if (isRoad(x, y) && !isJunction(x, y) && !stubOf(x, y)) list.push({ x, y });
  return list;
}
