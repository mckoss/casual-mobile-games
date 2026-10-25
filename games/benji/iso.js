// Benji's Town in 3D: the isometric view. The town is built from simple
// solids -- boxes, roofs, drums, balls -- seen from above at an angle, turned
// in quarter turns, flat-shaded and drawn back to front.
//
// World coordinates are the town's tiles: x east, y south, z up (a tile is
// 1 x 1). Two cameras: View, the town from above at an angle, and Eye, from
// the driver's seat (in perspective).

const COS30 = Math.cos(Math.PI / 6);
const NEAR = 0.03; // the Eye sees nothing nearer than this

// The camera: looking at (x, y) on the ground, k pixels to a tile, turned
// yaw quarter turns (fractional while it's turning), the point looked at at
// (ox, oy) on screen.
export class View {
  constructor() {
    Object.assign(this, { x: 4.5, y: 4.5, k: 40, ox: 0, oy: 0 });
    this.turn(0);
  }

  turn(yaw) {
    this.yaw = yaw;
    const a = Math.PI / 4 + (yaw * Math.PI) / 2;
    this.c = Math.cos(a);
    this.s = Math.sin(a);
    // Toward the eye; and the light, from over the viewer's left shoulder.
    this.eye = [this.s * COS30, this.c * COS30, 0.5];
    const lx = 0.5 * this.s - 0.8 * this.c;
    const ly = 0.5 * this.c + 0.8 * this.s;
    const n = Math.hypot(lx, ly, 0.9);
    this.light = [lx / n, ly / n, 0.9 / n];
  }

  // Where a point in the town is on screen.
  at(x, y, z = 0) {
    const dx = x - this.x;
    const dy = y - this.y;
    return [this.ox + (dx * this.c - dy * this.s) * this.k, this.oy + ((dx * this.s + dy * this.c) * 0.5 - z * COS30) * this.k];
  }

  // How near the viewer a point is (more: nearer, drawn later).
  depth(x, y, z = 0) {
    return x * this.eye[0] + y * this.eye[1] + z * this.eye[2];
  }

  // The point on the ground under a point on screen.
  ground(sx, sy) {
    const u = (sx - this.ox) / this.k;
    const v = (sy - this.oy) / (0.5 * this.k);
    return { x: this.x + u * this.c + v * this.s, y: this.y - u * this.s + v * this.c };
  }

  // A move on screen as a move over the ground.
  shift(dsx, dsy) {
    const u = dsx / this.k;
    const v = dsy / (0.5 * this.k);
    return { x: u * this.c + v * this.s, y: -u * this.s + v * this.c };
  }

  // A shape's corners on screen.
  poly(pts) {
    return pts.map((q) => this.at(q[0], q[1], q[2]));
  }

  // Does a face (outward normal n) face the camera?
  facing(n) {
    return n[0] * this.eye[0] + n[1] * this.eye[1] + n[2] * this.eye[2] > 1e-6;
  }

  // Pixels to a tile (the same everywhere, from up here).
  scale() {
    return this.k;
  }
}

// The camera in the driver's seat: at (x, y, z) looking along heading h,
// tipped down a little (pitch); F the focal length in pixels, the horizon
// straight ahead at (ox, oy) on screen.
export class Eye {
  constructor() {
    Object.assign(this, { F: 300, ox: 0, oy: 0 });
    this.set(0, 0, 0.37, 0, -0.15);
    const n = Math.hypot(-0.35, 0.55, 0.8);
    this.light = [-0.35 / n, 0.55 / n, 0.8 / n];
  }

  set(x, y, z, h, pitch = this.pitch) {
    Object.assign(this, { x, y, z, h, pitch });
    this.fx = Math.cos(h);
    this.fy = Math.sin(h);
    this.cp = Math.cos(pitch);
    this.sp = Math.sin(pitch);
  }

  // A point relative to the eye: [right, up, ahead].
  cam(x, y, z) {
    const dx = x - this.x;
    const dy = y - this.y;
    const dz = z - this.z;
    const fwd = dx * this.fx + dy * this.fy;
    return [-dx * this.fy + dy * this.fx, -fwd * this.sp + dz * this.cp, fwd * this.cp + dz * this.sp];
  }

  proj([xc, yc, zc]) {
    return [this.ox + (xc / zc) * this.F, this.oy - (yc / zc) * this.F];
  }

