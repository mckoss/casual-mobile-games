// Crystal Cave: the roof of crystals, the shot and the rules. No DOM, so
// the tests can play it in Node, and so a computer miner can prove every
// level before a player sees it.
//
// The roof is a honeycomb: rows of circles, each row offset half a cell from
// the one above, eight to an even row and seven to an odd one, hanging from
// the top of the board. You fire a crystal up from the bottom; it bounces
// off the side walls, stops at the first crystal it touches (or the roof)
// and snaps into the nearest empty cell. Three or more of a colour touching
// shatter, and anything no longer joined to the roof drops into the cart.
// Every few shots the whole roof creeps down a row; a crystal reaching the
// line at the bottom is a cave-in.
//
// Lengths are in cell radii (a crystal is 1 across, 2 wide), the board is
// 16 wide, y runs down from the roof.
//
// Every kind of crystal (a plain gem, stone, and the power-ups the cart
// pays out) is a package in KINDS: the engine traces the shot and the
// kind says what happens where it lands. Adding a kind is adding to that
// table, nothing else.
import { rng, seedFor } from '../../js/lib/random.js';

export const COLS = 8; // crystals across an even row (odd rows have one fewer)
export const R = 1; // a crystal's radius
export const ROW_H = Math.sqrt(3) * R; // rows this far apart
export const W = COLS * 2 * R; // the board's width
export const DEAD_ROW = 12; // a crystal in this row (or lower) is a cave-in
export const SHOOT = { x: W / 2, y: (DEAD_ROW + 1.6) * ROW_H }; // where the shot starts
export const H = SHOOT.y + 2 * R; // the board's height, for the view
export const AIM_MAX = (78 * Math.PI) / 180; // the shot can't go flatter than this (from straight up)
export const CART = 8; // crystals dropped to fill the cart, which pays a power-up
export const POWERS = ['blast', 'prism', 'drill']; // the cart pays these in turn, each level starting one further round
export const MATCH = 3; // this many of a colour touching shatter
export const BASE_SEED = 20261027;
export const SPEED = 0.5; // the shot moves this far per step when traced
const DRILL_REACH = 1.5 * R; // the drill bores out crystals whose centre is this close to its line

// ------------------------------------------------------------------ grid

export const rowLen = (r) => (r % 2 ? COLS - 1 : COLS);
export const cellX = (r, c) => c * 2 * R + R + (r % 2 ? R : 0);
export const cellY = (r, shift = 0) => (r + shift) * ROW_H + R;
export const inGrid = (r, c) => r >= 0 && c >= 0 && c < rowLen(r);

// The six cells around (r, c), those in the grid.
export function neighbours(r, c) {
  const d = r % 2 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  const out = [];
  for (const [dr, dc] of d) if (inGrid(r + dr, c + dc)) out.push([r + dr, c + dc]);
  return out;
}

const at = (cells, r, c) => (cells[r] ? cells[r][c] ?? null : null);
const rowsOf = (cells) => cells.length;
const emptyRow = (r) => Array(rowLen(r)).fill(null);
const ensureRow = (cells, r) => { while (cells.length <= r) cells.push(emptyRow(cells.length)); };

// Every filled cell as [r, c].
export function filled(cells) {
  const out = [];
  for (let r = 0; r < cells.length; r++) for (let c = 0; c < cells[r].length; c++) if (cells[r][c]) out.push([r, c]);
  return out;
}

// The group of cells joined to (r, c) through `same`, (r, c) included.
function flood(cells, r, c, same) {
  const seen = new Set([`${r},${c}`]);
  const out = [[r, c]];
  for (let i = 0; i < out.length; i++) {
    for (const [nr, nc] of neighbours(out[i][0], out[i][1])) {
      const key = `${nr},${nc}`;
      if (seen.has(key) || !at(cells, nr, nc) || !same(at(cells, nr, nc))) continue;
      seen.add(key);
      out.push([nr, nc]);
    }
  }
  return out;
}

