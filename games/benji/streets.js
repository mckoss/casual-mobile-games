// Benji's Town: sidewalks, crosswalks and traffic lights. (No DOM: tested
// in Node.)
//
// Every street has a sidewalk down each side, on the verge just off the
// road. People walk only on the sidewalks, round the corners of each block,
// and cross the street only on the crosswalks: one on each arm of every
// intersection, just back from it. Some intersections have traffic lights,
// east-west and north-south taking turns; cars stop at red, and people wait
// for the walk signal (and don't start out when it's about to change). At
// the others, cars take turns and give way to anyone on the crosswalk.
import { SIZE, ROADS, isRoad } from './town.js';

export const PAD = 0.09; // the sidewalk's middle, out from the road's edge
export const CROSS = 0.25; // the crosswalk's middle, back from the intersection
export const ZEBRA = [0.1, 0.4]; // the crosswalk's stripes, back from the intersection
export const STOP_LINE = 0.44; // the stop line, back from the intersection
const STEP = 0.25; // sidewalk points every quarter tile or so

export const isJunction = (x, y) => isRoad(x, y) && isRoad(x + 1, y) && isRoad(x - 1, y) && isRoad(x, y + 1) && isRoad(x, y - 1);
export function junctions() {
  const list = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (isJunction(x, y)) list.push({ x, y });
  return list;
}
// The intersections with traffic lights: corner to corner across town.
const LIT = ROADS.map((r) => `${r},${r}`);
export const isLit = (x, y) => LIT.includes(`${x},${y}`);

// Does the street run north-south here (or east-west)?
export const runsNS = (x, y) => isRoad(x, y - 1) || isRoad(x, y + 1);

// The arm ('n', 's', 'w' or 'e') of the intersection at j that tile t is on.
export function armOf(j, t) {
  if (t.y < j.y) return 'n';
  if (t.y > j.y) return 's';
  return t.x < j.x ? 'w' : 'e';
}

// Is a street tile at the edge of town (a dead end, with its turning circle)?
export const atEdge = (x, y) => (runsNS(x, y) ? y === 0 || y === SIZE - 1 : x === 0 || x === SIZE - 1);
// Is there a crosswalk across this street tile, by its intersection? (Every
// arm of every intersection has one.)
export const hasCrossing = (x, y) => !atEdge(x, y);

// The turning circle at the end of a street (tile t, the street going out
// to the edge of town that way, d): its middle, the island's radius and the
// paving's. Cars go round it keeping the island on their left.
export const CIRCLE = { at: 0.45, ring: 0.38, island: 0.2, paved: 0.55 };
export function circleAt(t, d) {
  return { x: t.x + 0.5 + d.x * (CIRCLE.at - 0.5), y: t.y + 0.5 + d.y * (CIRCLE.at - 0.5) };
}

// The crosswalks: { ix, iy (the intersection), arm, walk (the way people
// walk over it: 'ew' across a north-south street) }.
export function crossings() {
  const list = [];
  for (const { x, y } of junctions()) {
    for (const [arm, dx, dy] of [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]]) {
      if (hasCrossing(x + dx, y + dy)) list.push({ ix: x, iy: y, arm, walk: dx ? 'ns' : 'ew' });
    }
  }
  return list;
}

// A crosswalk's stripes, as a box in tiles: [x0, y0, x1, y1].
export function zebra(ix, iy, arm) {
  const [a, b] = ZEBRA;
  if (arm === 'n') return [ix, iy - b, ix + 1, iy - a];
  if (arm === 's') return [ix, iy + 1 + a, ix + 1, iy + 1 + b];
  if (arm === 'w') return [ix - b, iy, ix - a, iy + 1];
  return [ix + 1 + a, iy, ix + 1 + b, iy + 1];
}

// ------------------------------------------------------------- the lights

// A light's cycle (seconds): east-west green, yellow, all red; then the
// same north-south. Each intersection is a little out of step with the next.
export const GREEN = 3.5;
export const YELLOW = 1;
export const ALL_RED = 0.6;
const HALF = GREEN + YELLOW + ALL_RED;
const CYCLE = 2 * HALF;
const offset = (ix, iy) => (ix * 1.3 + iy * 2.1) % CYCLE;

// The lights at an intersection at time t: { ew, ns } each 'green',
// 'yellow' or 'red', and how long the green has left (0 when it's not).
export function lights(ix, iy, t) {
  const p = (((t + offset(ix, iy)) % CYCLE) + CYCLE) % CYCLE;
  const go = p < HALF ? 'ew' : 'ns';
  const q = p % HALF;
  const colour = q < GREEN ? 'green' : q < GREEN + YELLOW ? 'yellow' : 'red';
  return { ew: go === 'ew' ? colour : 'red', ns: go === 'ns' ? colour : 'red', left: q < GREEN ? GREEN - q : 0 };
}

// May a car drive into the intersection going along axis ('ew' or 'ns')?
export const mayDrive = (ix, iy, axis, t) => lights(ix, iy, t)[axis] === 'green';