  at(x, y, z = 0) {
    const c = this.cam(x, y, z);
    return c[2] < NEAR ? null : this.proj(c);
  }

  // A shape's corners on screen, cut off where it passes behind the eye
  // (null if it's all behind).
  poly(pts) {
    const cs = pts.map((q) => this.cam(q[0], q[1], q[2]));
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      const b = cs[(i + 1) % cs.length];
      if (a[2] >= NEAR) out.push(a);
      if ((a[2] >= NEAR) !== (b[2] >= NEAR)) {
        const t = (NEAR - a[2]) / (b[2] - a[2]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
      }
    }
    return out.length >= 3 ? out.map((c) => this.proj(c)) : null;
  }

  // Nearer: more (drawn later).
  depth(x, y, z = 0) {
    return -Math.hypot(x - this.x, y - this.y, z - this.z);
  }

  facing(n, p) {
    return n[0] * (this.x - p[0]) + n[1] * (this.y - p[1]) + n[2] * (this.z - p[2]) > 1e-6;
  }

  // Pixels to a tile, at a point (0 behind the eye).
  scale(x, y, z = 0) {
    const c = this.cam(x, y, z);
    return c[2] < NEAR ? 0 : this.F / c[2];
  }

  // Could anything standing at (x, y) be in sight?
  sees(x, y) {
    const c = this.cam(x, y, 0);
    return c[2] > -1.2 && Math.hypot(x - this.x, y - this.y) < 16;
  }
}