// Everything no longer joined to the roof (row 0): the cells to drop.
export function unsupported(cells) {
  const held = new Set();
  const queue = [];
  for (let c = 0; c < rowLen(0); c++) if (at(cells, 0, c)) { held.add(`0,${c}`); queue.push([0, c]); }
  for (let i = 0; i < queue.length; i++) {
    for (const [nr, nc] of neighbours(queue[i][0], queue[i][1])) {
      const key = `${nr},${nc}`;
      if (!held.has(key) && at(cells, nr, nc)) { held.add(key); queue.push([nr, nc]); }
    }
  }
  return filled(cells).filter(([r, c]) => !held.has(`${r},${c}`));
}

// The colours still on the roof (prisms don't count, nor stone).
export function coloursOn(cells) {
  const set = new Set();
  for (const [r, c] of filled(cells)) { const cell = at(cells, r, c); if (cell.colour !== undefined) set.add(cell.colour); }
  return [...set].sort((a, b) => a - b);
}

// ------------------------------------------------------------------ kinds
//
// A kind is { bounces, stops, land(cells, where) }: whether the shot comes
// off the walls, whether it stops at the first crystal (else it flies the
// board through), and what happens when it lands. `where` is the cell it
// snapped into -- a shot that doesn't stop gets the list of cells its line
// ran through instead -- and `land` returns the cells shattered (the engine
// takes them out and then drops whatever they held up).

// The colour this cell shows for matching: a gem's own, a prism's any.
const isGem = (cell) => cell.colour !== undefined;
const matchesColour = (cell, colour) => cell.kind === 'prism' || cell.colour === colour;

export const KINDS = {
  // A plain crystal: three or more of its colour touching, and they shatter.
  gem: {
    bounces: true,
    stops: true,
    land(cells, [r, c]) {
      const group = flood(cells, r, c, (cell) => matchesColour(cell, at(cells, r, c).colour));
      return group.length >= MATCH ? group : [];
    },
  },
  // Grey stone: never matches anything, only ever drops out from under.
  stone: { bounces: true, stops: true, land: () => [] },
  // Blast: shatters itself and everything around it, whatever it is.
  blast: {
    bounces: true,
    stops: true,
    land: (cells, [r, c]) => [[r, c], ...neighbours(r, c).filter(([nr, nc]) => at(cells, nr, nc))],
  },
  // Prism: matches any colour. Landed, it joins every group around it big
  // enough to shatter; next to none, it waits for a gem to come to it.
  prism: {
    bounces: true,
    stops: true,
    land(cells, [r, c]) {
      const out = new Map();
      const colours = new Set(neighbours(r, c).map(([nr, nc]) => at(cells, nr, nc)).filter((cell) => cell && isGem(cell)).map((cell) => cell.colour));
      for (const colour of colours) {
        const group = flood(cells, r, c, (cell) => matchesColour(cell, colour));
        if (group.length >= MATCH) for (const cell of group) out.set(cell.join(','), cell);
      }
      return [...out.values()];
    },
  },
  // Drill: doesn't stop at anything -- it bores out everything on its way,
  // off the walls and all, up to the roof.
  drill: { bounces: true, stops: false, land: (cells, through) => through },
};

// ------------------------------------------------------------------ the shot

// Trace a shot from the shooter at `angle` (radians from straight up,
// positive to the right): the points it passes, where it stops, and the
// empty cell it snaps into -- or, for a kind that doesn't stop, the cells
// its line runs through. A shot stops at the first crystal it touches or at
// the roof. `shift` is how far the roof has crept.
export function trace(cells, shift, angle, kind = KINDS.gem) {
  angle = Math.max(-AIM_MAX, Math.min(AIM_MAX, angle));
  let x = SHOOT.x;
  let y = SHOOT.y;
  let dx = Math.sin(angle) * SPEED;
  const dy = -Math.cos(angle) * SPEED;
  const path = [[x, y]];
  const roof = cellY(0, shift); // a shot centred here sits in row 0
  const through = new Map();
  const hit = (px, py) => {
    // The nearest crystal overlapping the shot here, if any.
    let best = null;
    let bestD = 2 * R;
    const r0 = Math.max(0, Math.floor((py - R) / ROW_H - shift) - 1);
    for (let r = r0; r < rowsOf(cells) && r <= r0 + 3; r++) {
      for (let c = 0; c < cells[r].length; c++) {
        if (!cells[r][c]) continue;
        const d = Math.hypot(cellX(r, c) - px, cellY(r, shift) - py);
        if (d < bestD) { bestD = d; best = [r, c]; }
      }
    }
    return best;
  };
  for (let steps = 0; steps < 400; steps++) {
    x += dx;
    y += dy;
    if (kind.bounces) {
      if (x < R) { x = 2 * R - x; dx = -dx; path.push([R, y]); }
      if (x > W - R) { x = 2 * (W - R) - x; dx = -dx; path.push([W - R, y]); }
    } else if (x < -R || x > W + R) break;
    if (!kind.stops) {
      // Bore: every crystal whose centre is within reach of the line.
      for (const [r, c] of filled(cells)) {
        if (Math.hypot(cellX(r, c) - x, cellY(r, shift) - y) < DRILL_REACH) through.set(`${r},${c}`, [r, c]);
      }
      if (y < roof - R) break;
      continue;
    }
    const touched = y <= roof ? 'roof' : hit(x, y);
    if (!touched) continue;
    if (touched === 'roof') y = roof;
    path.push([x, y]);
    return { path, x, y, cell: snap(cells, shift, x, y, touched === 'roof' ? null : touched) };
  }
  path.push([x, y]);
  return { path, x, y, cell: null, through: [...through.values()] };
}