// The walk signal at a crosswalk: 'walk' (the little walking man), 'flash'
// (the red hand blinking: don't start now) or 'stop' (the red hand). People
// walk with the traffic going their way: across a north-south street while
// east-west has its green, and long enough left to get over.
export const WALK_TIME = 1.6;
export function walkSignal(cross, t) {
  const l = lights(cross.ix, cross.iy, t);
  if (l[cross.walk] !== 'green') return 'stop';
  return l.left > WALK_TIME ? 'walk' : 'flash';
}
export const mayWalk = (cross, t) => walkSignal(cross, t) === 'walk';

// ------------------------------------------------------------ sidewalks

// The sidewalk network: points every quarter tile or so along each
// sidewalk (the blocks' corners joining them up), and the crosswalks
// across the streets (those links marked with their crossing). w.route()
// finds the shortest walk between two points.
export function walkways() {
  const nodes = [];
  const adj = [];
  const keys = new Map();
  const key = (x, y) => `${Math.round(x * 100)},${Math.round(y * 100)}`;
  const node = (x, y) => {
    const k = key(x, y);
    if (!keys.has(k)) {
      keys.set(k, nodes.length);
      nodes.push({ x, y });
      adj.push([]);
    }
    return keys.get(k);
  };
  const link = (a, b, cross = null) => {
    if (a === b || adj[a].some((e) => e.to === b)) return;
    adj[a].push({ to: b, cross });
    adj[b].push({ to: a, cross });
  };
  // A sidewalk through these stops, in order, with points between.
  const line = (stops) => {
    let prev = node(...stops[0]);
    for (let k = 1; k < stops.length; k++) {
      const [x0, y0] = stops[k - 1];
      const [x1, y1] = stops[k];
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / STEP));
      for (let i = 1; i <= n; i++) {
        const cur = node(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
        link(prev, cur);
        prev = cur;
      }
    }
  };
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      if (!isRoad(x, y) || isJunction(x, y)) continue;
      // Along the street, the sidewalk stops at the corner of the block (and
      // passes the end of the crosswalk on the way).
      const ns = runsNS(x, y);
      const before = ns ? isJunction(x, y - 1) : isJunction(x - 1, y);
      const after = ns ? isJunction(x, y + 1) : isJunction(x + 1, y);
      const along = [before ? PAD : 0, ...(before ? [CROSS] : []), ...(after ? [1 - CROSS] : []), after ? 1 - PAD : 1];
      for (const side of [-PAD, 1 + PAD]) line(along.map((a) => (ns ? [x + side, y + a] : [x + a, y + side])));
    }
  }
  for (const c of crossings()) {
    const { ix: x, iy: y } = c;
    if (c.arm === 'n') link(node(x - PAD, y - CROSS), node(x + 1 + PAD, y - CROSS), c);
    if (c.arm === 's') link(node(x - PAD, y + 1 + CROSS), node(x + 1 + PAD, y + 1 + CROSS), c);
    if (c.arm === 'w') link(node(x - CROSS, y - PAD), node(x - CROSS, y + 1 + PAD), c);
    if (c.arm === 'e') link(node(x + 1 + CROSS, y - PAD), node(x + 1 + CROSS, y + 1 + PAD), c);
  }
  const memo = new Map();
  const w = { nodes, adj, route: (a, b) => {
    const k = a * nodes.length + b;
    if (!memo.has(k)) memo.set(k, walkRoute(w, a, b));
    return memo.get(k).slice();
  } };
  return w;
}

// The sidewalk point nearest (x, y).
export function nearestWalk(w, x, y) {
  let best = 0;
  let bd = Infinity;
  w.nodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) [bd, best] = [d, i];
  });
  return best;
}

// Where someone on foot goes for a place: the sidewalk outside its door.
export function walkDoor(w, place) {
  const d = place.door;
  if (d.x < place.x) return nearestWalk(w, d.x + 1 + PAD, d.y + 0.5);
  if (d.x >= place.x + (place.w || 1)) return nearestWalk(w, d.x - PAD, d.y + 0.5);
  if (d.y < place.y) return nearestWalk(w, d.x + 0.5, d.y + 1 + PAD);
  return nearestWalk(w, d.x + 0.5, d.y - PAD);
}

// The shortest walk between two sidewalk points: the points in order (both
// ends included).
export function walkRoute(w, from, to) {
  const n = w.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!seen[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === to) break;
    seen[u] = 1;
    for (const e of w.adj[u]) {
      const d = dist[u] + Math.hypot(w.nodes[e.to].x - w.nodes[u].x, w.nodes[e.to].y - w.nodes[u].y);
      if (d < dist[e.to]) {
        dist[e.to] = d;
        prev[e.to] = u;
      }
    }
  }
  if (dist[to] === Infinity) return [from];
  const path = [];
  for (let v = to; v >= 0; v = prev[v]) path.unshift(v);
  return path;
}

// The crossing (if any) on the link between two sidewalk points.
export const crossingOf = (w, a, b) => w.adj[a]?.find((e) => e.to === b)?.cross || null;