// A colour (#rrggbb) in light or shade (f: 1 as it is).
const shades = new Map();
export function shade(hex, f) {
  const q = Math.round(f * 40) / 40;
  const key = hex + q;
  let c = shades.get(key);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.min(255, Math.round(v * q));
    c = `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
    shades.set(key, c);
  }
  return c;
}

// A shape on the ground (or at height z): points [x, y].
export function flat(g, view, pts, fill, z = 0) {
  const s = view.poly(pts.map(([x, y]) => [x, y, z]));
  if (!s) return;
  g.beginPath();
  s.forEach(([sx, sy], i) => {
    if (i) g.lineTo(sx, sy);
    else g.moveTo(sx, sy);
  });
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}
export const rect = (g, view, x0, y0, x1, y1, fill, z = 0) => flat(g, view, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill, z);
// A circle on the ground (an ellipse on screen).
export function disc(g, view, x, y, rx, ry, fill, z = 0) {
  if (view instanceof View && Math.abs(rx - ry) < 1e-6) {
    const [sx, sy] = view.at(x, y, z);
    g.beginPath();
    g.ellipse(sx, sy, rx * view.k, rx * view.k * 0.5, 0, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
    return;
  }
  flat(g, view, Array.from({ length: 20 }, (_, i) => [x + rx * Math.cos((i / 20) * Math.PI * 2), y + ry * Math.sin((i / 20) * Math.PI * 2)]), fill, z);
}

// A solid thing: faces (and balls) in its own frame -- x forward, y to the
// right, z up -- placed at (x, y, z) in the town, turned to heading h.
export class Model {
  constructor(x, y, h = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.ch = Math.cos(h);
    this.sh = Math.sin(h);
    this.parts = [];
  }

  w([lx, ly, lz]) {
    return [this.x + lx * this.ch - ly * this.sh, this.y + lx * this.sh + ly * this.ch, this.z + lz];
  }

  dir([nx, ny, nz]) {
    return [nx * this.ch - ny * this.sh, nx * this.sh + ny * this.ch, nz];
  }

  face(pts, n, c) {
    const f = { pts: pts.map((p) => this.w(p)), n: this.dir(n), c, decals: [] };
    this.parts.push(f);
    return f;
  }

  // Something painted on a face (a door, a window, a stripe), drawn with it.
  decal(f, pts, c) {
    f.decals.push({ pts: pts.map((p) => this.w(p)), c });
    return this;
  }

  // A box (its top can be another colour); its faces by side: top, e (+x),
  // w, s (+y), n.
  box(x0, y0, z0, x1, y1, z1, c, top = c) {
    return {
      top: this.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], top),
      e: this.face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], c),
      w: this.face([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0], c),
      s: this.face([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0], c),
      n: this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], c),
    };
  }

  // A pitched roof, its ridge along y, sloping down to x0 and x1; the gable
  // ends in the colour of the walls.
  roof(x0, y0, x1, y1, z0, z1, c, gable) {
    const xm = (x0 + x1) / 2;
    const h = z1 - z0;
    const w = (x1 - x0) / 2;
    const n = Math.hypot(h, w);
    this.face([[x1, y0, z0], [x1, y1, z0], [xm, y1, z1], [xm, y0, z1]], [h / n, 0, w / n], c);
    this.face([[x0, y1, z0], [x0, y0, z0], [xm, y0, z1], [xm, y1, z1]], [-h / n, 0, w / n], c);
    this.face([[x0, y0, z0], [x1, y0, z0], [xm, y0, z1]], [0, -1, 0], gable);
    this.face([[x1, y1, z0], [x0, y1, z0], [xm, y1, z1]], [0, 1, 0], gable);
  }

  // A heap: a four-sided pyramid.
  pyramid(x0, y0, x1, y1, z0, z1, c) {
    const a = [(x0 + x1) / 2, (y0 + y1) / 2, z1];
    const h = z1 - z0;
    const nx = Math.hypot(h, (x1 - x0) / 2);
    const ny = Math.hypot(h, (y1 - y0) / 2);
    this.face([[x1, y0, z0], [x1, y1, z0], a], [h / nx, 0, (x1 - x0) / 2 / nx], c);
    this.face([[x0, y1, z0], [x0, y0, z0], a], [-h / nx, 0, (x1 - x0) / 2 / nx], c);
    this.face([[x1, y1, z0], [x0, y1, z0], a], [0, h / ny, (y1 - y0) / 2 / ny], c);
    this.face([[x0, y0, z0], [x1, y0, z0], a], [0, -h / ny, (y1 - y0) / 2 / ny], c);
  }

  // A drum lying along x (the cement mixer's), striped, turned by spin.
  drum(x0, x1, cz, r, colours, spin = 0, n = 12) {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2;
      const a1 = ((k + 1) / n) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p = (x, a) => [x, r * Math.cos(a), cz + r * Math.sin(a)];
      this.face([p(x0, a0), p(x1, a0), p(x1, a1), p(x0, a1)], [0, Math.cos(am), Math.sin(am)], colours[(k + spin) % colours.length]);
    }
    const cap = (x) => Array.from({ length: n }, (_, k) => [x, r * Math.cos((k / n) * Math.PI * 2), cz + r * Math.sin((k / n) * Math.PI * 2)]);
    this.face(cap(x1), [1, 0, 0], colours[0]);
    this.face(cap(x0).reverse(), [-1, 0, 0], colours[0]);
  }

  ball(lx, ly, lz, r, c) {
    this.parts.push({ ball: this.w([lx, ly, lz]), r, c });
  }
}

// Draws things' faces, nearest last: those facing away left out, each
// shaded by how it faces the light.
export function paint(g, view, parts, alpha = 1) {
  const [lx, ly, lz] = view.light;
  const list = [];
  for (const p of parts) {
    if (p.ball) {
      list.push({ p, d: view.depth(...p.ball) });
      continue;
    }
    if (!view.facing(p.n, p.pts[0])) continue;
    let d = 0;
    for (const q of p.pts) d += view.depth(q[0], q[1], q[2]);
    list.push({ p, d: d / p.pts.length });
  }
  list.sort((a, b) => a.d - b.d);
  g.globalAlpha = alpha;
  g.lineJoin = 'round';
  for (const { p } of list) {
    if (p.ball) {
      const at = view.at(...p.ball);
      if (!at) continue;
      const [sx, sy] = at;
      const r = p.r * view.scale(...p.ball);
      g.fillStyle = shade(p.c, 0.92);
      g.beginPath();
      g.arc(sx, sy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = shade(p.c, 1.12);
      g.beginPath();
      g.arc(sx - r * 0.3, sy - r * 0.35, r * 0.5, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    const f = 0.6 + 0.48 * Math.max(0, p.n[0] * lx + p.n[1] * ly + p.n[2] * lz);
    poly(g, view, p.pts, shade(p.c, f), true);
    for (const d of p.decals) poly(g, view, d.pts, shade(d.c, f), false);
  }
  g.globalAlpha = 1;
}

function poly(g, view, pts, fill, edge) {
  const s = view.poly(pts);
  if (!s) return;
  g.beginPath();
  s.forEach(([x, y], i) => {
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  });
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (edge) {
    // (A hairline of the same colour, so the seams between faces don't show.)
    g.strokeStyle = fill;
    g.lineWidth = 0.7;
    g.stroke();
  }
}

// ----------------------------------------------------------------- things

// Points on a face, for decals: on the plane x = at (y0..y1 by z0..z1), or
// y = at (x0..x1 by z0..z1).
const onX = (at, y0, y1, z0, z1) => [[at, y0, z0], [at, y1, z0], [at, y1, z1], [at, y0, z1]];
const onY = (at, x0, x1, z0, z1) => [[x0, at, z0], [x1, at, z0], [x1, at, z1], [x0, at, z1]];
const GLASS = '#cdeffd';

// A house at (x, y), its front (with the door) toward heading h. stage, while
// it's being built: 1 the slab and the first bricks, 2 the walls, 3 done.
export function house(x, y, h, color, stage = 3) {
  const m = new Model(x, y, h);
  m.box(-0.37, -0.39, 0, 0.37, 0.39, 0.03, '#a9a9a9');
  if (stage < 3) {
    // The walls going up, brick by brick (no roof yet).
    const top = stage === 1 ? 0.12 : 0.42;
    m.box(-0.3, -0.33, 0.03, 0.3, -0.29, top, color);
    m.box(-0.3, 0.29, 0.03, 0.3, 0.33, top, color);
    m.box(-0.3, -0.29, 0.03, -0.26, 0.29, top, color);
    const front = m.box(0.26, -0.29, 0.03, 0.3, 0.29, top, color);
    if (stage === 2) m.decal(front.e, onX(0.302, -0.08, 0.08, 0.03, 0.27), '#3d2b1f');
    return m;
  }
  const b = m.box(-0.3, -0.33, 0.03, 0.3, 0.33, 0.42, color);
  m.decal(b.e, onX(0.302, -0.08, 0.08, 0.03, 0.27), '#6b4226');
  for (const y0 of [-0.27, 0.15]) {
    m.decal(b.e, onX(0.302, y0, y0 + 0.12, 0.22, 0.34), GLASS);
    m.decal(b.w, onX(-0.302, y0, y0 + 0.12, 0.22, 0.34), GLASS);
  }
  m.decal(b.s, onY(0.332, -0.07, 0.07, 0.22, 0.34), GLASS);
  m.decal(b.n, onY(-0.332, -0.07, 0.07, 0.22, 0.34), GLASS);
  m.roof(-0.38, -0.39, 0.38, 0.39, 0.42, 0.68, '#c0392b', color);
  return m;
}

// A shop-front building (the post office, the shop, the café): flat roof,
// big windows, the door in front.
export function building(x, y, h, wall, roof) {
  const m = new Model(x, y, h);
  const b = m.box(-0.38, -0.4, 0, 0.38, 0.4, 0.54, wall);
  m.box(-0.42, -0.44, 0.54, 0.42, 0.44, 0.6, roof);
  m.decal(b.e, onX(0.382, -0.09, 0.09, 0, 0.28), '#6b4226');
  m.decal(b.e, onX(0.382, -0.33, -0.14, 0.1, 0.3), GLASS);
  m.decal(b.e, onX(0.382, 0.14, 0.33, 0.1, 0.3), GLASS);
  // An awning stripe over the door and windows.
  m.decal(b.e, onX(0.382, -0.38, 0.38, 0.36, 0.42), roof);
  for (const y0 of [-0.3, 0.06]) m.decal(b.w, onX(-0.382, y0, y0 + 0.24, 0.24, 0.4), GLASS);
  m.decal(b.s, onY(0.402, -0.12, 0.12, 0.24, 0.4), GLASS);
  m.decal(b.n, onY(-0.402, -0.12, 0.12, 0.24, 0.4), GLASS);
  return m;
}

export function tree(x, y, size = 1) {
  const m = new Model(x, y);
  m.box(-0.035 * size, -0.035 * size, 0, 0.035 * size, 0.035 * size, 0.24 * size, '#8d5524');
  m.ball(0, 0, 0.4 * size, 0.2 * size, '#3aa457');
  return m;
}

// A wheelie bin, out for collection.
export function bin(x, y, recycling = false) {
  const m = new Model(x, y);
  m.box(-0.06, -0.06, 0, 0.06, 0.06, 0.17, recycling ? '#3a86ff' : '#2a9d8f');
  m.box(-0.07, -0.07, 0.17, 0.07, 0.07, 0.2, recycling ? '#2667cc' : '#21867a');
  return m;
}

// A post with a traffic light (or walk signal) on top: the light is drawn
// flat, facing you, at top.
export function pole(x, y, height) {
  const m = new Model(x, y);
  m.box(-0.02, -0.02, 0, 0.02, 0.02, height, '#555555');
  return m;
}

const CABS = { garbage: '#e9c46a', mail: '#e63946', mixer: '#ffd166' };

// A vehicle at (x, y), heading h: the garbage truck, the mail van, the
// cement mixer (its drum turning with t), or a little car (in color).
export function vehicle(kind, x, y, h, t = 0, color = '#ef476f', z = 0, open = false) {
  const m = new Model(x, y, h, z);
  const L = kind === 'car' ? 0.29 : 0.38;
  for (const wx of [-L + 0.11, L - 0.11]) for (const wy of [-0.15, 0.13]) m.box(wx - 0.065, wy, 0, wx + 0.065, wy + 0.02, 0.13, '#222222');
  if (kind === 'car') {
    const b = m.box(-0.29, -0.13, 0.05, 0.29, 0.13, 0.17, color);
    m.decal(b.e, onX(0.292, -0.1, -0.05, 0.1, 0.14), '#fff3b0');
    m.decal(b.e, onX(0.292, 0.05, 0.1, 0.1, 0.14), '#fff3b0');
    m.box(-0.14, -0.11, 0.17, 0.12, 0.11, 0.29, GLASS, color);
    return m;
  }
  m.box(-0.38, -0.14, 0.05, 0.38, 0.14, 0.11, '#555555');
  const cab = m.box(0.13, -0.14, 0.11, 0.38, 0.14, 0.4, CABS[kind]);
  m.decal(cab.e, onX(0.382, -0.11, 0.11, 0.24, 0.36), GLASS);
  m.decal(cab.s, onY(0.142, 0.2, 0.35, 0.24, 0.36), GLASS);
  m.decal(cab.n, onY(-0.142, 0.2, 0.35, 0.24, 0.36), GLASS);
  if (kind === 'mixer') {
    m.box(-0.38, -0.12, 0.11, 0.12, 0.12, 0.15, '#6c757d');
    m.drum(-0.36, 0.1, 0.3, 0.14, ['#ff9f1c', '#ff9f1c', '#ffffff'], Math.floor(t * 8) % 3);
    return m;
  }
  const body = m.box(-0.38, -0.15, 0.11, 0.12, 0.15, 0.46, kind === 'garbage' ? '#2a9d8f' : '#f1faee');
  if (kind === 'garbage') {
    for (const x0 of [-0.32, -0.18, -0.04]) {
      m.decal(body.s, onY(0.152, x0, x0 + 0.04, 0.15, 0.42), '#21867a');
      m.decal(body.n, onY(-0.152, x0, x0 + 0.04, 0.15, 0.42), '#21867a');
    }
  } else {
    for (const f of [body.s, body.n]) {
      const at = f === body.s ? 0.152 : -0.152;
      m.decal(f, onY(at, -0.36, 0.1, 0.2, 0.25), '#e63946');
      m.decal(f, onY(at, -0.36, 0.1, 0.27, 0.31), '#1d4e89');
    }
    // The back doors open (for the letters and parcels inside).
    if (open) {
      m.decal(body.w, onX(-0.382, -0.12, 0.12, 0.13, 0.43), '#3d405b');
      m.decal(body.w, onX(-0.384, -0.06, 0.04, 0.14, 0.24), '#c68642');
      m.box(-0.62, -0.165, 0.12, -0.38, -0.15, 0.44, '#f1faee');
      m.box(-0.62, 0.15, 0.12, -0.38, 0.165, 0.44, '#f1faee');
    }
  }
  return m;
}

// Someone on foot at (x, y), heading h (legs going while walking): in their
// colour; the postal worker in uniform, cap and bag, maybe carrying a letter
// or a parcel; the dog walker with the dog trotting alongside.
export function person(x, y, h, t, color, opts = {}) {
  const m = new Model(x, y, h, opts.z || 0);
  const sw = opts.walking ? Math.sin(t * 10) * 0.04 : 0;
  m.box(-0.025 + sw, 0.012, 0, 0.025 + sw, 0.05, 0.16, '#3d405b');
  m.box(-0.025 - sw, -0.05, 0, 0.025 - sw, -0.012, 0.16, '#3d405b');
  m.box(-0.045, -0.065, 0.16, 0.045, 0.065, 0.33, color);
  m.ball(0, 0, 0.39, 0.065, '#f1c27d');
  if (opts.postie) {
    m.box(-0.05, -0.055, 0.43, 0.075, 0.055, 0.465, '#1d4e89');
    m.box(-0.035, 0.065, 0.17, 0.04, 0.1, 0.27, '#8d5524');
  }
  if (opts.carry === 'letter') m.box(0.05, -0.055, 0.22, 0.065, 0.055, 0.3, '#ffffff');
  if (opts.carry === 'parcel') m.box(0.05, -0.07, 0.19, 0.17, 0.07, 0.31, '#c68642');
  // (A treat: an ice cream cone, or an apple.)
  if (opts.carry === 'cone') {
    m.box(0.06, -0.018, 0.2, 0.096, 0.018, 0.28, '#d4a373');
    m.ball(0.078, 0, 0.3, 0.032, '#ffafcc');
  }
  if (opts.carry === 'apple') m.ball(0.08, 0, 0.27, 0.035, '#e63946');
  if (opts.dog) addDog(m, t, opts.walking);
  return m;
}

// The dog, trotting along at the walker's right.
function addDog(m, t, walking) {
  const b = Math.abs(Math.sin(t * 12)) * (walking ? 0.02 : 0);
  m.box(0.12, 0.1, 0.05 + b, 0.3, 0.18, 0.13 + b, '#a0522d');
  m.box(0.27, 0.105, 0.1 + b, 0.35, 0.175, 0.18 + b, '#a0522d');
  m.box(0.33, 0.125, 0.12 + b, 0.37, 0.155, 0.15 + b, '#5c2e0e');
  m.box(0.06, 0.13, 0.12 + b, 0.13, 0.15, 0.14 + b, '#a0522d');
}

// Just the dog (seen by its walker).
export function dog(x, y, h, t, walking) {
  const m = new Model(x, y, h);
  addDog(m, t, walking);
  return m;
}

// The dump's heap, the builders' yard's bricks and cones, the stakes round a
// lot, a park bench.
export function heap(x, y) {
  const m = new Model(x, y);
  m.pyramid(-0.3, -0.26, 0.22, 0.26, 0, 0.3, '#6c584c');
  m.pyramid(0, -0.05, 0.32, 0.3, 0, 0.18, '#8a7a6a');
  m.box(-0.33, 0.12, 0, -0.17, 0.3, 0.12, '#2a9d8f');
  return m;
}
export function bricks(x, y) {
  const m = new Model(x, y);
  for (let k = 0; k < 3; k++) m.box(-0.28 + k * 0.03, -0.12, k * 0.07, 0.02 + k * 0.03, 0.08, (k + 1) * 0.07, '#bc4749');
  m.pyramid(0.12, 0.12, 0.24, 0.24, 0, 0.2, '#ff7f11');
  m.pyramid(0.18, -0.28, 0.3, -0.16, 0, 0.2, '#ff7f11');
  return m;
}
export function stakes(x, y) {
  const m = new Model(x, y);
  for (const sx of [-0.36, 0.36]) for (const sy of [-0.36, 0.36]) m.box(sx - 0.02, sy - 0.02, 0, sx + 0.02, sy + 0.02, 0.16, '#ff9f1c');
  return m;
}
export function bench(x, y, h = 0) {
  const m = new Model(x, y, h);
  m.box(-0.16, -0.05, 0.08, 0.16, 0.05, 0.11, '#8d5524');
  m.box(-0.16, 0.04, 0.11, 0.16, 0.06, 0.22, '#8d5524');
  for (const lx of [-0.13, 0.13]) m.box(lx - 0.015, -0.04, 0, lx + 0.015, 0.04, 0.08, '#555555');
  return m;
}

// The town as a block of earth, the grass on top.
export function slab(size) {
  const m = new Model(0, 0);
  m.box(0, 0, -0.45, size, size, 0, '#9c6b43', '#8fd16a');
  return m;
}