// The empty cell nearest the shot where it stopped: one of those around the
// crystal it touched (so it never jumps a gap), or in the top row at the
// roof.
function snap(cells, shift, x, y, touched) {
  const candidates = [];
  if (touched) {
    for (const [r, c] of neighbours(touched[0], touched[1])) if (!at(cells, r, c)) candidates.push([r, c]);
    // Below the last row: the row under it is empty but not yet in the grid.
    const below = touched[0] + 1;
    if (below >= rowsOf(cells)) for (let c = 0; c < rowLen(below); c++) if (neighbours(below, c).some(([nr, nc]) => nr === touched[0] && nc === touched[1])) candidates.push([below, c]);
  } else {
    for (let c = 0; c < rowLen(0); c++) if (!at(cells, 0, c)) candidates.push([0, c]);
  }
  if (!candidates.length) {
    // (Squeezed in somewhere odd: any empty cell, then.)
    for (let r = 0; r <= rowsOf(cells); r++) for (let c = 0; c < rowLen(r); c++) if (!at(cells, r, c)) candidates.push([r, c]);
  }
  let best = null;
  let bestD = Infinity;
  for (const [r, c] of candidates) {
    const d = Math.hypot(cellX(r, c) - x, cellY(r, shift) - y);
    if (d < bestD) { bestD = d; best = [r, c]; }
  }
  return best;
}

// ------------------------------------------------------------------ a game

// What level n asks of you: more rows and more colours, stone from level 6,
// and the roof creeping sooner.
export function specFor(n) {
  const k = n - 1;
  return {
    rows: Math.min(7, 4 + Math.floor(k / 5)),
    colours: Math.min(5, 3 + Math.floor(k / 8)),
    stones: n >= 6 ? Math.min(6, 1 + Math.floor((n - 6) / 5)) : 0,
    creep: Math.max(5, 10 - Math.floor(k / 6)), // the roof comes down a row every this many shots
    par: 6 + Math.floor(0.4 * Math.min(n, 30)), // the fewest shots a roof should take the computer miner (see makeLevel); roofs stop growing, so this stops at level 30
  };
}

// The shapes a roof can take: `has(row, c, rows)` says whether a cell is
// part of the roof. Each gives the shot different surfaces to work at.
// A shape's top row is always full, so there's something to hang from (a
// picture hangs by its own top).
const SHAPES = {
  block: () => true, // the solid slab
  teeth: (row, c) => row < 2 || (row % 2 ? c % 2 === 1 : c % 2 === 0), // stalactites, every other column
  vee: (row, c, rows) => row < 2 + (rows - 2) * (1 - Math.abs(cellX(row, c) - W / 2) / (W / 2)) + 0.5, // deepest in the middle
  wings: (row, c, rows) => row < 2 + (rows - 2) * (Math.abs(cellX(row, c) - W / 2) / (W / 2)) + 0.5, // deepest at the walls
  pillars: (row, c) => row < 2 || [0, 1, 3, 4, 6, 7].includes(Math.floor(cellX(row, c) / 2)), // three thick columns, two slots between
  arch: (row, c, rows) => row < 2 || Math.abs(cellX(row, c) - W / 2) > (rows - row) * 1.3, // a hollow under the middle
};
const SHAPE_ORDER = ['block', 'vee', 'teeth', 'wings', 'pillars', 'arch'];

