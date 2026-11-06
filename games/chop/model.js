// The Chopping Game: a block of ice in chunks, with a surprise frozen
// inside; each tap chops a chunk, and once every chunk is gone the surprise
// is free. (No DOM: tested in Node.)
//
// The block is W wide and H tall, in block units, y down. Its chunks are the
// cells of a Voronoi diagram -- of points scattered over a grid, each cell
// the part of the block nearer its point than any other -- so they fit
// together with no gaps, like cracked ice.

export const W = 1;
export const H = 1.2;

// What's frozen inside, in turn (then round again).
export const SURPRISES = [
  { emoji: '🐧', name: 'A penguin' },
  { emoji: '🐶', name: 'A puppy' },
  { emoji: '🎁', name: 'A present' },
  { emoji: '🦄', name: 'A unicorn' },
  { emoji: '🐢', name: 'A turtle' },
  { emoji: '🦖', name: 'A dinosaur' },
  { emoji: '🍦', name: 'An ice cream' },
  { emoji: '🐱', name: 'A kitten' },
  { emoji: '🚂', name: 'A train' },
  { emoji: '🐠', name: 'A fish' },
  { emoji: '🧸', name: 'A teddy bear' },
  { emoji: '🦊', name: 'A fox' },
  { emoji: '🚀', name: 'A rocket' },
  { emoji: '🐙', name: 'An octopus' },
  { emoji: '🍩', name: 'A doughnut' },
  { emoji: '🦁', name: 'A lion' },
  { emoji: '🎈', name: 'A balloon' },
  { emoji: '🐘', name: 'An elephant' },
  { emoji: '🦋', name: 'A butterfly' },
  { emoji: '💎', name: 'A diamond' },
];

// A little pseudo-random sequence, the same every time for a level.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// Keep the part of polygon pts on the side of the line through (x, y) with
// normal (nx, ny) where the dot product is at most d.
function clip(pts, nx, ny, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const da = a[0] * nx + a[1] * ny - d;
    const db = b[0] * nx + b[1] * ny - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export const area = (pts) => Math.abs(pts.reduce((a, [x, y], i) => {
  const [u, v] = pts[(i + 1) % pts.length];
  return a + x * v - u * y;
}, 0)) / 2;

export const centroid = (pts) => {
  let x = 0;
  let y = 0;
  let a = 0;
  pts.forEach(([x0, y0], i) => {
    const [x1, y1] = pts[(i + 1) % pts.length];
    const c = x0 * y1 - x1 * y0;
    a += c;
    x += (x0 + x1) * c;
    y += (y0 + y1) * c;
  });
  return [x / (3 * a), y / (3 * a)];
};

export function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// How many chunks level n's block is in, and how many chops each takes:
// big chunks, one chop each, to begin with; then more of them, some of
// thicker ice (two chops, then three).
export function sizeOf(n) {
  const cols = Math.min(5, 2 + Math.floor((n + 1) / 2));
  const rows = Math.min(6, 2 + Math.floor(n / 2));
  return { cols, rows };
}
function hpFor(n, r) {
  if (n <= 2) return 1;
  const thick = Math.min(0.5, (n - 2) * 0.08);
  if (r() >= thick) return 1;
  return n >= 7 && r() < 0.3 ? 3 : 2;
}

// Level n (from 1): { n, surprise, chunks: [{ pts, hp, max }] }.
export function level(n) {
  const r = rng(n * 7919 + 13);
  const { cols, rows } = sizeOf(n);
  const seeds = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) seeds.push([((i + 0.2 + r() * 0.6) * W) / cols, ((j + 0.2 + r() * 0.6) * H) / rows]);
  }
  const chunks = seeds.map(([sx, sy], k) => {
    let pts = [[0, 0], [W, 0], [W, H], [0, H]];
    seeds.forEach(([ox, oy], m) => {
      if (m === k) return;
      // (Nearer this seed than that one: the side of their bisector it's on.)
      const nx = ox - sx;
      const ny = oy - sy;
      pts = clip(pts, nx, ny, (nx * (ox + sx) + ny * (oy + sy)) / 2);
    });
    const hp = hpFor(n, r);
    return { pts, hp, max: hp };
  });
  return { n, surprise: SURPRISES[(n - 1) % SURPRISES.length], chunks };
}

// The chunk at (x, y) in the block, if any is left there: its index, or -1.
export function chunkAt(lv, x, y) {
  return lv.chunks.findIndex((c) => c.hp > 0 && inside(c.pts, x, y));
}

// A chop at (x, y): the chunk there, a chop the less; null if there's no
// ice there. { i, broke }
export function chop(lv, x, y) {
  const i = chunkAt(lv, x, y);
  if (i < 0) return null;
  lv.chunks[i].hp--;
  return { i, broke: lv.chunks[i].hp === 0 };
}

export const left = (lv) => lv.chunks.filter((c) => c.hp > 0).length;
export const free = (lv) => left(lv) === 0;
