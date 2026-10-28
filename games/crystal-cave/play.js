// Crystal Cave in play: the drawing (the cave walls and the rock the roof
// hangs from, which comes down as the roof creeps; the crystals as faceted
// gems with a glow, drawn once each to a sprite; stone, and the power-ups the
// cart pays; the mole in his hard hat with the catapult, his headlamp lighting
// the way; the cart; the line at the bottom), the aim and its dotted guide,
// the shot in flight, the shatter and the fall into the cart, a cave-in, and
// the roof cleared. The engine holds the game; this only shows it.
import { newGame, fire, swap, trace, cloneGame, KINDS, W, H, R, ROW_H, DEAD_ROW, SHOOT, AIM_MAX, CART, cellX, cellY } from './engine.js';

// The colours of the crystals, by colour number: ruby, amber, emerald,
// sapphire, amethyst, citrine.
export const GEMS = ['#ff4f7d', '#ffb13b', '#3ddc84', '#3fa9ff', '#b06bff', '#f6e94b'];
const STONE = '#8a8794';
const POWER = { blast: '#ff6b3b', prism: '#ffffff', drill: '#c9d3e0' };
const CAVE = { ink: '#f3eaff', dim: 'rgba(243,234,255,.55)', line: '#ff6b7b' };
const HUD = { h: 30, font: 'ui-monospace, Menlo, Consolas, monospace' };