// Every tenth level the roof is a picture, taken in turn from these: a
// cell per character, # a crystal, rows as the grid has them (eight and
// seven about), each hanging from the roof by its top. Eyes and mouths
// are holes.
export const PICTURES = {
  heart: ['.##..##.', '#######', '########', '.#####.', '..####..', '...#...'],
  star: ['...##...', '...#...', '########', '.#####.', '..####..', '.##.##.', '.#....#.'],
  smiley: ['..####..', '.#####.', '##.##.##', '#######', '##....##', '.#####.', '..####..'],
  diamond: ['...##...', '..###..', '.######.', '#######', '.######.', '..###..', '...##...'],
  mole: ['##....##', '.#####.', '########', '##.#.##', '########', '..###..', '...##...'],
};
const PICTURE_ORDER = ['heart', 'star', 'smiley', 'diamond', 'mole'];
export const pictureFor = (n) => (n >= 10 && n % 10 === 0 ? PICTURE_ORDER[(n / 10 - 1) % PICTURE_ORDER.length] : null);

// The roof for level n, attempt a (a picture on every tenth): a shape of
// coloured crystals that lean toward their neighbours' colours, so there
// are pairs and small clumps to go for -- never more than four of a colour
// touching, so no roof falls at a touch (a cell where every colour would
// make five is left empty) -- with a few stones set among them. Rows are
// strings, one character a cell: a digit for a colour, S for stone, . for
// empty.
export function makeRoof(n, attempt = 0) {
  const r = rng(seedFor(n * 16 + attempt, BASE_SEED));
  const spec = specFor(n);
  const picture = pictureFor(n);
  const shape = picture ? `picture:${picture}` : n < 3 ? 'block' : SHAPE_ORDER[Math.floor(r() * SHAPE_ORDER.length)];
  const has = picture ? (row, c) => PICTURES[picture][row]?.[c] === '#' : SHAPES[shape];
  const depth = picture ? PICTURES[picture].length : spec.rows;
  const rows = [];
  // How many of this colour would touch, with a crystal of it here (itself
  // included), among the cells placed so far.
  const clump = (row, c, colour) => {
    const grid = rows.map((cells) => cells.map((v) => (typeof v === 'number' ? { colour: v } : null)));
    grid[row][c] = { colour };
    return flood(grid, row, c, (cell) => cell.colour === colour).length;
  };
  for (let row = 0; row < depth; row++) {
    const cells = [];
    rows.push(cells);
    for (let c = 0; c < rowLen(row); c++) {
      if (!has(row, c, depth)) { cells.push(null); continue; }
      const above = row > 0 ? rows[row - 1] : null;
      // Lean on a neighbour already placed -- the one to the left, or one
      // above -- else any colour; never one that makes five.
      const options = [];
      if (r() < 0.55) {
        if (c > 0 && cells[c - 1] !== null) options.push(cells[c - 1]);
        if (above) {
          const [a, b] = row % 2 ? [c, c + 1] : [c - 1, c];
          if (typeof above[a] === 'number') options.push(above[a]);
          if (typeof above[b] === 'number') options.push(above[b]);
        }
      }
      for (let k = 0; k < spec.colours; k++) options.push(Math.floor(r() * spec.colours));
      for (let k = 0; k < spec.colours; k++) options.push(k); // (every colour, last)
      // No colour fits (every one has four already touching this cell):
      // the cell stays empty, a small hole. The top row always has a fit,
      // with only the cell to its left placed.
      cells.push(options.find((v) => clump(row, c, v) <= 4) ?? null);
    }
  }
  // Stones go in below the top row, never two touching.
  for (let st = 0; st < spec.stones; st++) {
    for (let tries = 0; tries < 20; tries++) {
      const row = 1 + Math.floor(r() * (depth - 1));
      const c = Math.floor(r() * rowLen(row));
      if (typeof rows[row][c] !== 'number' || neighbours(row, c).some(([nr, nc]) => rows[nr]?.[nc] === 'S')) continue;
      rows[row][c] = 'S';
      break;
    }
  }
  // Nothing hangs in the air: a shape never leaves a cell unjoined to the
  // roof, but a trim here makes sure.
  const cells = rows.map((row) => row.map((v) => (v === null ? null : v === 'S' ? { kind: 'stone' } : { kind: 'gem', colour: v })));
  for (const [row, c] of unsupported(cells)) rows[row][c] = null;
  return { n, attempt, shape, rows: rows.map((row) => row.map((v) => (v === null ? '.' : v)).join('')), colours: spec.colours, creep: spec.creep, queue: seedFor(n * 16 + attempt, BASE_SEED + 1) };
}

