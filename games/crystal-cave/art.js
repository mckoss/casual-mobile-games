// Card illustration for the arcade hub: a snug cave in lamplight, a cluster
// of crystals hanging from the roof with a gap in it, and the mole below
// with his catapult loaded -- a dotted line showing where the shot will go.
import { paintGem, paintMole, GEMS } from './play.js';

// The cluster, as honeycomb cells: [x in gem radii from the middle, row,
// colour]. Odd rows sit half a step over; the gap at (1, 1) is the target,
// with green either side of it to match the loaded crystal.
const CELLS = [
  [-6, 0, 3], [-4, 0, 0], [-2, 0, 1], [0, 0, 2], [2, 0, 4], [4, 0, 0],
  [-5, 1, 1], [-3, 1, 3], [-1, 1, 4], [3, 1, 2], [5, 1, 3],
  [-4, 2, 0], [-2, 2, 1], [4, 2, 4],
];
const SPARKLES = [[0.1, 0.5], [0.18, 0.78], [0.86, 0.46], [0.92, 0.8], [0.72, 0.64], [0.3, 0.6]];

export function paint(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = rect.height;
  const r = H * 0.087; // a gem's radius (13 px on the 150 px card)
  const k = H * 0.11; // the shooter's unit, as the game draws him

  // The far wall, warmed by a lamp glowing low in the middle, and the floor.
  ctx.fillStyle = '#2c1f44';
  ctx.fillRect(0, 0, W, H);
  const lamp = ctx.createRadialGradient(W / 2, H * 0.85, 0, W / 2, H * 0.85, Math.max(W, H) * 0.6);
  lamp.addColorStop(0, 'rgba(255,220,140,.4)');
  lamp.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4a3368';
  ctx.fillRect(0, H * 0.94, W, H * 0.06);

  // Two helpers: a stroked line (a polyline, or a path the caller traces),
  // and a picture drawn about a point.
  const line = (colour, width, pts) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    if (typeof pts === 'function') pts();
    else pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  const at = (x, y, draw) => {
    ctx.save();
    ctx.translate(x, y);
    draw();
    ctx.restore();
  };

  // The roof: rock with a jagged, lamp-lit edge along its underside.
  const step = Math.max(6, H * 0.08);
  const edge = [];
  for (let i = 0, x = 0; x <= W + step; i++, x += step) edge.push([x, H * (0.1 + 0.03 * ((i * 7) % 3))]);
  ctx.fillStyle = '#5b4a78';
  ctx.beginPath();
  [[0, 0], ...edge, [W, 0]].forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.fill();
  line('#7c68a3', 2, edge);

  // The crystals, hanging from it in their honeycomb (rows a root-three
  // radii apart), and a few sparkles in the air.
  const row = (n) => H * 0.17 + n * r * 1.73;
  for (const [x, n, c] of CELLS) at(W / 2 + x * r, row(n), () => paintGem(ctx, GEMS[c], r));
  const s = H * 0.03;
  for (const [x, y] of SPARKLES) {
    line('rgba(255,255,255,.55)', 1.5, [[W * x - s, H * y], [W * x + s, H * y]]);
    line('rgba(255,255,255,.55)', 1.5, [[W * x, H * y - s], [W * x, H * y + s]]);
  }

  // The catapult (a forked post, the band drawn back to the pouch) with
  // the mole behind it, as the game has them, and the loaded crystal aimed
  // at the gap -- a faint ring where it will land.
  const sx = W / 2;
  const sy = H * 0.98 - k * 2.9;
  const p = (x, y) => [sx + x * k, sy + y * k];
  ctx.lineCap = 'round';
  line('#8a5a2b', k * 0.3, [p(-1.4, -0.5), p(0, 1.2), p(1.4, -0.5)]);
  line('#8a5a2b', k * 0.3, [p(0, 1.2), p(0, 2.2)]);
  at(sx, sy + k * 2.9, () => paintMole(ctx, k * 0.95, 0.3));
  line('#3b2a24', k * 0.12, [p(-1.4, -0.5), p(-0.55, 0.45)]);
  line('#3b2a24', k * 0.12, [p(1.4, -0.5), p(0.55, 0.45)]);
  ctx.setLineDash([2, 5]);
  line('rgba(255,255,255,.75)', 2, [[sx, sy - r * 1.1], [W / 2 + r, row(1) + r * 0.9]]);
  ctx.setLineDash([]);
  line('rgba(255,255,255,.4)', 2, () => ctx.arc(W / 2 + r, row(1), r * 0.85, 0, Math.PI * 2));
  at(sx, sy, () => paintGem(ctx, GEMS[2], r * 0.85));
  line('#3b2a24', k * 0.18, () => ctx.arc(sx, sy, r * 0.95, Math.PI * 0.2, Math.PI * 0.8));
  ctx.lineCap = 'butt';
  return rect;
}