// ------------------------------------------------------------------ chambers
//
// The cave changes every five levels: each chamber is a palette (the far
// wall, the near rock at the sides, the roof's rock and its lit edge, the
// floor), its dressing on the walls and floor (`dress`, drawn behind the
// game; the middle of the screen is left quiet so the shot reads), and
// what drifts in its air (`motes`). Adding a chamber is adding to this
// table. L is the layout: ox, oy, scale, the canvas size, the floor's y.
const CHAMBERS = [
  {
    // A lamplit mine: timber props at the walls, a lantern on each, rails
    // under the cart, dust in the air.
    name: 'mine', far: '#2c1f44', near: '#4a3368', rock: '#5b4a78', edge: '#7c68a3', floor: '#3b2b55', floorEdge: '#5b4a78',
    motes: { n: 18, colour: 'rgba(255,220,160,.35)', size: 1.6, rise: -2, sway: 3 },
    dress(ctx, L, t) {
      const { ox, scale, cssW, floorY } = L;
      const r = scale * R;
      for (const side of [-1, 1]) {
        const x = side < 0 ? Math.max(ox, 0) + r * 0.9 : Math.min(ox + W * scale, cssW) - r * 0.9;
        // The prop: a post from the floor up into the dark, a lantern hung on it.
        const top = floorY - r * 7;
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(x - r * 0.28, top, r * 0.56, floorY - top);
        ctx.fillStyle = '#6f4a2c';
        ctx.fillRect(x - r * 0.28, top, r * 0.18, floorY - top);
        const ly = top + r * 1.6;
        const flicker = 0.85 + 0.15 * Math.sin(t * 7 + side);
        const glow = ctx.createRadialGradient(x, ly, 0, x, ly, r * 4.5);
        glow.addColorStop(0, `rgba(255,190,90,${0.35 * flicker})`);
        glow.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - r * 4.5, ly - r * 4.5, r * 9, r * 9);
        ctx.strokeStyle = '#2a1a10';
        ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(x, top + r * 0.4);
        ctx.lineTo(x, ly - r * 0.6);
        ctx.stroke();
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(x - r * 0.32, ly - r * 0.6, r * 0.64, r * 1.1);
        ctx.fillStyle = `rgba(255,214,120,${0.7 + 0.3 * flicker})`;
        ctx.fillRect(x - r * 0.2, ly - r * 0.42, r * 0.4, r * 0.75);
      }
      // Rails along the floor.
      ctx.strokeStyle = '#6a5a62';
      ctx.lineWidth = Math.max(1, r * 0.1);
      for (const dy of [r * 0.55, r * 0.95]) {
        ctx.beginPath();
        ctx.moveTo(0, floorY + dy);
        ctx.lineTo(cssW, floorY + dy);
        ctx.stroke();
      }
    },
  },
  {
    // An ice grotto: blue and white, icicles under the roof, frost and
    // snow heaped at the walls, a frozen pool shining on the floor, snow
    // drifting down.
    name: 'ice', far: '#162a4e', near: '#243f6e', rock: '#35578c', edge: '#a9dcff', floor: '#2c4d7e', floorEdge: '#bfe4ff',
    motes: { n: 26, colour: 'rgba(255,255,255,.7)', size: 1.8, rise: 2.5, sway: 6 },
    dress(ctx, L, t) {
      const { ox, oy, scale, cssW, floorY } = L;
      const r = scale * R;
      // Big faint ice crystals set into the far wall, low at the sides.
      ctx.fillStyle = 'rgba(170,220,255,.1)';
      for (const [sx, h, w] of [[0.06, 9, 2.2], [0.14, 5, 1.6], [0.9, 7, 2], [0.82, 4, 1.4]]) {
        const x = sx * cssW;
        ctx.beginPath();
        ctx.moveTo(x, floorY);
        ctx.lineTo(x - w * r, floorY - h * r * 0.35);
        ctx.lineTo(x - w * r * 0.3, floorY - h * r);
        ctx.lineTo(x + w * r * 0.4, floorY - h * r * 0.8);
        ctx.lineTo(x + w * r, floorY - h * r * 0.2);
        ctx.closePath();
        ctx.fill();
      }
      // Snow heaped against the walls.
      ctx.fillStyle = '#dff1ff';
      for (const side of [-1, 1]) {
        const x = side < 0 ? 0 : cssW;
        ctx.beginPath();
        ctx.moveTo(x, floorY + r * 0.2);
        ctx.quadraticCurveTo(x - side * r * 2, floorY - r * 1.6, x - side * r * 4.5, floorY + r * 0.2);
        ctx.closePath();
        ctx.fill();
      }
      // The frozen pool: a pale sheen across the floor, a glint sliding over it.
      const sheen = ctx.createLinearGradient(0, floorY, cssW, floorY + r);
      const g = (Math.sin(t * 0.6) + 1) / 2;
      sheen.addColorStop(Math.max(0, g - 0.2), 'rgba(255,255,255,.04)');
      sheen.addColorStop(g, 'rgba(255,255,255,.22)');
      sheen.addColorStop(Math.min(1, g + 0.2), 'rgba(255,255,255,.04)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, floorY + r * 0.2, cssW, r * 1.2);
    },
    // Icicles under the rock's edge, drawn with the roof.
    fringe(ctx, x0, x1, y, r) {
      ctx.fillStyle = '#cfeaff';
      for (let x = x0 + r * 0.6; x < x1; x += r * 1.35) {
        const h = r * (0.5 + 0.45 * Math.abs(Math.sin(x * 0.37)));
        ctx.beginPath();
        ctx.moveTo(x - r * 0.2, y - 1);
        ctx.lineTo(x + r * 0.2, y - 1);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.fill();
      }
    },
  },
  {
    // A lava vault: black basalt, columns of it low at the walls, a glowing
    // seam along the floor and cracks running up from it, the far wall lit
    // red from below, embers rising.
    name: 'lava', far: '#1a0d12', near: '#2a1418', rock: '#3a1f22', edge: '#ff7a3c', floor: '#2a1416', floorEdge: '#ff6a2c',
    motes: { n: 22, colour: 'rgba(255,140,60,.8)', size: 1.6, rise: -5, sway: 4 },
    dress(ctx, L, t) {
      const { scale, cssW, floorY } = L;
      const r = scale * R;
      const pulse = 0.75 + 0.25 * Math.sin(t * 1.8);
      // The far wall lit red from the lava below.
      const under = ctx.createLinearGradient(0, floorY - r * 3, 0, floorY);
      under.addColorStop(0, 'rgba(255,80,30,0)');
      under.addColorStop(1, `rgba(255,80,30,${0.26 * pulse})`);
      ctx.fillStyle = under;
      ctx.fillRect(0, floorY - r * 3, cssW, r * 3);
      // Basalt columns low at the walls, the tallest outermost, each lit on top.
      for (const [dx, h, w] of [[0, 4.2, 0.9], [0.95, 2.9, 0.8], [1.8, 1.7, 0.75]]) {
        for (const x of [dx * r, cssW - (dx + w) * r]) {
          ctx.fillStyle = '#120709';
          ctx.fillRect(x, floorY - h * r, w * r, h * r);
          ctx.fillStyle = '#24100f';
          ctx.fillRect(x + w * r * 0.15, floorY - h * r, w * r * 0.2, h * r);
          ctx.fillStyle = '#6a3328';
          ctx.fillRect(x, floorY - h * r, w * r, Math.max(1, r * 0.16));
        }
      }
      // The cracks, each a bright line in a soft glow, breathing: a seam along
      // the floor's edge, and two short ones up each wall (a pool of light at the foot).
      ctx.lineJoin = 'round';
      const crack = (pts) => {
        ctx.beginPath();
        for (const [x, y] of pts) ctx.lineTo(x, y);
        for (const [w, rgb, a] of [[0.45, '255,90,30', 0.18], [0.17, '255,122,60', 0.5], [0.06, '255,220,150', 1]]) {
          ctx.strokeStyle = `rgba(${rgb},${a * pulse})`;
          ctx.lineWidth = Math.max(1, w * r);
          ctx.stroke();
        }
      };
      crack(Array.from({ length: Math.ceil(cssW / (r * 0.7)) + 2 }, (_, k) => [k * r * 0.7, floorY + r * (0.45 + 0.15 * Math.sin(k * r * 0.63))]));
      for (const x of [r * 0.5, r * 2.2, cssW - r * 0.5, cssW - r * 2.2]) {
        const pool = ctx.createRadialGradient(x, floorY, 0, x, floorY, r * 1.6);
        pool.addColorStop(0, `rgba(255,110,40,${0.35 * pulse})`);
        pool.addColorStop(1, 'rgba(255,110,40,0)');
        ctx.fillStyle = pool;
        ctx.fillRect(x - r * 1.6, floorY - r * 1.6, r * 3.2, r * 3.2);
        const inward = Math.sign(cssW / 2 - x); // the right wall's cracks are the left's, mirrored
        crack([[0, 0], [0.08, 0.5], [-0.12, 0.8], [-0.05, 1.5], [0.18, 1.8], [0.1, 2.4]].map(([dx, dy]) => [x + dx * r * inward, floorY - dy * r]));
      }
      ctx.lineJoin = 'miter';
    },
  },
  {
    // A mushroom hollow: toadstools glowing at the walls, shelves of fungus
    // above them, a teal light low on the far wall, spores drifting up.
    name: 'mushroom', far: '#0f2a2e', near: '#174247', rock: '#1f5559', edge: '#7af0d8', floor: '#143a3d', floorEdge: '#5ce0c8',
    motes: { n: 24, colour: 'rgba(150,255,230,.6)', size: 2, rise: -1.2, sway: 8 },
    dress(ctx, L, t) {
      const { scale, cssW, floorY } = L;
      const r = scale * R;
      const breathe = 0.8 + 0.2 * Math.sin(t * 1.3);
      // A teal light low on the far wall.
      const low = ctx.createLinearGradient(0, floorY - r * 3, 0, floorY);
      low.addColorStop(0, 'rgba(92,224,200,0)');
      low.addColorStop(1, 'rgba(92,224,200,.16)');
      ctx.fillStyle = low;
      ctx.fillRect(0, floorY - r * 3, cssW, r * 3);
      const caps = [['#ff7fb6', '255,127,182'], ['#5ce0c8', '92,224,200']]; // the cap, and its glow
      for (const side of [-1, 1]) {
        const wx = (dx) => (side < 0 ? dx * r : cssW - dx * r);
        // Shelves of fungus on the wall, a little higher (half-ellipses, flat side up).
        for (const [dy, w] of [[4.4, 1.3], [5.6, 0.9], [6.9, 1.1]]) {
          const y = floorY - (dy + (side > 0 ? 0.6 : 0)) * r;
          ctx.fillStyle = '#2f8f86';
          ctx.beginPath();
          ctx.ellipse(wx(0), y, w * r, w * r * 0.4, 0, 0, Math.PI);
          ctx.fill();
          ctx.fillStyle = '#7af0d8';
          ctx.fillRect(wx(0) - w * r, y - 1, w * r * 2, Math.max(1, r * 0.08));
        }
        // The toadstools: a pale stalk, a domed cap with spots, a glow under it.
        for (const [dx, h, cr, c] of [[0.8, 2.6, 0.95, 0], [1.75, 1.5, 0.62, 1], [2.55, 0.35, 0.34, 0], [1.2, 0.6, 0.32, 1]]) {
          const [x, top, s] = [wx(dx), floorY - h * r, cr * r];
          const [cap, rgb] = caps[side > 0 ? 1 - c : c];
          const glow = ctx.createRadialGradient(x, top, 0, x, top, s * 2.4);
          glow.addColorStop(0, `rgba(${rgb},${0.45 * breathe})`);
          glow.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = glow;
          ctx.fillRect(x - s * 2.4, top - s * 2.4, s * 4.8, s * 4.8);
          ctx.fillStyle = '#e9fbf4';
          ctx.fillRect(x - s * 0.22, top, s * 0.44, h * r);
          ctx.fillStyle = cap;
          ctx.beginPath();
          ctx.ellipse(x, top, s, s * 0.78, 0, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.8)';
          for (const [sx, sy, d] of [[-0.45, -0.35, 0.14], [0.15, -0.58, 0.11], [0.52, -0.22, 0.1]]) {
            ctx.beginPath();
            ctx.arc(x + sx * s, top + sy * s, d * s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
  },
  {
    // A cenote: an underground pool under a shaft of daylight (kept to the
    // right wall), ripples of light on the water, lily pads, roots hanging
    // down the left wall, dust turning in the sun.
    name: 'cenote', far: '#10324a', near: '#174866', rock: '#245c7a', edge: '#bfe8ff', floor: '#1d6b80', floorEdge: '#9fe7ff',
    motes: { n: 14, colour: 'rgba(255,255,255,.5)', size: 1.4, rise: 3, sway: 2 },
    dress(ctx, L, t) {
      const { oy, scale, cssW, cssH, floorY } = L;
      const r = scale * R;
      const blob = (x, y, rx, ry, turn = 0, a0 = 0, a1 = Math.PI * 2) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.ellipse(x, y, rx, ry, turn, a0, a1); ctx.fill(); };
      // The shaft of daylight from the top-right corner down to the water (a
      // broad soft beam and a brighter core in it), and the light where it lands.
      const sun = ctx.createLinearGradient(0, 0, 0, floorY);
      sun.addColorStop(0, 'rgba(255,255,240,.1)');
      sun.addColorStop(1, 'rgba(255,255,240,.02)');
      ctx.fillStyle = sun;
      for (const quad of [[1.8, -1, 0.4, 3], [1.2, -0.2, 1, 2.3]]) {
        ctx.beginPath();
        quad.forEach((dx, k) => ctx.lineTo(cssW - dx * r, k < 2 ? 0 : floorY)); // two corners at the top, two on the floor
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,240,.12)';
      blob(cssW - r * 1.7, floorY + r * 0.5, r * 1.4, r * 0.3);
      // Light on the water: pale ripples drifting across.
      ctx.fillStyle = 'rgba(200,245,255,.22)';
      for (let k = 0, span = cssW + r * 4; k < 7; k++) {
        const x = ((k * 0.37 * span + t * r * (0.4 + 0.15 * (k % 3))) % span) - r * 2;
        blob(x, floorY + Math.min(cssH - floorY - r * 0.2, r * (0.45 + 1.4 * ((k * 0.61) % 1))), r * (0.7 + 0.4 * (k % 2)), Math.max(1, r * 0.1));
      }
      // Lily pads (a notch cut from each), a flower on one.
      ctx.fillStyle = '#3aa86a';
      blob(r * 1.6, floorY + r * 1.2, r * 0.9, r * 0.36, 0, 0.35, Math.PI * 2 - 0.1);
      blob(cssW - r * 2.2, floorY + r * 0.8, r * 0.68, r * 0.27, 0, 0.35, Math.PI * 2 - 0.1);
      ctx.fillStyle = '#ffb3d1';
      blob(r * 1.4, floorY + r * 1.08, r * 0.2, r * 0.2);
      // Roots hanging down the left wall from the roof, swaying a little, leafed.
      ctx.strokeStyle = '#1e4d2c';
      ctx.lineWidth = Math.max(1, r * 0.12);
      for (const [x0, len, ph] of [[r * 0.4, 14, 0], [r * 1.3, 9, 2], [r * 2.2, 6, 4]]) {
        const pts = [];
        for (let k = 0; k <= len * 2; k++) pts.push([x0 + Math.sin(k * 0.6 + ph + t * 0.7) * r * 0.25 * (k / (len * 2)), oy + k * r * 0.5]);
        ctx.beginPath();
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = '#4fbf6a';
        for (let k = 2; k < pts.length; k += 3) {
          const side = k % 6 === 2 ? -1 : 1;
          blob(pts[k][0] + side * r * 0.22, pts[k][1], r * 0.28, r * 0.12, side * 0.6);
        }
      }
    },
  },
];
export const chamberFor = (n) => CHAMBERS[Math.floor((n - 1) / 5) % CHAMBERS.length];

// Every tenth level from 15, the lights are out: the roof shows only in
// the headlamp's beam, which follows the aim. (Par is the same -- the
// computer miner needs no light.)
export const lightsOut = (n) => n >= 15 && n % 10 === 5;
const BEAM = { narrow: (11 * Math.PI) / 180, wide: (20 * Math.PI) / 180, dark: 0.9, dusk: 0.5 }; // the beam's two cones (half-angles) and how dark it is outside them
const VIEW_H = SHOOT.y + 4.6 * R; // the board with the mole under it
const NEXT = { x: SHOOT.x + 3.6, y: SHOOT.y + 1.1 }; // where the next crystal waits
const FLY = 42; // the shot's speed (units per second)
const FALL = 60; // how fast a dropped crystal picks up speed (units/s^2)
const CREEP_T = 0.35; // the roof takes this long to come down a row (s)
const SPARKS = 10; // sparks a shattered crystal throws
const PARTY = { gems: 70, spread: 30, card: 1.4 }; // the roof cleared: gems showering from this far above, and the card after this long (s)
const HOP = { t: 0.5, h: 0.9 }; // the mole's jump: how long (s) and how high (units)
const YAWN = { t: 1.6 }; // the bat's yawn (s)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// A six-sided gem, pointy-top, in the colour, with a lighter top-left
// facet, a darker bottom-right, and a highlight: the one picture of a
// crystal, drawn at radius r about (0, 0).
export function paintGem(ctx, colour, r, glow = true) {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  if (glow) {
    const halo = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.45);
    halo.addColorStop(0, colour + 'aa');
    halo.addColorStop(1, colour + '00');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  // Facets: the top-left three catch the lamp, the bottom-right fall away.
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(...pts[5]);
  ctx.lineTo(...pts[0]);
  ctx.lineTo(...pts[1]);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(...pts[2]);
  ctx.lineTo(...pts[3]);
  ctx.lineTo(...pts[4]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

// A lump of stone: grey, rounded, a crack across it.
export function paintStone(ctx, r) {
  ctx.fillStyle = STONE;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.3);
  ctx.quadraticCurveTo(-r * 0.6, -r, r * 0.2, -r * 0.9);
  ctx.quadraticCurveTo(r, -r * 0.7, r * 0.92, r * 0.1);
  ctx.quadraticCurveTo(r * 0.8, r * 0.95, -r * 0.1, r * 0.92);
  ctx.quadraticCurveTo(-r, r * 0.8, -r * 0.9, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.25, -r * 0.35, r * 0.4, r * 0.25, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, r * 0.1);
  ctx.lineTo(-r * 0.1, r * 0.35);
  ctx.lineTo(r * 0.2, r * 0.15);
  ctx.lineTo(r * 0.55, r * 0.5);
  ctx.stroke();
}

// How each kind of crystal looks and behaves in the air: its colour (for
// sparks), `paint(ctx, r)` drawing it about the origin, whether it turns to
// the aim in flight and throws sparks as it goes, and the shake when it
// lands. A kind the table doesn't know is painted loud (a magenta gem with
// a question mark), never quietly as something else. Adding a kind to the
// engine is adding its look here.
export const LOOKS = {
  gem: { colour: (c) => GEMS[c.colour], paint: (ctx, r, c) => paintGem(ctx, GEMS[c.colour], r) },
  stone: { colour: () => STONE, paint: (ctx, r) => paintStone(ctx, r) },
  // A blast: a hot orange gem with a burst on it; the cave shakes when it goes off.
  blast: {
    colour: () => POWER.blast,
    shake: 0.5,
    paint(ctx, r) {
      paintGem(ctx, POWER.blast, r);
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = r * 0.12;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const len = k % 2 ? r * 0.42 : r * 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.15, Math.sin(a) * r * 0.15);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
      }
    },
  },
  // A prism: a white gem with a rainbow across it.
  prism: {
    colour: () => POWER.prism,
    paint(ctx, r) {
      paintGem(ctx, POWER.prism, r);
      const band = ctx.createLinearGradient(-r * 0.7, r * 0.5, r * 0.7, -r * 0.5);
      GEMS.slice(0, 5).forEach((c, k) => band.addColorStop(k / 4, c));
      ctx.strokeStyle = band;
      ctx.lineWidth = r * 0.26;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.4);
      ctx.lineTo(r * 0.55, -r * 0.4);
      ctx.stroke();
      ctx.lineCap = 'butt';
    },
  },
  // A drill: a steel bit, point up, turning to the aim and throwing sparks as it bores.
  drill: {
    colour: () => POWER.drill,
    spins: true,
    sparks: true,
    paint(ctx, r) {
      const halo = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.4);
      halo.addColorStop(0, 'rgba(201,211,224,.55)');
      halo.addColorStop(1, 'rgba(201,211,224,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = POWER.drill;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.7, r * 0.3);
      ctx.lineTo(r * 0.5, r * 0.9);
      ctx.lineTo(-r * 0.5, r * 0.9);
      ctx.lineTo(-r * 0.7, r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,50,70,.6)';
      ctx.lineWidth = r * 0.1;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5 + k * r * 0.15, r * (0.35 - k * 0.3));
        ctx.lineTo(r * 0.5 - k * r * 0.15, r * (0.2 - k * 0.3));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.6);
      ctx.lineTo(-r * 0.4, r * 0.2);
      ctx.lineTo(-r * 0.25, r * 0.2);
      ctx.closePath();
      ctx.fill();
    },
  },
};
const UNKNOWN = {
  colour: () => '#ff00ff',
  paint(ctx, r, c) {
    paintGem(ctx, '#ff00ff', r);
    ctx.fillStyle = '#000';
    ctx.font = `900 ${r * 1.2}px ${HUD.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, r * 0.05);
  },
};
export const lookOf = (crystal) => LOOKS[crystal.kind] ?? UNKNOWN;

// The mole: a round brown fellow in a yellow hard hat with a headlamp,
// pink nose, two eyes that look where he aims, drawn with his feet at the
// origin, r his body's radius.
export function paintMole(ctx, r, look = 0) {
  ctx.fillStyle = '#6b4a3a';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.9, r, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8b6a56';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.7, r * 0.62, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hands up on the catapult.
  ctx.fillStyle = '#e8b89a';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * r * 0.95, -r * 1.3, r * 0.22, r * 0.17, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes, looking where he aims, and the nose.
  ctx.fillStyle = '#1b1020';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * r * 0.3 + look * r * 0.12, -r * 1.05, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff8fb0';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.78, r * 0.2, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath();
  ctx.arc(-r * 0.06, -r * 0.83, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
  // The hard hat and its lamp.
  ctx.fillStyle = '#ffcf3b';
  ctx.beginPath();
  ctx.arc(0, -r * 1.35, r * 0.78, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-r * 0.95, -r * 1.42, r * 1.9, r * 0.14);
  ctx.fillStyle = '#e0a800';
  ctx.fillRect(-r * 0.1, -r * 2.1, r * 0.2, r * 0.7);
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  ctx.arc(0, -r * 1.75, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

export class Play {
  constructor(canvas, level, hooks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = level;
    this.hooks = hooks;
    this.paused = false;
    this.timeScale = 1; // the browser tests fast-forward
    this.sprites = new Map();
    this.chamber = chamberFor(level.n);
    this.dark = lightsOut(level.n);
    this.motes = [];
    this.reset();
    this.resize();
    this.last = performance.now();
    const loop = (now) => {
      // (A first frame's time can be from just before the constructor ran.)
      const dt = clamp((now - this.last) / 1000, 0, 0.05) * this.timeScale;
      this.last = now;
      if (!this.paused) this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // A fresh go at the level.
  reset() {
    this.game = newGame(this.level);
    this.shown = this.game.cells; // what's drawn: the roof before the shot, until it lands
    this.aim = 0;
    this.aiming = false;
    this.flight = null; // the shot on its way: { path, at, crystal, ev, before }
    this.sparks = [];
    this.falling = [];
    this.shift = 0; // the roof as drawn, easing toward the game's
    this.creeping = null; // { from, t }
    this.outcome = null; // 'cleared' | 'cavein', once the picture has caught up
    this.collapse = null; // the cave-in: every crystal falling
    this.shake = 0;
    this.demo = false; // SHOW ME: the computer miner's run
    this.demoAt = 0;
    this.demoWait = 0;
    this.time = 0;
    this.paid = null; // a power-up just paid, for a moment's notice
    this.paidT = 0;
    this.hop = 0; // the mole's jump for joy, seconds since
    this.party = null; // the roof cleared: { t, gems } -- a shower of gems and the banner
    this.yawn = 0; // the bat's yawn, seconds since
  }

  // Watch the computer miner do it, from the start.
  showMe() {
    this.reset();
    this.demo = true;
    this.demoWait = 0.6;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  // Can a shot be fired now?
  get ready() {
    return !this.flight && !this.creeping && !this.outcome && !this.collapse && !this.game.over;
  }

  // Aim at a point on the canvas (CSS pixels): the angle from the catapult
  // to it, within the arc.
  aimAt(px, py) {
    const [x, y] = this.toBoard(px, py);
    const dx = x - SHOOT.x;
    const dy = SHOOT.y - y;
    if (dy < 0.5) return false; // (below the catapult: nowhere to aim)
    this.aim = clamp(Math.atan2(dx, dy), -AIM_MAX, AIM_MAX);
    return true;
  }

  // Is this point (CSS pixels) on the loaded crystal? (A tap there swaps.)
  onLoaded(px, py) {
    const [x, y] = this.toBoard(px, py);
    return Math.hypot(x - SHOOT.x, y - SHOOT.y) < R * 1.8;
  }

  // Or on the NEXT bucket? (A tap there swaps too: it's what players reach for.)
  onNext(px, py) {
    const [x, y] = this.toBoard(px, py);
    return Math.hypot(x - NEXT.x, y - NEXT.y) < R * 1.8;
  }

  swap() {
    if (!this.ready) return;
    swap(this.game);
    this.hooks.sfx?.('tap');
  }

  fire(angle = this.aim) {
    if (!this.ready || this.paused) return null;
    const before = cloneGame(this.game).cells;
    const ev = fire(this.game, angle);
    if (!ev) return null;
    this.shown = before;
    this.flight = { path: ev.path, at: 0, crystal: ev.crystal, ev, before, len: pathLength(ev.path) };
    this.hooks.sfx?.('twang');
    this.hooks.haptic?.(15);
    this.hooks.onShot?.(this.game.shots);
    return ev;
  }

  // The shot has arrived: the roof as the engine has it, the shatter, the
  // fall, and the roof's creep if it crept.
  land() {
    const { ev } = this.flight;
    this.flight = null;
    this.shown = this.game.cells;
    const shift = this.game.shift - (ev.crept ? 1 : 0);
    for (const [r, c, crystal] of ev.shattered) {
      const x = cellX(r, c);
      const y = cellY(r, shift);
      for (let k = 0; k < SPARKS; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = 4 + Math.random() * 10;
        this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, t: 0, life: 0.35 + Math.random() * 0.3, colour: crystalColour(crystal) });
      }
    }
    for (const [r, c, crystal] of ev.dropped) {
      this.falling.push({ x: cellX(r, c), y: cellY(r, shift), vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3, spin: (Math.random() - 0.5) * 8, a: 0, crystal, t: 0 });
    }
    if (ev.shattered.length) {
      this.hooks.sfx?.('shatter', ev.shattered.length);
      this.hooks.haptic?.(ev.shattered.length > 5 ? 40 : 20);
      this.shake = Math.max(this.shake, lookOf(ev.crystal).shake ?? 0);
    } else if (ev.landed) this.hooks.sfx?.('stick');
    if (ev.paid) {
      this.paid = ev.paid;
      this.paidT = 0;
      this.hop = 0.001;
      this.hooks.sfx?.('cartfull');
    }
    if (ev.crept) this.creeping = { from: this.shift, t: 0 };
    if (ev.over === 'cavein') {
      this.collapse = { t: 0, cells: this.game.cells.map((row, r) => row.map((cell, c) => (cell ? { crystal: cell, x: cellX(r, c), y: cellY(r, this.game.shift), vy: -1 - Math.random() * 2, delay: Math.random() * 0.25 } : null)).filter(Boolean)).flat() };
      this.shake = 1;
      this.hooks.sfx?.('rumble');
      this.hooks.haptic?.([60, 40, 80]);
    }
    if (ev.over === 'cleared') {
      // The celebration: a shower of gems from the roof, the banner, the
      // mole jumping, the bat waking; the card comes after.
      this.outcome = 'cleared';
      this.party = { t: 0, gems: [] };
      for (let k = 0; k < PARTY.gems; k++) {
        this.party.gems.push({ x: Math.random() * W, y: -R - Math.random() * PARTY.spread, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 6, spin: (Math.random() - 0.5) * 10, a: 0, crystal: { kind: 'gem', colour: Math.floor(Math.random() * 5) }, size: 0.45 + Math.random() * 0.4 });
      }
      this.hop = 0.001;
      this.yawn = 0.001;
      this.hooks.sfx?.('win');
      this.hooks.haptic?.(40);
    }
  }

  update(dt) {
    this.time += dt;
    if (this.flight) {
      this.flight.at += FLY * dt;
      const look = lookOf(this.flight.crystal);
      if (look.sparks) {
        const [x, y] = pointAlong(this.flight.path, this.flight.at);
        for (let k = 0; k < 2; k++) this.sparks.push({ x, y, vx: (Math.random() - 0.5) * 8, vy: 4 + Math.random() * 6, t: 0, life: 0.25 + Math.random() * 0.2, colour: k ? '#fff3c4' : look.colour(this.flight.crystal) });
      }
      if (this.flight.at >= this.flight.len) this.land();
    }
    if (this.creeping) {
      this.creeping.t += dt;
      const u = ease(this.creeping.t / CREEP_T);
      this.shift = this.creeping.from + u;
      if (u >= 1) {
        this.shift = this.game.shift;
        this.creeping = null;
      }
    }
    for (const s of this.sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 20 * dt;
    }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    for (const f of this.falling) {
      f.t += dt;
      f.vy += FALL * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.a += f.spin * dt;
      if (f.y > H + R && !f.done) {
        f.done = true;
        this.hooks.sfx?.('clink');
      }
    }
    this.falling = this.falling.filter((f) => f.y < H + 3 * R);
    if (this.paid) {
      this.paidT += dt;
      if (this.paidT > 1.6) this.paid = null;
    }
    if (this.hop) this.hop = this.hop + dt > HOP.t ? 0 : this.hop + dt;
    if (this.yawn) this.yawn = this.yawn + dt > YAWN.t ? 0 : this.yawn + dt;
    if (this.party) {
      this.party.t += dt;
      for (const g of this.party.gems) {
        g.vy += FALL * 0.4 * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.a += g.spin * dt;
      }
      if (this.party.t > PARTY.card && !this.party.told) {
        this.party.told = true;
        this.hooks.onCleared?.({ shots: this.game.shots, par: this.level.par });
      }
    }
    if (this.collapse) {
      this.collapse.t += dt;
      for (const c of this.collapse.cells) {
        if (this.collapse.t < c.delay) continue;
        c.vy += FALL * dt;
        c.y += c.vy * dt;
      }
      if (this.collapse.t > 1.2 && !this.outcome) {
        this.outcome = 'cavein';
        this.hooks.onCaveIn?.({ shots: this.game.shots });
      }
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const m = this.chamber.motes;
    for (const mote of this.motes) {
      mote.p += dt;
      mote.y += m.rise * mote.s * dt * this.scale * 0.5;
      mote.x += Math.sin(mote.p) * m.sway * dt;
      if (mote.y < -4) mote.y = this.cssH + 2;
      if (mote.y > this.cssH + 4) mote.y = -2;
    }
    // The demo: the computer miner's shots, one after another as each lands.
    if (this.demo && this.ready) {
      this.demoWait -= dt;
      if (this.demoWait <= 0) {
        const angle = this.level.solution[this.demoAt++];
        if (angle === undefined) this.demo = false;
        else {
          this.aim = angle;
          this.fire(angle);
          this.demoWait = 0.45;
        }
      }
    }
  }

  // --------------------------------------------------------------- drawing

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    // The board fits under the instrument band, centred across, the roof
    // close under the band (what's left over goes under the mole).
    const top = HUD.h;
    this.scale = Math.min(this.cssW / W, (this.cssH - top) / VIEW_H);
    this.ox = (this.cssW - W * this.scale) / 2;
    this.oy = top + Math.min(R * this.scale, (this.cssH - top - VIEW_H * this.scale) / 2);
    this.floorY = this.oy + (SHOOT.y + 3.9 * R) * this.scale; // where the mole stands
    this.sprites.clear();
    // What drifts in this chamber's air, scattered afresh.
    const m = this.chamber.motes;
    this.motes = [];
    for (let k = 0; k < m.n; k++) this.motes.push({ x: Math.random() * this.cssW, y: Math.random() * this.cssH, p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 0.8 });
  }

  toBoard(px, py) {
    return [(px - this.ox) / this.scale, (py - this.oy) / this.scale];
  }

  // A crystal's picture at the board's scale, drawn once and kept.
  sprite(crystal) {
    const key = crystal.kind === 'gem' ? `g${crystal.colour}` : crystal.kind;
    let s = this.sprites.get(key);
    if (s) return s;
    const r = R * this.scale;
    const size = Math.ceil(r * 3.2);
    s = document.createElement('canvas');
    s.width = s.height = Math.round(size * this.dpr);
    const c = s.getContext('2d');
    c.scale(this.dpr, this.dpr);
    c.translate(size / 2, size / 2);
    lookOf(crystal).paint(c, r * 0.94, crystal);
    s.size = size;
    this.sprites.set(key, s);
    return s;
  }

  drawCrystal(ctx, crystal, x, y, angle = 0, scale = 1) {
    const s = this.sprite(crystal);
    ctx.save();
    ctx.translate(this.ox + x * this.scale, this.oy + y * this.scale);
    if (angle) ctx.rotate(angle);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.drawImage(s, -s.size / 2, -s.size / 2, s.size, s.size);
    ctx.restore();
  }

  draw() {
    const ctx = this.ctx;
    const { cssW, cssH, scale, ox, oy } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * this.shake, (Math.random() - 0.5) * 8 * this.shake);
    this.drawScene(ctx);
    // The line a crystal mustn't cross: the foot of the last safe row.
    const dead = oy + (cellY(DEAD_ROW - 1) + R) * scale;
    ctx.strokeStyle = CAVE.line;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox, dead);
    ctx.lineTo(ox + W * scale, dead);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // The guide: the shot's way to its first bounce, and where it would
    // land if that's before one.
    if (this.ready && !this.demo) this.drawGuide(ctx);
    // The roof.
    const shift = this.shift;
    const cells = this.collapse ? [] : this.shown; // (the roof before the shot, while it flies)
    cells.forEach((row, r) => row.forEach((cell, c) => {
      if (cell) this.drawCrystal(ctx, cell, cellX(r, c), cellY(r, shift));
    }));
    if (this.collapse) for (const c of this.collapse.cells) this.drawCrystal(ctx, c.crystal, c.x, c.y, c.vy * 0.05);
    for (const f of this.falling) this.drawCrystal(ctx, f.crystal, f.x, f.y, f.a);
    for (const s of this.sparks) {
      const u = 1 - s.t / s.life;
      ctx.globalAlpha = u;
      ctx.fillStyle = s.colour;
      ctx.beginPath();
      ctx.arc(ox + s.x * scale, oy + s.y * scale, R * scale * 0.22 * u + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.party) {
      for (const g of this.party.gems) if (g.y > -R) this.drawCrystal(ctx, g.crystal, g.x, g.y, g.a, g.size);
    }
    // The shot in flight.
    if (this.flight) {
      const [x, y] = pointAlong(this.flight.path, this.flight.at);
      this.drawCrystal(ctx, this.flight.crystal, x, y, lookOf(this.flight.crystal).spins ? headingAlong(this.flight.path, this.flight.at) : 0);
    }
    if (this.dark && !this.outcome && !this.collapse) this.drawDark(ctx);
    this.drawBat(ctx);
    this.drawMole(ctx);
    if (this.party) this.drawBanner(ctx);
    this.drawHud(ctx);
    ctx.restore();
  }

  // ROOF CLEARED! swelling in over the board, then holding.
  drawBanner(ctx) {
    const { cssW, cssH } = this;
    const t = this.party.t;
    // (In quick, out again as the card comes.)
    const u = ease(Math.min(1, t / 0.25)) * (t > PARTY.card - 0.3 ? Math.max(0, (PARTY.card - t) / 0.3) : 1);
    if (u <= 0) return;
    const size = Math.min(cssW * 0.11, 44) * (0.6 + 0.4 * u) * (1 + 0.04 * Math.sin(t * 6));
    ctx.save();
    ctx.globalAlpha = u;
    ctx.font = `900 ${size}px ${HUD.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = size * 0.18;
    ctx.strokeStyle = 'rgba(40,20,70,.85)';
    ctx.strokeText('ROOF CLEARED!', cssW / 2, cssH * 0.38);
    ctx.fillStyle = '#fff3c4';
    ctx.fillText('ROOF CLEARED!', cssW / 2, cssH * 0.38);
    ctx.restore();
  }

  // The bat, hanging from a ledge on the right wall above the line, who
  // yawns when the roof is cleared (a wing stretch and a wide mouth).
  drawBat(ctx) {
    const { scale, ox, oy } = this;
    const r = R * scale * 1.4;
    const x = ox + (W - 1.0 * R) * scale;
    const y = oy + (cellY(DEAD_ROW - 1) - 3.2 * R) * scale;
    // The ledge: a knob of rock out of the wall.
    ctx.fillStyle = this.chamber.rock;
    ctx.beginPath();
    ctx.moveTo(x + r * 1.4, y - r * 0.7);
    ctx.lineTo(x + r * 0.3, y - r * 0.55);
    ctx.lineTo(x - r * 0.6, y - r * 0.3);
    ctx.lineTo(x - r * 0.75, y + r * 0.05);
    ctx.lineTo(x - r * 0.3, y + r * 0.2);
    ctx.lineTo(x + r * 1.4, y + r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.chamber.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const yawn = this.yawn ? Math.sin((this.yawn / YAWN.t) * Math.PI) : 0; // 0..1..0
    const sway = Math.sin(this.time * 1.3) * 0.06;
    ctx.save();
    ctx.translate(x - r * 0.1, y + r * 0.15);
    ctx.rotate(sway);
    // Feet, then the body hanging below them, wings folded (or spread).
    ctx.strokeStyle = '#2a1a3a';
    ctx.lineWidth = r * 0.1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, 0);
    ctx.lineTo(-r * 0.15, r * 0.25);
    ctx.moveTo(r * 0.15, 0);
    ctx.lineTo(r * 0.15, r * 0.25);
    ctx.stroke();
    ctx.fillStyle = '#5a4080';
    for (const sgn of [-1, 1]) {
      // A wing: folded down the body, or stretched out wide in a yawn.
      const spread = yawn;
      ctx.beginPath();
      ctx.moveTo(sgn * r * 0.25, r * 0.35);
      ctx.quadraticCurveTo(sgn * r * (0.45 + 0.8 * spread), r * (0.2 + 0.2 * spread), sgn * r * (0.5 + 1.1 * spread), r * (0.9 - 0.5 * spread));
      ctx.quadraticCurveTo(sgn * r * (0.4 + 0.6 * spread), r * (1.1 - 0.1 * spread), sgn * r * 0.2, r * 1.15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#7a5aa8';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.75, r * 0.3, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a088c8';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.62, r * 0.17, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ears (pointing down, he's upside down), eyes shut unless yawning,
    // and the yawn itself.
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, r * 1.1);
    ctx.lineTo(-r * 0.3, r * 1.4);
    ctx.lineTo(-r * 0.05, r * 1.2);
    ctx.moveTo(r * 0.22, r * 1.1);
    ctx.lineTo(r * 0.3, r * 1.4);
    ctx.lineTo(r * 0.05, r * 1.2);
    ctx.fill();
    ctx.strokeStyle = '#1b1020';
    ctx.lineWidth = r * 0.07;
    if (yawn > 0.2) {
      ctx.fillStyle = '#ffe9a8';
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sgn * r * 0.11, r * 1.0, r * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ff8fb0';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.82, r * 0.08, r * 0.1 * yawn + 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(-r * 0.17, r * 1.0);
      ctx.lineTo(-r * 0.05, r * 1.0);
      ctx.moveTo(r * 0.05, r * 1.0);
      ctx.lineTo(r * 0.17, r * 1.0);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The chamber: the far wall (darker toward the roof, lit from the floor),
  // its dressing, the mole's lamp pooling warm light about him, the near
  // rock either side of the board on a wide screen, the floor, and the
  // rock the roof hangs from.
  drawScene(ctx) {
    const { cssW, cssH, scale, ox, oy, floorY, chamber } = this;
    const L = { ox, oy, scale, cssW, cssH, floorY };
    const wall = ctx.createLinearGradient(0, 0, 0, cssH);
    wall.addColorStop(0, chamber.far);
    wall.addColorStop(1, chamber.near);
    ctx.fillStyle = wall;
    ctx.fillRect(-10, -10, cssW + 20, cssH + 20);
    // The floor the mole stands on.
    ctx.fillStyle = chamber.floor;
    ctx.fillRect(0, floorY, cssW, cssH - floorY + 10);
    ctx.fillStyle = chamber.floorEdge;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, floorY, cssW, 2);
    ctx.globalAlpha = 1;
    chamber.dress(ctx, L, this.time);
    // The lamp: a pool of warm light about the mole and his cart.
    const lx = ox + SHOOT.x * scale;
    const ly = oy + (SHOOT.y + 2) * scale;
    const lamp = ctx.createRadialGradient(lx, ly, scale, lx, ly, scale * 8.5);
    lamp.addColorStop(0, 'rgba(255,214,130,.32)');
    lamp.addColorStop(0.6, 'rgba(255,200,120,.08)');
    lamp.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(lx - scale * 9, ly - scale * 9, scale * 18, scale * 18);
    // What drifts in the air.
    const m = chamber.motes;
    ctx.fillStyle = m.colour;
    for (const mote of this.motes) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(mote.p * 2);
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, m.size * mote.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The near rock either side of the board, to the edges of the screen.
    if (ox > 0) {
      ctx.fillStyle = chamber.near;
      ctx.fillRect(0, 0, ox, cssH);
      ctx.fillRect(ox + W * scale, 0, cssW - ox - W * scale, cssH);
    }
    this.drawRock(ctx, ox, oy, scale);
  }

  // Lights out: everything above the mole is dark but for the headlamp's
  // beam up the aim -- a bright cone, a dimmer one about it.
  drawDark(ctx) {
    const { cssW, scale, ox, oy } = this;
    const sx = ox + SHOOT.x * scale;
    const sy = oy + SHOOT.y * scale;
    const bottom = oy + (SHOOT.y - 1.3 * R) * scale;
    const reach = sy + 10;
    const cone = (half) => {
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.sin(this.aim - half) * reach, sy - Math.cos(this.aim - half) * reach);
      ctx.lineTo(sx + Math.sin(this.aim + half) * reach, sy - Math.cos(this.aim + half) * reach);
      ctx.closePath();
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(-10, -10, cssW + 20, bottom + 10);
    ctx.clip();
    // Dark everywhere but the wide cone...
    ctx.fillStyle = `rgba(8,4,18,${BEAM.dark})`;
    ctx.beginPath();
    ctx.rect(-10, -10, cssW + 20, bottom + 10);
    cone(BEAM.wide);
    ctx.fill('evenodd');
    // ...and dusk in the wide cone but the narrow one.
    ctx.fillStyle = `rgba(8,4,18,${BEAM.dusk})`;
    ctx.beginPath();
    cone(BEAM.wide);
    cone(BEAM.narrow);
    ctx.fill('evenodd');
    ctx.restore();
  }

  // The rock the roof hangs from: a jagged ceiling that comes down as the
  // roof creeps, with a lit edge -- and whatever the chamber hangs from it.
  drawRock(ctx, ox, oy, scale) {
    const edge = oy + (this.shift * ROW_H) * scale;
    const seed = 7;
    ctx.fillStyle = this.chamber.rock;
    ctx.beginPath();
    ctx.moveTo(ox, -10);
    ctx.lineTo(ox, edge);
    const n = 14;
    for (let k = 0; k <= n; k++) {
      const x = ox + (k / n) * W * scale;
      const jag = ((Math.sin(k * seed * 1.7) + Math.cos(k * 2.3)) * 0.18 + 0.1) * R * scale;
      ctx.lineTo(x, edge - jag);
    }
    ctx.lineTo(ox + W * scale, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = this.chamber.edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    this.chamber.fringe?.(ctx, ox, ox + W * scale, edge, R * scale);
  }

  drawGuide(ctx) {
    const { scale, ox, oy } = this;
    const kind = KINDS[this.game.loaded.kind];
    const t = trace(this.game.cells, this.game.shift, this.aim, kind);
    // Up to the first bounce, then a little way on.
    const pts = [];
    let bounced = false;
    for (let k = 0; k < t.path.length; k++) {
      const p = t.path[k];
      if (bounced) {
        const q = t.path[k - 1];
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        const f = Math.min(1, 2.5 / Math.max(d, 1e-6));
        pts.push([q[0] + (p[0] - q[0]) * f, q[1] + (p[1] - q[1]) * f]);
        break;
      }
      pts.push(p);
      if (k > 0 && (p[0] <= R + 1e-6 || p[0] >= W - R - 1e-6) && k < t.path.length - 1) bounced = true;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 7]);
    ctx.lineDashOffset = -this.time * 30;
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(ox + x * scale, oy + y * scale) : ctx.moveTo(ox + x * scale, oy + y * scale)));
    ctx.stroke();
    ctx.setLineDash([]);
    if (!bounced && t.cell && kind.stops) {
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath();
      ctx.arc(ox + cellX(...t.cell) * scale, oy + cellY(t.cell[0], this.game.shift) * scale, R * scale * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // The mole and his catapult, the loaded crystal in its pouch, the next one
  // in the bucket beside him, and the cart on the other side.
  drawMole(ctx) {
    const { scale, ox, oy } = this;
    const sx = ox + SHOOT.x * scale;
    const sy = oy + SHOOT.y * scale;
    const r = R * scale;
    // The catapult: a forked post, turned to the aim, the band drawn back
    // to the pouch.
    ctx.save();
    ctx.translate(sx, sy + r * 1.6);
    ctx.rotate(this.aim);
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.8);
    ctx.lineTo(0, -r * 0.3);
    ctx.lineTo(-r * 1.6, -r * 2.1);
    ctx.moveTo(0, -r * 0.3);
    ctx.lineTo(r * 1.6, -r * 2.1);
    ctx.stroke();
    ctx.strokeStyle = '#3b2a24';
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(-r * 1.6, -r * 2.1);
    ctx.lineTo(0, -r * 1.1);
    ctx.lineTo(r * 1.6, -r * 2.1);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
    // The mole behind it, looking where he aims -- and jumping for joy
    // when the cart's full or the roof's cleared.
    const hop = this.hop ? Math.sin((this.hop / HOP.t) * Math.PI) * HOP.h * r : 0;
    ctx.save();
    ctx.translate(sx, sy + r * 2.9 - hop);
    paintMole(ctx, r * 0.95, this.aim / AIM_MAX);
    ctx.restore();
    // The loaded crystal in the pouch (not while it flies).
    if (!this.flight && !this.outcome && !this.collapse) this.drawCrystal(ctx, this.game.loaded, SHOOT.x, SHOOT.y);
    // Next: in a little bucket to the right.
    const nx = NEXT.x;
    const ny = NEXT.y;
    ctx.fillStyle = '#5a4a3a';
    ctx.beginPath();
    ctx.moveTo(ox + (nx - 1.3) * scale, oy + (ny - 0.3) * scale);
    ctx.lineTo(ox + (nx + 1.3) * scale, oy + (ny - 0.3) * scale);
    ctx.lineTo(ox + (nx + 1.0) * scale, oy + (ny + 1.2) * scale);
    ctx.lineTo(ox + (nx - 1.0) * scale, oy + (ny + 1.2) * scale);
    ctx.closePath();
    ctx.fill();
    if (!this.outcome && !this.collapse) this.drawCrystal(ctx, this.game.next, nx, ny, 0, 0.72);
    ctx.fillStyle = CAVE.dim;
    ctx.font = `600 ${Math.max(9, r * 0.5)}px ${HUD.font}`;
    ctx.textAlign = 'center';
    ctx.fillText('NEXT', ox + nx * scale, oy + (ny + 2.0) * scale);
    // The cart on the left, filling with what's dropped.
    this.drawCart(ctx, SHOOT.x - 4.4, SHOOT.y + 1.4);
  }

  drawCart(ctx, cx, cy) {
    const { scale, ox, oy } = this;
    const x = ox + cx * scale;
    const y = oy + cy * scale;
    const w = 3.0 * scale;
    const h = 1.6 * scale;
    ctx.fillStyle = '#4a3a3a';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 2);
    ctx.lineTo(x + w * 0.4, y + h / 2);
    ctx.lineTo(x - w * 0.4, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a6a6a';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Its fill: a heap of little gems, one per crystal in the cart.
    const n = this.game.cart;
    for (let k = 0; k < n; k++) {
      const gx = x - w * 0.32 + ((k % 6) + 0.5) * (w * 0.64 / 6);
      const gy = y + h * 0.3 - Math.floor(k / 6) * h * 0.3;
      ctx.fillStyle = GEMS[k % 5];
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(2, scale * 0.17), 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#2a2020';
      ctx.beginPath();
      ctx.arc(x + s * w * 0.28, y + h / 2 + 2, Math.max(3, scale * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = CAVE.dim;
    ctx.font = `600 ${Math.max(9, scale * 0.5)}px ${HUD.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(`CART ${n}/${CART}${this.game.owed ? ` +${this.game.owed}` : ''}`, x, y + h / 2 + Math.max(12, scale * 0.9));
    // A power-up just paid: a word about it over the bucket.
    if (this.paid) {
      const u = this.paidT < 0.3 ? this.paidT / 0.3 : this.paidT > 1.2 ? Math.max(0, (1.6 - this.paidT) / 0.4) : 1;
      ctx.globalAlpha = u;
      ctx.fillStyle = '#fff3c4';
      ctx.font = `800 ${Math.max(12, scale * 0.8)}px ${HUD.font}`;
      ctx.fillText(`CART FULL · ${this.paid.toUpperCase()}!`, ox + (W / 2) * scale, oy + (SHOOT.y - 4.4) * scale);
      ctx.globalAlpha = 1;
    }
  }

  // The instrument band along the top: shots taken, par, the level.
  drawHud(ctx) {
    const { cssW } = this;
    ctx.fillStyle = 'rgba(20,10,35,.7)';
    ctx.fillRect(0, 0, cssW, HUD.h);
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(0, HUD.h - 1, cssW, 1);
    ctx.font = `700 13px ${HUD.font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = CAVE.ink;
    ctx.fillText(`SHOTS ${this.game.shots}`, 12, HUD.h / 2);
    ctx.textAlign = 'right';
    const over = this.game.shots > this.level.par;
    ctx.fillStyle = over ? '#ffb347' : CAVE.dim;
    ctx.fillText(`PAR ${this.level.par}`, cssW - 12, HUD.h / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = CAVE.dim;
    ctx.fillText(this.demo ? 'THE COMPUTER MINER' : `LEVEL ${this.level.n}`, cssW / 2, HUD.h / 2);
    ctx.textBaseline = 'alphabetic';
  }
}

const crystalColour = (crystal) => lookOf(crystal).colour(crystal);

function pathLength(path) {
  let len = 0;
  for (let k = 1; k < path.length; k++) len += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
  return len;
}

// The way a path is heading `at` units along it, as an angle from straight
// up (positive to the right), so a drill points where it's going, off a
// wall too.
function headingAlong(path, at) {
  for (let k = 1; k < path.length; k++) {
    const dx = path[k][0] - path[k - 1][0];
    const dy = path[k][1] - path[k - 1][1];
    const d = Math.hypot(dx, dy);
    if (at <= d || k === path.length - 1) return Math.atan2(dx, -dy);
    at -= d;
  }
  return 0;
}

// The point `at` units along a path of points.
function pointAlong(path, at) {
  for (let k = 1; k < path.length; k++) {
    const d = Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
    if (at <= d) {
      const f = d ? at / d : 0;
      return [path[k - 1][0] + (path[k][0] - path[k - 1][0]) * f, path[k - 1][1] + (path[k][1] - path[k - 1][1]) * f];
    }
    at -= d;
  }
  return path[path.length - 1];
}