const parseCell = (ch) => (ch === '.' ? null : ch === 'S' ? { kind: 'stone' } : { kind: 'gem', colour: Number(ch) });

// A fresh game of a level: the roof, the shot loaded and the next one
// shown, the cart empty (its first payout one further round the POWERS
// each level). The i-th crystal drawn is a colour still on the roof, from
// the level's own seed, so the same shots always get the same crystals.
export function newGame(level) {
  const cells = level.rows.map((row) => [...row].map(parseCell));
  const G = { cells, shift: 0, shots: 0, drawn: 0, dropped: 0, cart: 0, owed: 0, paid: ((level.n ?? 1) - 1) % POWERS.length, loaded: null, next: null, over: null, creep: level.creep, queue: level.queue };
  G.loaded = draw(G);
  G.next = draw(G);
  return G;
}

function draw(G) {
  const colours = coloursOn(G.cells);
  const r = rng(seedFor(G.drawn++, G.queue));
  if (!colours.length) return { kind: 'gem', colour: 0 }; // (nothing but prisms or stone left: any colour will do)
  return { kind: 'gem', colour: colours[Math.floor(r() * colours.length)] };
}

export function cloneGame(G) {
  return { ...G, cells: G.cells.map((row) => row.map((cell) => (cell ? { ...cell } : null))), loaded: { ...G.loaded }, next: { ...G.next } };
}

// Swap the loaded crystal with the next.
export function swap(G) {
  [G.loaded, G.next] = [G.next, G.loaded];
}

// Fire the loaded crystal at `angle`. Returns what happened, for the view:
// the shot's path, where it landed, what shattered, what dropped, whether
// the roof crept, what the cart paid out, and whether the game is over
// ('cleared' or 'cavein').
export function fire(G, angle) {
  if (G.over) return null;
  const crystal = G.loaded;
  const kind = KINDS[crystal.kind];
  const shot = trace(G.cells, G.shift, angle, kind);
  const ev = { crystal, path: shot.path, landed: shot.cell, shattered: [], dropped: [], crept: false, paid: null, over: null };
  if (shot.cell) {
    ensureRow(G.cells, shot.cell[0]);
    G.cells[shot.cell[0]][shot.cell[1]] = crystal;
    ev.shattered = kind.land(G.cells, shot.cell);
  } else {
    ev.shattered = kind.land(G.cells, shot.through ?? []);
  }
  // Each as [r, c, crystal], so the view knows what it was.
  ev.shattered = ev.shattered.map(([r, c]) => [r, c, G.cells[r][c]]);
  for (const [r, c] of ev.shattered) G.cells[r][c] = null;
  ev.dropped = unsupported(G.cells).map(([r, c]) => [r, c, G.cells[r][c]]);
  for (const [r, c] of ev.dropped) G.cells[r][c] = null;
  while (G.cells.length && G.cells[G.cells.length - 1].every((cell) => !cell)) G.cells.pop();
  G.shots++;
  G.dropped += ev.dropped.length;
  G.cart += ev.dropped.length;
  // A cartful pays a power-up; a drop big enough for two pays one now and
  // owes the other, paid on the next shot.
  while (G.cart >= CART) {
    G.cart -= CART;
    G.owed++;
  }
  if (G.owed) {
    G.owed--;
    ev.paid = POWERS[G.paid++ % POWERS.length];
  }
  if (!G.cells.length) {
    G.over = ev.over = 'cleared';
    return ev;
  }
  if (G.shots % G.creep === 0) { G.shift++; ev.crept = true; }
  if (G.cells.length - 1 + G.shift >= DEAD_ROW) {
    G.over = ev.over = 'cavein';
    return ev;
  }
  G.loaded = G.next;
  G.next = ev.paid ? { kind: ev.paid } : draw(G);
  // (The crystal loaded was drawn a shot ago: if its colour has gone from
  // the roof since, it's drawn again, so you're never handed a dead one.)
  if (G.loaded.kind === 'gem' && !coloursOn(G.cells).includes(G.loaded.colour)) G.loaded = draw(G);
  return ev;
}

// ------------------------------------------------------------------ the computer miner

// The aims it tries: every 2 degrees across the arc, the straightest first,
// so of the aims that land in one cell it keeps the one a player would take.
const ANGLES = [];
for (let a = -AIM_MAX; a <= AIM_MAX + 1e-9; a += (2 * Math.PI) / 180) ANGLES.push(a);
ANGLES.sort((a, b) => Math.abs(a) - Math.abs(b));

// What a shot at `angle` would do, as a score: a point a crystal shattered,
// two a crystal dropped, the board cleared is the prize -- and a shot that
// shatters nothing is worse the lower it lands.
function outcomes(G) {
  const seen = new Map();
  const kind = KINDS[G.loaded.kind];
  for (const angle of ANGLES) {
    const shot = trace(G.cells, G.shift, angle, kind);
    const key = shot.cell ? shot.cell.join(',') : (shot.through ?? []).map((c) => c.join(',')).join(';');
    if (seen.has(key)) continue;
    const after = cloneGame(G);
    const ev = fire(after, angle);
    let score = ev.shattered.length + 2 * ev.dropped.length + 3 * (G.cells.length - after.cells.length);
    if (ev.over === 'cleared') score += 1000;
    if (ev.over === 'cavein') score -= 1000;
    if (!ev.shattered.length && shot.cell) score -= 0.5 * (shot.cell[0] + 1);
    seen.set(key, { angle, score, after });
  }
  return [...seen.values()];
}

// The best shot from here: the outcome that scores best with the best
// reply after it counted for a little over half.
export function bestShot(G) {
  const now = outcomes(G).sort((a, b) => b.score - a.score);
  let best = now[0];
  let bestScore = -Infinity;
  for (const o of now.slice(0, 3)) {
    const reply = o.after.over ? 0 : Math.max(0, ...outcomes(o.after).map((p) => p.score));
    const score = o.score + 0.6 * reply;
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best.angle;
}

// Play the level through from the start: { cleared, shots, angles }.
export function solve(level, maxShots = 150) {
  const G = newGame(level);
  const angles = [];
  while (!G.over && G.shots < maxShots) {
    // (Fired as stored, to the thousandth, so the saved run replays exactly.)
    const angle = Math.round(bestShot(G) * 1000) / 1000;
    angles.push(angle);
    fire(G, angle);
  }
  return { cleared: G.over === 'cleared', shots: G.shots, angles };
}

// Level n: its roof re-rolled from the same seed (up to sixteen times) until
// the computer miner clears it in a sensible number of shots for the level
// -- not under spec.par, which would be a roof that falls at a touch, and
// not over twice it -- and its shot count is par. If no attempt lands in
// that band, the nearest one that clears is taken (still proved, so still
// `checked`); if none clears at all, the level ships anyway with a guessed
// par, no solution, and `checked` false for the screen to say so.
export function makeLevel(n) {
  const { par: want } = specFor(n);
  let best = null;
  for (let attempt = 0; attempt < 16; attempt++) {
    const roof = makeRoof(n, attempt);
    const run = solve(roof);
    if (!run.cleared) continue;
    const off = run.shots < want ? want - run.shots : run.shots > 2 * want ? run.shots - 2 * want : 0;
    if (!best || off < best.off) best = { roof, run, off };
    if (off === 0) break;
  }
  if (!best) {
    const roof = makeRoof(n, 0);
    return { ...roof, par: want, solution: [], checked: false };
  }
  return { ...best.roof, par: best.run.shots, solution: best.run.angles, checked: true };
}

// Stars for clearing the roof in `shots`: three at par or better, two within
// half as many again, one for clearing it.
export function stars(level, shots) {
  return shots <= level.par ? 3 : shots <= Math.ceil(level.par * 1.5) ? 2 : 1;
}
