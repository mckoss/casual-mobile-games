// Benji's Town: the town on screen, in 3D -- the helpers going about their
// jobs, people and cars pottering about, and a tray of the level's jobs
// ticking off. Tap a helper and it goes to its next job (the early levels);
// later, tap one and you're its driver -- or walking the dog -- seeing the
// town from the driver's seat. Everyone minds the traffic lights (you too),
// and people cross only at the crosswalks.
//
// The town is seen from above at an angle (isometric), turned a quarter at
// a time with the buttons at the bottom. The camera follows the action:
// close in on a helper while it's off on a job, back out to see everyone
// when it's done. Drag the ground to look about.
import { SIZE, isRoad, drivePath, jobAt, nextJob, makeTown } from './town.js';
import { tick, partAt, light, sky, sunAt, WINDOW, NIGHT } from './clock.js';
import { walkways, walkDoor, junctions, crossings, isJunction, isLit, lights, walkSignal, armOf, atEdge, circleAt, CIRCLE } from './streets.js';
import { Traffic, lanePoint, startDir, streetTiles } from './traffic.js';
import { ahead, driveTurn, onFrom, walkAhead, walkTurn } from './steer.js';
import * as D from './draw.js';
import * as I from './iso.js';

const SPEED = { garbage: 2.2, mail: 2.6, mixer: 2, walker: 1.3, car: 1.6, person: 0.9 };
export const COLORS = { garbage: '#2a9d8f', mail: '#e63946', mixer: '#ff9f1c', walker: '#7b2cbf' };
// The jobs, as pictures in the tray.
const ICONS = { bin: '🗑️', dump: '♻️', letter: '✉️', parcel: '📦', walk: '🐕', home: '🏠', build: '🧱' };
const PEOPLE = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0'];
const SIGNS = { post: '📮', shop: '🍎', cafe: '🍦', dump: '♻️', yard: '🚧' };
const BUILDINGS = { post: ['#e63946', '#8d1b26'], shop: ['#ffd166', '#e09f3e'], cafe: ['#f4a261', '#9c6644'] };
const BTN = 28; // the turn buttons' radius
const BOX = 40; // the tray's pictures (and the gap between them: 5)
const LOOK = 1.75; // how far round you can look (radians, either way)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Play {
  constructor(canvas, town, hooks = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.town = town;
    this.hooks = hooks;
    this.done = new Set();
    this.t = 0;
    // The time of day: from dawn, and on to the day's first jobs.
    this.clock = 0;
    this.part = null; // the part of the day with its jobs under way: { part, jobs }
    this.next = 0; // ... and the next one to come (in town.phases)
    this.night = false;
    town.jobs = [];
    this.fx = [];
    this.confetti = [];
    this.won = false;
    this.stage = {}; // building lots: stages built so far
    // The sidewalks: each place's spot outside its door, and the places by
    // each spot (for the dog walker).
    this.walk = walkways();
    this.spot = new Map(town.places.map((p) => [p.id, walkDoor(this.walk, p)]));
    this.atSpot = new Map();
    for (const p of town.places) this.atSpot.set(this.spot.get(p.id), [...(this.atSpot.get(this.spot.get(p.id)) || []), p]);
    this.junctions = junctions();
    this.crossings = crossings();
    const onFoot = (node) => ({ node, ...this.walk.nodes[node] });
    const parked = (tile, dir = startDir(tile)) => ({ tile, dir, ...lanePoint(tile, dir) });
    this.newHelper = (h) => {
      const m = {
        ...h, ...(h.kind === 'walker' ? onFoot(this.spot.get(h.home)) : parked(h.at)), tile: h.at,
        path: [], face: 1, pause: 0, hop: 0, loaded: true, load: 0, patience: 1.2, len: 0.38,
      };
      m.head = m.dir ? Math.atan2(m.dir.y, m.dir.x) : 0;
      return m;
    };
    this.helpers = town.helpers.map(this.newHelper);
    // Life in the town: cars and people out and about.
    const r = (() => {
      let s = town.n * 31 + 7;
      return () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
    })();
    this.rand = r;
    this.streets = streetTiles(SIZE);
    const anyStreet = () => this.streets[Math.floor(r() * this.streets.length)];
    const anyWhere = () => Math.floor(r() * this.walk.nodes.length);
    // (The cars start parked clear of each other, and of the helpers.)
    const taken = new Set();
    const clear = (t) => {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) taken.add(`${t.x + dx},${t.y + dy}`);
      return t;
    };
    for (const h of this.helpers) if (h.kind !== 'walker') clear(h.tile);
    const freeStreet = () => {
      let t = anyStreet();
      for (let k = 0; k < 50 && taken.has(`${t.x},${t.y}`); k++) t = anyStreet();
      return clear(t);
    };
    this.ambient = [
      { kind: 'car', color: '#ef476f' }, { kind: 'car', color: '#118ab2' }, { kind: 'car', color: '#8338ec' }, { kind: 'car', color: '#06d6a0' },
      { kind: 'person', color: PEOPLE[0] }, { kind: 'person', color: PEOPLE[1] }, { kind: 'person', color: PEOPLE[2] }, { kind: 'person', color: PEOPLE[3] }, { kind: 'person', color: PEOPLE[1] },
    ].map((a, k) => ({
      ...a, id: `a${k}`, ...(a.kind === 'car' ? { ...parked(freeStreet()), len: 0.29 } : onFoot(anyWhere())), path: [], face: 1, pause: r() * 2, hop: 0,
    }));
    this.anyStreet = anyStreet;
    this.anyWhere = anyWhere;
    this.stars = Array.from({ length: 70 }, () => [r(), r() * 0.6, 0.5 + r()]);
    this.traffic = new Traffic(this.walk, (o) => this.budge(o));
    const movers = [...this.helpers, ...this.ambient];
    this.traffic.cars = movers.filter((m) => m.kind !== 'walker' && m.kind !== 'person');
    this.traffic.people = movers.filter((m) => m.kind === 'walker' || m.kind === 'person');
    // Which way each is facing (turning smoothly as it goes).
    for (const m of movers) {
      m.head = m.dir ? Math.atan2(m.dir.y, m.dir.x) : r() * Math.PI * 2;
      m.px = m.x;
      m.py = m.y;
    }
    this.said = -99;
    // The camera: the whole town to begin with, then in to the helpers.
    this.view = new I.View();
    this.eye = new I.Eye(); // (in the driver's seat)
    this.fp = null; // whose seat you're in: { h, gas, v, intent, hint, ... }
    this.rot = 0; // quarter turns
    this.spin = null;
    this.cam = { x: SIZE / 2, y: SIZE / 2, k: 0 };
    this.intro = 1.2;
    this.calm = 9; // seconds since a helper was busy
    this.manual = 0; // seconds left of looking where you dragged it
    this.focus = null;
    this.onDown = (e) => this.pointer(e, 'down');
    this.onMove = (e) => this.pointer(e, 'move');
    this.onUp = (e) => this.pointer(e, 'up');
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    this.resize();
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); // (the first frame's can be a hair before)
      this.last = now;
      // (Faster, for the end-to-end tests: more steps a frame.)
      for (let k = 0; k < (this.speed || 1); k++) this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  // The town above, and below it a band with the tray of jobs between the
  // two turn buttons. How close the camera comes: the whole town (fit), the
  // usual view (out), and close in on the action (in).
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.dpr = dpr;
    this.W = rect.width;
    this.H = rect.height;
    const n = this.town.jobs.length;
    this.per = Math.max(1, Math.floor((this.W - 4 * BTN - 30) / (BOX + 5)));
    this.trayH = Math.max(2 * BTN + 16, Math.ceil(n / this.per) * (BOX + 5) + 14);
    this.viewH = Math.max(50, this.H - this.trayH);
    this.view.ox = this.W / 2;
    this.view.oy = this.viewH / 2;
    this.kFit = Math.max(6, Math.min((this.W - 16) / (SIZE * 1.42), (this.viewH - 16) / (SIZE * 0.71 + 1)));
    this.kOut = Math.max(this.kFit, Math.min(this.W * 1.25, this.viewH) / 7);
    this.kIn = this.kOut * 1.6;
    if (!this.cam.k) this.cam.k = this.kFit;
    const y = this.viewH + this.trayH / 2;
    this.buttons = [{ x: BTN + 10, y, dir: -1 }, { x: this.W - BTN - 10, y, dir: 1 }];
    // In the driver's seat: the view, and the buttons -- ◀ ▲ ▶ along the
    // bottom, and back to the town top left.
    this.seatH = this.H - 110;
    const py = this.H - 55;
    this.pads = [
      { act: 'left', x: this.W * 0.18, y: py, r: 34 },
      { act: 'go', x: this.W / 2, y: py, r: 42 },
      { act: 'right', x: this.W * 0.82, y: py, r: 34 },
      { act: 'exit', x: 34, y: 34, r: 24 },
    ];
    this.eye.F = this.W / 2 / Math.tan((40 * Math.PI) / 180);
    this.eye.ox = this.W / 2;
    this.eye.oy = this.seatH * 0.36;
    this.camera(0);
  }

  // Where a point in the town is on the page (for the end-to-end tests).
  screenOf(x, y, z = 0) {
    const r = this.canvas.getBoundingClientRect();
    const [sx, sy] = this.view.at(x, y, z);
    return { x: r.left + sx, y: r.top + sy };
  }

  place(id) {
    return this.town.places.find((p) => p.id === id);
  }

  // ------------------------------------------------------------ the jobs

  // Where a helper should go next (tap mode): the nearest bin left, then
  // the dump; the next letter; the park, then home; the lot (loaded with
  // cement) or back to the yard for more.
  targetPlace(h) {
    if (h.kind === 'mixer' && !h.loaded) return this.place('yard');
    const left = this.town.jobs.filter((j) => j.helper === h.id && !this.done.has(j.i));
    if (h.kind === 'garbage') {
      const bins = left.filter((j) => j.kind === 'bin');
      if (bins.length) {
        const dist = (j) => this.way(h, this.near(h, this.place(j.place))).length;
        return this.place(bins.reduce((a, b) => (dist(b) < dist(a) ? b : a)).place);
      }
    }
    const j = nextJob(this.town, h, this.done);
    return j ? this.place(j.place) : null;
  }

  target(h) {
    const p = this.targetPlace(h);
    return p ? this.near(h, p) : null;
  }

  // The nearest street tile beside a place (any of them will do).
  near(h, p) {
    if (h.kind === 'walker' || p.doors.length < 2) return p.door;
    const dist = (d) => this.way(h, d).length;
    return p.doors.reduce((a, b) => (dist(b) < dist(a) ? b : a));
  }

  // The way a helper would drive to a street tile, from where it is and the
  // way it's facing.
  way(h, to) {
    return drivePath(h.tile, h.dir, to);
  }

  // A helper with nothing to do, parked in the way of other cars: off home
  // (to the end of its street, out of everyone's way). (Not yours, nor one
  // busy with a job: they'll be going on in a moment.)
  budge(o, bedtime = false) {
    if (!this.helpers.includes(o) || this.fp?.h === o || o.path.length || (o.pause > 0 && !bedtime) || o.deliver) return;
    const home = this.place(o.home).door;
    if (o.tile.x === home.x && o.tile.y === home.y) return;
    o.path = this.way(o, home).slice(1);
    o.budging = true;
  }

  // Tap mode: off it goes to its next job.
  send(h) {
    const p = this.targetPlace(h);
    if (!p) {
      h.hop = 1;
      return;
    }
    this.hooks.sfx?.(h.kind === 'walker' ? 'pop' : 'honk');
    if (h.kind === 'walker') {
      h.path = this.walk.route(h.node, this.spot.get(p.id)).slice(1);
      if (!h.path.length) this.reached(h, h.node);
      return;
    }
    h.budging = false;
    h.path = this.way(h, this.near(h, p)).slice(1);
    if (!h.path.length) this.arrive(h, h.tile);
  }

  // The dog walker at a spot on the sidewalk: outside a place with a job?
  reached(h, node) {
    const p = (this.atSpot.get(node) || []).find((q) => jobAt(this.town, h, q.door, this.done));
    if (p) this.arrive(h, p.door);
  }

  // At a street tile: a job to do here?
  arrive(h, tile) {
    if (h.kind === 'walker') h.tile = tile;
    if (h.kind === 'mixer' && !h.loaded) {
      if (this.place('yard').doors.some((d) => d.x === tile.x && d.y === tile.y)) {
        h.loaded = true;
        h.pause = 0.6;
        this.stopHere(h);
        this.pop('🪣', tile);
        this.hooks.sfx?.('pour', 0.5);
      }
      return;
    }
    const job = jobAt(this.town, h, tile, this.done);
    if (!job) return;
    this.done.add(job.i);
    this.stopHere(h);
    h.path = [];
    const p = this.place(job.place);
    const at = { x: p.x + (p.w || 1) / 2 - 0.5, y: p.y + (p.h || 1) / 2 - 0.5 };
    switch (job.kind) {
      case 'bin':
        h.load++;
        h.pause = 0.7;
        this.pop('✨', at);
        this.hooks.sfx?.('clink');
        break;
      case 'dump':
        h.load = 0;
        h.pause = 0.8;
        this.pop('♻️', at);
        this.hooks.sfx?.('crash');
        break;
      case 'letter':
      case 'parcel':
        // The postal worker hops out, takes it out of the back of the van,
        // carries it up to the house (the front door, when the street's in
        // front), hands it over, and walks back and hops in.
        h.deliver = this.delivery(h, job.kind, at, { x: Math.max(p.x + 0.2, Math.min(p.x + 0.8, h.x)), y: Math.max(p.y + 0.2, Math.min(p.y + 0.86, h.y)) });
        h.pause = h.deliver.total;
        this.hooks.sfx?.('pop');
        return;
      case 'walk':
        // Play in the park a while, then (tapping) home again.
        h.pause = 2.4;
        h.playing = 2.4;
        this.pop('🎾', at);
        this.hooks.sfx?.('pop');
        if (!this.town.drive) h.then = true;
        break;
      case 'home':
        h.pause = 0.6;
        this.pop('❤️', at);
        this.hooks.sfx?.('ding');
        break;
      case 'build':
        this.stage[job.place] = job.stage;
        h.loaded = false;
        h.pause = 1;
        this.pop(job.stage === 3 ? '🎉' : '🔨', at);
        this.hooks.sfx?.(job.stage === 3 ? 'checkpoint' : 'tile');
        if (!this.town.drive && this.town.jobs.some((o) => o.helper === h.id && !this.done.has(o.i))) h.then = true;
        break;
      default:
        break;
    }
    this.hooks.haptic?.(20);
    if (this.done.size === this.town.jobs.length) this.win();
  }

  // Driving it yourself, and there: stop (till you press to go on), with
  // nothing chosen -- an arrow you pressed on the way is done with.
  stopHere(h) {
    if (this.fp?.h !== h) return;
    this.fp.go = false;
    this.fp.intent = null;
  }

  // A delivery, step by step (slowly enough to follow): out of the van's
  // side door, round to the back, take the letter or parcel out, carry it
  // up to the door, hand it over, walk back and hop in. Each step: { do,
  // a, b (where, from and to), head, t (when it starts), dur }.
  delivery(h, kind, at, door) {
    const fx = Math.cos(h.head);
    const fy = Math.sin(h.head);
    // (Which side of the van the house is.)
    let [sx, sy] = [-fy, fx];
    if (sx * (door.x - h.x) + sy * (door.y - h.y) < 0) [sx, sy] = [-sx, -sy];
    const side = { x: h.x + sx * 0.24 + fx * 0.12, y: h.y + sy * 0.24 + fy * 0.12 };
    const rear = { x: h.x - fx * 0.52 + sx * 0.08, y: h.y - fy * 0.52 + sy * 0.08 };
    const face = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    const walk = (a, b) => ({ do: 'walk', a, b, head: face(a, b), dur: Math.max(0.5, Math.hypot(b.x - a.x, b.y - a.y) / 0.55) });
    const steps = [
      { do: 'out', a: side, b: side, head: face(side, rear), dur: 0.6 },
      walk(side, rear),
      { do: 'take', a: rear, b: rear, head: face(rear, h), dur: 1.1 },
      { ...walk(rear, door), carry: true },
      { do: 'give', a: door, b: door, head: face(rear, door), dur: 1.3 },
      walk(door, side),
      { do: 'in', a: side, b: side, head: face(door, side), dur: 0.4 },
    ];
    let t = 0;
    for (const st of steps) {
      st.t = t;
      t += st.dur;
    }
    // (The camera, out of the cab: down in the street behind the van,
    // looking past its back doors to the house.)
    // (Tipped down a little less than straight at it, so it's in the
    // middle of the picture, not up by the horizon.)
    const mid = { x: rear.x * 0.45 + door.x * 0.55, y: rear.y * 0.45 + door.y * 0.55 };
    const cam = { x: rear.x - fx * 0.75 - sx * 0.3, y: rear.y - fy * 0.75 - sy * 0.3, z: 0.75 };
    cam.h = face(cam, mid);
    cam.pitch = -Math.atan2(cam.z - 0.2, Math.hypot(mid.x - cam.x, mid.y - cam.y)) + 0.2;
    return { t: 0, kind, at, steps, total: t, cam };
  }

  // The postal worker at the door: here's your letter (or package)!
  handOver(h) {
    const d = h.deliver;
    this.pop(d.kind === 'letter' ? '💌' : '🎁', d.at);
    this.hooks.sfx?.('ding');
    this.hooks.say?.(d.kind === 'letter' ? 'Here’s your letter!' : 'A package for you!');
    this.hooks.haptic?.(20);
    if (this.done.size === this.town.jobs.length) this.win();
  }

  // All the jobs for this part of the day done: hooray! (And on with the
  // day.)
  win() {
    if (this.won) return;
    this.won = true;
    this.hooks.sfx?.('win');
    this.hooks.say?.('Yay! Great job!');
    for (let k = 0; k < 120; k++) {
      this.confetti.push({
        x: this.rand() * this.W, y: -this.rand() * this.H * 0.5, vx: (this.rand() - 0.5) * 60, vy: 80 + this.rand() * 120,
        c: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#ff9f1c'][k % 5], a: this.rand() * 6,
      });
    }
  }

  // ------------------------------------------------------- the day goes by

  // The clock on, and what comes with it: the next part of the day and its
  // jobs, nightfall (everyone home), and the next morning.
  passTime(dt) {
    this.clock = tick(this.clock, dt, this.part?.part, !this.part || this.won);
    const next = this.town.phases[this.next];
    if (next && !this.night && (!this.part || this.won) && this.clock >= WINDOW[next.part][0]) this.begin(next);
    if (!next && !this.night && (!this.part || this.won) && this.clock >= NIGHT) this.nightfall();
    if (this.clock >= 1) this.morning();
    // (The picture of the time of day, in the title.)
    const part = this.night ? 'night' : partAt(this.clock);
    if (part !== this.shown) this.hooks.onPart?.((this.shown = part));
  }

  // A part of the day begins: its jobs, in the tray and over the helpers.
  begin(phase) {
    this.part = phase;
    this.next++;
    this.town.jobs = phase.jobs;
    this.done = new Set();
    this.won = false;
    this.confetti = [];
    this.calm = 9;
    this.resize();
    this.hooks.say?.({ morning: 'Good morning!', midday: 'Lunch time!', evening: 'Good evening!' }[phase.part]);
  }

  // Night falls: everyone home to bed.
  nightfall() {
    this.night = true;
    this.part = null;
    this.town.jobs = [];
    this.done = new Set();
    if (this.fp) this.leave();
    this.hooks.say?.('Goodnight!');
    for (const h of this.helpers) {
      if (h.kind === 'walker') h.path = this.walk.route(h.node, this.spot.get(h.home)).slice(1);
      else this.budge(h, true);
    }
  }

  // The next morning: the next day, its helpers (the ones out that day) and
  // its jobs.
  morning() {
    const town = makeTown(this.town.day + 1);
    const was = new Map(this.helpers.map((h) => [h.id, h]));
    this.town = town;
    town.jobs = [];
    this.spot = new Map(town.places.map((p) => [p.id, walkDoor(this.walk, p)]));
    this.atSpot = new Map();
    for (const p of town.places) this.atSpot.set(this.spot.get(p.id), [...(this.atSpot.get(this.spot.get(p.id)) || []), p]);
    // (The same truck as yesterday, wherever it got to; the dog walker from
    // today's house.)
    this.helpers = town.helpers.map((h) => {
      const o = was.get(h.id);
      return o && o.home === h.home ? Object.assign(o, { color: h.color, loaded: true, load: 0 }) : this.newHelper(h);
    });
    const movers = [...this.helpers, ...this.ambient];
    this.traffic.cars = movers.filter((m) => m.kind !== 'walker' && m.kind !== 'person');
    this.traffic.people = movers.filter((m) => m.kind === 'walker' || m.kind === 'person');
    this.focus = null;
    this.clock = 0;
    this.next = 0;
    this.part = null;
    this.night = false;
    this.won = false;
    this.done = new Set();
    this.resize();
    this.hooks.onDay?.(town.day);
  }

  pop(icon, tile, k = 1) {
    this.fx.push({ icon, x: tile.x + 0.5, y: tile.y + 0.5, t: 0, k });
  }

  // ------------------------------------------------------------- touches

  pointer(e, type) {
    const r = this.canvas.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    if (this.fp) {
      this.seat(e, type, sx, sy);
      return;
    }
    if (type === 'down') {
      e.preventDefault();
      this.canvas.setPointerCapture?.(e.pointerId);
      // The turn buttons.
      const b = this.buttons.find((q) => Math.hypot(q.x - sx, q.y - sy) < BTN + 10);
      if (b) {
        this.turn(b.dir);
        return;
      }
      if (sy > this.viewH) return;
      // A helper's button, over it: off it goes on its next job.
      const go = this.goButtons().find((b) => Math.hypot(b.x - sx, b.y - sy) < b.r + 10);
      if (go) {
        this.start(go.h);
        return;
      }
      // The nearest helper (or passer-by) within reach of the finger.
      const reach = Math.max(30, this.view.k * 0.55);
      const near = (list) => list.map((h) => {
        const [hx, hy] = this.view.at(h.x, h.y, 0.25);
        return { h, d: Math.hypot(hx - sx, hy - sy) };
      }).filter((o) => o.d < reach).sort((a, c) => a.d - c.d)[0]?.h;
      const h = near(this.helpers);
      if (h) {
        if (this.ready(h)) this.start(h);
        else {
          h.hop = 1;
          this.hooks.sfx?.('tap');
        }
        return;
      }
      const a = near(this.ambient);
      if (a) {
        a.hop = 1;
        this.hooks.sfx?.(a.kind === 'car' ? 'honk' : 'pop');
        return;
      }
      // Otherwise: drag the town about, to look round.
      this.pan = { id: e.pointerId, sx, sy, x: this.cam.x, y: this.cam.y };
      return;
    }
    if (this.pan && e.pointerId === this.pan.id) {
      if (type === 'move') {
        if (Math.hypot(sx - this.pan.sx, sy - this.pan.sy) > 8) this.manual = 4;
        if (this.manual > 0) {
          const d = this.view.shift(sx - this.pan.sx, sy - this.pan.sy);
          this.cam.x = clamp(this.pan.x - d.x, 0, SIZE);
          this.cam.y = clamp(this.pan.y - d.y, 0, SIZE);
        }
      } else this.pan = null;
    }
  }

  // In the driver's seat (or walking the dog), made for a three-year-old:
  // a button you can press does something you can see and hear, at once --
  // never later on. Driving, they work only while you're stopped, and take
  // you no further than the next corner: stopped at the line, ◀ ▲ ▶ are the
  // way through it (the arrow on the road, said out loud) and on to the
  // line at the next one; stopped anywhere else, ▲ on to the corner.
  // Walking, ◀ ▲ ▶ choose the way where it next divides, as you go. A
  // button that would do nothing is faded, and does nothing. The map button: back out to the
  // town. A finger dragged across the windshield looks round; a tap on it
  // honks.
  seat(e, type, sx, sy) {
    const f = this.fp;
    const drag = f.drag;
    if (type === 'move') {
      if (!drag || e.pointerId !== drag.id) return;
      if (Math.abs(sx - drag.sx) > 8) drag.moved = true;
      if (drag.moved) f.look = clamp(drag.look - (sx - drag.sx) / this.eye.F, -LOOK, LOOK);
      return;
    }
    if (type === 'up') {
      if (!drag || e.pointerId !== drag.id) return;
      f.drag = null;
      f.lookT = 0;
      if (!drag.moved) this.hooks.sfx?.(f.h.kind === 'walker' ? 'pop' : 'honk');
      return;
    }
    e.preventDefault();
    const b = this.pads.find((q) => Math.hypot(q.x - sx, q.y - sy) < q.r + 12);
    if (b?.act === 'exit') this.leave();
    else if (b) this.choose(b.act);
    else {
      this.canvas.setPointerCapture?.(e.pointerId);
      f.drag = { id: e.pointerId, sx, look: f.look, moved: false };
    }
  }

  // What a button would do now -- at once -- if anything: start you off,
  // or change the way you go at the corner coming up.
  can(act) {
    const f = this.fp;
    const h = f.h;
    if (act === 'exit') return true;
    if (h.pause > 0 || h.deliver) return false;
    const o = f.options;
    const way = act === 'go' ? 'straight' : act;
    // Driving: only stopped -- at the line, which way through the corner;
    // anywhere else, ▲ on to the corner.
    if (h.kind !== 'walker') return !f.go && (f.atCorner && o ? way === 'straight' || o[way] !== o.straight : act === 'go');
    if (!o) return act === 'go' && !f.go;
    if (f.go) return o[way] !== o.now;
    return way === 'straight' || o[way] !== o.straight;
  }

  // Is a press now the way at the corner coming up? (Not, driving, till
  // you're stopped at it.)
  choosing() {
    const f = this.fp;
    return !!f.options && (f.h.kind === 'walker' || f.atCorner);
  }

  // A button pressed (act: 'go', 'left' or 'right'): if it does anything
  // (see can), do it now.
  choose(act) {
    const f = this.fp;
    this.plan(f);
    if (!this.can(act)) return false;
    const way = this.choosing() ? { go: 'straight', left: 'left', right: 'right' }[act] : null;
    f.go = true;
    if (way) f.intent = way;
    this.plan(f);
    f.flash = { act, t: this.t };
    this.hooks.sfx?.('tap');
    this.tell({ left: 'Left!', right: 'Right!', straight: 'Straight on!' }[way] || 'Let’s go!');
    return true;
  }

  // Is a helper waiting to be started on its next job (its button showing)?
  ready(h) {
    return !this.won && !this.fp && !h.path.length && h.pause <= 0 && !h.deliver && !!this.targetPlace(h);
  }

  // Has a helper started on its job (so where it's going shows)?
  started(h) {
    return this.fp?.h === h || (h.path.length > 0 && !h.budging) || h.pause > 0 || !!h.deliver;
  }

  // Off on its next job: by itself (the early levels) -- or you're its
  // driver.
  start(h) {
    h.hop = 1;
    if (this.town.drive) this.enter(h);
    else {
      this.send(h);
      this.focus = h;
      this.manual = 0;
    }
  }

  // The buttons over the helpers waiting to start, where they are on the
  // screen: { h, x, y, r, icon }.
  goButtons() {
    if (this.fp) return [];
    const { view } = this;
    const r = clamp(view.k * 0.3, 20, 30);
    return this.helpers.filter((h) => this.ready(h)).map((h) => {
      const at = view.at(h.x, h.y, h.kind === 'walker' ? 0.55 : 0.7);
      return at && { h, x: at[0], y: at[1] - r - 10, r, icon: this.nextIcon(h) };
    }).filter(Boolean);
  }

  // The picture of a helper's next job (on its button).
  nextIcon(h) {
    if (h.kind === 'mixer' && !h.loaded) return '🪣';
    const j = nextJob(this.town, h, this.done);
    return j.kind === 'build' && j.stage === 3 ? '🏠' : ICONS[j.kind];
  }

  // Says something (but not the same thing again straight away).
  tell(line) {
    if (line === this.told && this.t - this.toldT < 1.5) return;
    this.told = line;
    this.toldT = this.t;
    this.hooks.say?.(line);
  }

  // Into the driver's seat of a helper (or the dog walker's shoes).
  enter(h) {
    h.path = [];
    h.budging = false;
    this.fp = { h, go: false, v: 0, intent: null, hint: null, head: h.head, look: 0, lookT: 0, drag: null, away: 0, out: null, wheel: 0, done: 0, wait: null, held: null, waited: 0, last: h.kind === 'walker' ? h.node : h.tile };
    this.focus = h;
    this.hooks.sfx?.(h.kind === 'walker' ? 'pop' : 'honk');
    this.hooks.say?.('Let’s go!');
  }

  // Back out to the town (the helper stops at the next street tile).
  leave() {
    const h = this.fp.h;
    this.fp = null;
    if (h.kind === 'walker') h.path = h.path.slice(0, 1);
    else h.path = isJunction(h.path[0]?.x, h.path[0]?.y) ? h.path.slice(0, 2) : h.path.slice(0, 1);
    Object.assign(this.cam, { x: h.x, y: h.y, k: this.kIn });
    this.calm = 0;
    this.manual = 0;
  }

  // A quarter turn of the town (dir 1: clockwise).
  turn(dir) {
    this.rot += dir;
    this.spin = { from: this.view.yaw, to: this.rot, t: 0 };
    this.hooks.sfx?.('tap');
  }

  // ------------------------------------------------------ driving yourself

  fpSteer(dt) {
    const f = this.fp;
    const h = f.h;
    const busy = h.pause > 0 || !!h.deliver;
    // (A little slower than they go by themselves: time to look about, and
    // to turn.)
    // (The camera out of the cab for a delivery -- and back in.)
    if (h.deliver) f.out = h.deliver.cam;
    f.away = clamp(f.away + (h.deliver ? dt : -dt) / 0.8, 0, 1);
    let want = f.go && !busy ? SPEED[h.kind] * 0.7 : 0;
    // (Coming up to a corner with no way chosen: slowing down, to stop at
    // the line.)
    if (f.stopIn != null) want = Math.min(want, 0.35 + 1.6 * f.stopIn);
    f.v += clamp(want - f.v, -6 * dt, 3 * dt);
    this.plan(f);
    // There, and still no way chosen: stop, and ask.
    if (h.kind !== 'walker' && f.go && !f.intent && !h.path.length && !busy) {
      f.go = false;
      this.tell('Which way?');
    }
    // Turning round (the circle at the end of the street): say so.
    const n = h.path[0];
    const round = h.kind !== 'walker' && !!n && atEdge(n.x, n.y) && (n.x !== h.tile.x || n.y !== h.tile.y);
    if (round && !f.round && f.v > 0.1) this.tell('Turn around!');
    f.round = round && f.v > 0.1;
    // Looked round: back to looking ahead, a moment after letting go.
    if (!f.drag && f.look) {
      f.lookT += dt;
      if (f.lookT > 1) f.look = Math.abs(f.look) < 0.01 ? 0 : f.look * (1 - Math.min(1, dt * 3));
    }
    // Which way you're looking, and the wheel, turning with you.
    const d = h.head - f.head;
    const turnRate = Math.atan2(Math.sin(d), Math.cos(d));
    f.head += turnRate * Math.min(1, dt * 6);
    const lean = { left: -0.5, right: 0.5 }[f.intent] || 0;
    f.wheel += (clamp(turnRate * 3, -1.4, 1.4) + lean - f.wheel) * Math.min(1, dt * 6);
    // Held up (for more than a moment): say why, every time -- and say go
    // when you go again.
    const now = f.go && !busy ? h.wait : null;
    f.waited = now && now === f.held ? f.waited + dt : 0;
    f.held = now;
    const wait = now && (now === 'light' || now === 'walk' || f.waited > 0.5) ? now : null;
    if (wait && wait !== 'car' && wait !== f.wait) {
      this.tell({ light: 'Red light. Stop!', walk: 'Wait for the walking man!', people: 'Wait! Someone’s crossing.', turn: 'Wait for the car!' }[wait]);
    } else if (!wait && f.wait === 'light') this.tell('Green light. Go!');
    else if (!wait && f.wait === 'walk') this.tell('Walk!');
    f.wait = wait;
    // Back out to the town a moment after its jobs are all done.
    if (!this.targetPlace(h) && !busy) {
      f.done += dt;
      if (f.done > 1.5) this.leave();
    } else f.done = 0;
  }

  // The way on ahead, as it is right now.
  plan(f) {
    if (f.h.kind === 'walker') this.planWalk(f, f.h);
    else this.planDrive(f, f.h);
  }

  // Driving: the street on ahead from where you are (or the tile you're
  // heading into), turning at the next intersection the way you chose (or,
  // not choosing, the way to the job). You can change your mind right up to
  // the middle of the intersection (choosing after that is for the next
  // one); turned toward someone on a crosswalk, you wait for them.
  planDrive(f, h) {
    if (!isJunction(h.tile.x, h.tile.y) && isJunction(f.last.x, f.last.y)) f.intent = null;
    f.last = h.tile;
    const at = lanePoint(h.tile, h.dir);
    const off = Math.hypot(h.x - at.x, h.y - at.y);
    const inside = isJunction(h.tile.x, h.tile.y);
    if (inside && h.path.length && off > 0.3) {
      // (On the way out: too late to turn now.)
      f.options = null;
      return;
    }
    const moving = !inside && h.path.length > 0 && off > 0.02;
    const base = moving ? h.path[0] : h.tile;
    const dir = moving && (base.x !== h.tile.x || base.y !== h.tile.y) ? { x: base.x - h.tile.x, y: base.y - h.tile.y } : h.dir;
    const to = this.target(h);
    f.hint = to ? driveTurn(base, dir, to) : null;
    const turn = f.intent || f.hint || 'straight';
    f.route = to ? this.driveRoute(base, dir, to, turn) : [];
    const plan = [...(moving ? [base] : []), ...ahead(base, dir, turn)];
    // The corner, and the way out of it (for the arrow on the road).
    const k = plan.findIndex((t) => isJunction(t.x, t.y));
    const j = k >= 0 ? plan[k] : inside ? h.tile : null;
    const exit = k >= 0 ? plan[k + 1] : plan[0];
    const prev = k > 0 ? plan[k - 1] : moving ? h.tile : base;
    const into = inside ? h.dir : j && { x: j.x - prev.x, y: j.y - prev.y };
    f.corner = j && exit ? { at: { x: j.x + 0.5, y: j.y + 0.5 }, into, out: { x: exit.x - j.x, y: exit.y - j.y } } : null;
    // Where each way out of it goes -- if it's the next thing (not round a
    // dead end first: a choice there would be for later on).
    let from = moving ? h.tile : base;
    let next = !!f.corner;
    for (const t of plan) {
      if (isJunction(t.x, t.y)) break;
      if (t.x - from.x === -dir.x && t.y - from.y === -dir.y) next = false;
      from = t;
    }
    const exitOf = (turn) => {
      const pl = [...(moving ? [base] : []), ...ahead(base, dir, turn)];
      const i = pl.findIndex((t) => isJunction(t.x, t.y));
      const e = i >= 0 ? pl[i + 1] : pl[0];
      return e ? `${e.x},${e.y}` : '';
    };
    f.options = next ? { straight: exitOf('straight'), left: exitOf('left'), right: exitOf('right'), now: f.intent ? `${exit.x},${exit.y}` : '' } : null;
    // One block at a time: with no way chosen yet, only as far as the line
    // before the corner (no arrow on the road).
    f.stopIn = null;
    f.atCorner = false;
    if (next && !f.intent && !inside) {
      plan.length = k;
      f.atCorner = k === 0;
      f.corner = null;
      const end = plan.length ? lanePoint(plan[plan.length - 1], dir) : { x: h.x, y: h.y };
      f.stopIn = Math.hypot(end.x - h.x, end.y - h.y);
    }
    // Let through the intersection already, and turning another way now:
    // that crosswalk's yours too (and anyone on it, you wait for).
    if (j && exit && h.pass === `${j.x},${j.y}`) {
      const arm = armOf(j, exit);
      if (!h.passArms.includes(arm)) h.passArms = [h.passArms[0], arm];
    }
    h.path = plan;
  }

  // The way you'd go (for the dots on the road): turning at the first
  // corner the way you chose (first), and after that the way to the job.
  driveRoute(t, d, to, first) {
    const out = [t];
    for (let n = 0; n < 40 && (t.x !== to.x || t.y !== to.y); n++) {
      const corner = isJunction(t.x, t.y);
      const next = ahead(t, d, corner && first ? first : driveTurn(t, d, to))[0];
      if (corner) first = null;
      if (!next) break;
      d = { x: next.x - t.x, y: next.y - t.y };
      t = next;
      out.push(t);
    }
    return out.map((q, i) => lanePoint(q, i ? { x: q.x - out[i - 1].x, y: q.y - out[i - 1].y } : d));
  }

  // Walking the dog: along the sidewalk the way you're facing, round the
  // bends, and where the way divides, the way you asked (or back round).
  planWalk(f, h) {
    const w = this.walk;
    if (h.node !== f.last && w.adj[h.node].length > 2) f.intent = null;
    f.last = h.node;
    const target = this.targetPlace(h);
    const to = target ? this.spot.get(target.id) : null;
    let a = h.node;
    let b = h.path[0];
    if (b === undefined) {
      // Standing still: the way you're facing.
      const p = w.nodes[a];
      const fx = Math.cos(h.head);
      const fy = Math.sin(h.head);
      const dot = (n) => ((w.nodes[n].x - p.x) * fx + (w.nodes[n].y - p.y) * fy) / Math.hypot(w.nodes[n].x - p.x, w.nodes[n].y - p.y);
      b = w.adj[a].map((e) => e.to).sort((u, v) => dot(v) - dot(u))[0];
    }
    let hint = to !== null ? walkTurn(w, a, b, to) : null;
    // Turning round: you chose to, or (not choosing) it's the way to go.
    if (f.intent === 'back' || (!f.intent && hint === 'back')) {
      [a, b] = [b, a];
      if (f.intent === 'back') f.intent = null;
      hint = to !== null ? walkTurn(w, a, b, to) : null;
    }
    f.hint = hint;
    f.route = to !== null ? w.route(b, to).map((n) => w.nodes[n]) : [];
    h.path = [b, ...walkAhead(w, a, b, f.intent || (hint === 'back' ? null : hint) || 'straight')];
    // Where the way divides next, and where each way from there goes.
    const seq = [a, ...h.path];
    const [p, q, r] = seq.slice(-3);
    if (seq.length >= 3 && w.adj[q].length > 2) {
      const unit = (u, v) => {
        const [dx, dy] = [w.nodes[v].x - w.nodes[u].x, w.nodes[v].y - w.nodes[u].y];
        const d = Math.hypot(dx, dy) || 1;
        return { x: dx / d, y: dy / d };
      };
      f.corner = { at: w.nodes[q], into: unit(p, q), out: unit(q, r), s: 0.5 };
      f.options = { straight: onFrom(w, p, q), left: onFrom(w, p, q, 'left'), right: onFrom(w, p, q, 'right'), now: r };
    } else {
      f.corner = null;
      f.options = null;
    }
  }


  // Where the postal worker is, out of the van on a delivery.
  postie(d) {
    const st = d.steps.findLast((q) => q.t <= d.t) || d.steps[0];
    const u = Math.min(1, (d.t - st.t) / st.dur);
    const e = u * u * (3 - 2 * u);
    // (Carrying it: from halfway through taking it out, to halfway through
    // handing it over.)
    const carry = st.carry || (st.do === 'take' && u > 0.5) || (st.do === 'give' && u < 0.5);
    return {
      x: st.a.x + (st.b.x - st.a.x) * e,
      y: st.a.y + (st.b.y - st.a.y) * e,
      head: st.head,
      carry: carry ? d.kind : null,
      walking: st.do === 'walk',
      // (Hopping out and in: up out of the cab and back.)
      z: st.do === 'out' ? (1 - u) * 0.12 : st.do === 'in' ? u * 0.12 : 0,
      step: st.do,
      u,
      // (The van's back doors: open while it's taken out.)
      open: st.do === 'take' || (st.do === 'walk' && st.carry && u < 0.35) || (st.do === 'walk' && !st.carry && st.b === d.steps[2].a && u > 0.7),
    };
  }

  // ------------------------------------------------------------- camera

  // Where the camera wants to be: on the helper that's busy (the one tapped
  // last), close in; a moment after the job's done, back out to see all the
  // helpers and where they're going next. Still for a while after the town's
  // been dragged.
  goal(dt) {
    const busy = (h) => h.path.length > 0 || h.pause > 0 || !!h.deliver;
    if (this.won) return { x: SIZE / 2, y: SIZE / 2, k: this.kFit };
    const f = (this.focus && busy(this.focus) && this.focus) || this.helpers.find(busy);
    if (f) {
      this.focus = f;
      this.calm = 0;
      return this.manual > 0 ? null : { x: f.x, y: f.y, k: this.kIn };
    }
    this.calm += dt;
    if (this.manual > 0 || this.calm < 0.9) return null;
    if (this.intro > 0) return { x: SIZE / 2, y: SIZE / 2, k: this.kFit };
    const pts = [];
    for (const h of this.helpers) {
      pts.push([h.x, h.y]);
      const p = this.targetPlace(h);
      if (p) pts.push([p.x + (p.w || 1) / 2, p.y + (p.h || 1) / 2]);
    }
    const { c, s } = this.view;
    let [u0, u1, v0, v1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of pts) {
      const u = x * c - y * s;
      const v = x * s + y * c;
      [u0, u1, v0, v1] = [Math.min(u0, u), Math.max(u1, u), Math.min(v0, v), Math.max(v1, v)];
    }
    const k = clamp(Math.min((this.W - 100) / (u1 - u0 + 1e-6), (this.viewH - 160) / ((v1 - v0) * 0.5 + 1e-6)), this.kFit, this.kOut);
    const um = (u0 + u1) / 2;
    const vm = (v0 + v1) / 2 - 0.4; // (a little higher: the arrows stand up over the places)
    return { x: um * c + vm * s, y: -um * s + vm * c, k };
  }

  camera(dt) {
    if (this.spin) {
      this.spin.t = Math.min(1, this.spin.t + dt / 0.6);
      const u = this.spin.t;
      this.view.turn(this.spin.from + (this.spin.to - this.spin.from) * u * u * (3 - 2 * u));
      if (u >= 1) this.spin = null;
    }
    this.intro -= dt;
    this.manual -= dt;
    const c = this.cam;
    const goal = this.fp ? null : this.goal(dt);
    if (goal) {
      const a = 1 - Math.exp(-dt * 2.6);
      c.x += (goal.x - c.x) * a;
      c.y += (goal.y - c.y) * a;
      c.k += (goal.k - c.k) * (1 - Math.exp(-dt * 1.8));
    }
    c.x = clamp(c.x, 0, SIZE);
    c.y = clamp(c.y, 0, SIZE);
    Object.assign(this.view, { x: c.x, y: c.y, k: c.k });
  }

  // ------------------------------------------------------------- update

  update(dt) {
    this.t += dt;
    this.traffic.t = this.t;
    this.passTime(dt);
    if (this.fp) this.fpSteer(dt);
    const move = (m) => {
      if (m.pause > 0) {
        m.pause -= dt;
        if (m.pause <= 0 && m.then) {
          m.then = false;
          this.send(m);
        }
        return;
      }
      m.playing = 0;
      const helper = m.kind !== 'car' && m.kind !== 'person';
      const speed = this.fp?.h === m ? this.fp.v : SPEED[m.kind];
      if (m.kind === 'walker' || m.kind === 'person') {
        const node = this.traffic.walk(m, speed, dt);
        if (node !== null && helper) this.reached(m, node);
      } else {
        const tile = this.traffic.drive(m, speed, dt);
        // (Jobs as it gets to them -- not on its way home out of the way.)
        if (tile && helper && !m.budging) this.arrive(m, tile);
        if (!m.path.length) m.budging = false;
      }
    };
    for (const h of this.helpers) {
      move(h);
      h.hop = Math.max(0, h.hop - dt * 2.5);
      if (h.deliver) {
        const d = h.deliver;
        const was = d.t;
        d.t += dt;
        const at = (step, u) => {
          const st = d.steps.find((q) => q.do === step);
          return st.t + st.dur * u;
        };
        // (Out of the back of the van; then at the door, over it goes.)
        if (was < at('take', 0.5) && d.t >= at('take', 0.5)) {
          const p = this.postie(d);
          this.pop('✨', { x: p.x - 0.5, y: p.y - 0.5 }, 0.4);
          this.hooks.sfx?.('pop');
        }
        if (was < at('give', 0.5) && d.t >= at('give', 0.5)) this.handOver(h);
        if (d.t >= d.total) h.deliver = null;
      }
      // A helper held up at a red light: say so (now and then), and say go.
      // (Yours, from the driver's seat: fpSteer says, every time.)
      if (this.fp?.h === h) continue;
      if ((h.wait === 'light' || h.wait === 'walk') && !h.held && this.t - this.said > 15) {
        h.held = true;
        this.said = this.t;
        this.hooks.say?.(h.wait === 'walk' ? 'Wait for the walking man!' : 'Red light. Stop!');
      } else if (h.held && !h.wait) {
        h.held = false;
        if (h.path.length) this.hooks.say?.(h.kind === 'walker' ? 'Walk!' : 'Green light. Go!');
      }
    }
    for (const a of this.ambient) {
      if (!a.path.length && a.pause <= 0) {
        if (a.kind === 'car') a.path = drivePath(a.tile, a.dir, this.anyStreet()).slice(1);
        else a.path = this.walk.route(a.node, this.anyWhere()).slice(1);
        a.pause = 0.5 + this.rand() * 2;
      }
      move(a);
      a.hop = Math.max(0, a.hop - dt * 2.5);
    }
    // (Where you are now: the way on, and what the buttons would do.)
    if (this.fp) this.plan(this.fp);
    // Everyone on foot turns smoothly to face the way they're going. (Cars
    // and trucks: the traffic turns them, as they go.)
    for (const m of [...this.helpers, ...this.ambient]) {
      if (this.traffic.cars.includes(m)) continue;
      const dx = m.x - m.px;
      const dy = m.y - m.py;
      if (dx * dx + dy * dy > 1e-8) {
        const d = Math.atan2(dy, dx) - m.head;
        m.head += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 12);
      }
      m.px = m.x;
      m.py = m.y;
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 1.4);
    for (const c of this.confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.a += dt * 6;
    }
    this.confetti = this.confetti.filter((c) => c.y < this.H + 20);
    this.camera(dt);
  }

  // --------------------------------------------------------------- draw

  draw() {
    const { g } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.fp) this.drawSeat();
    else this.drawTown();
    for (const c of this.confetti) {
      g.save();
      g.translate(c.x, c.y);
      g.rotate(c.a);
      g.fillStyle = c.c;
      g.fillRect(-5, -3, 10, 6);
      g.restore();
    }
  }

  // The sky, the colour of the time of day: the sun going over (or the
  // moon), and at night the stars.
  sky(h) {
    const { g } = this;
    const [top, bottom] = sky(this.clock);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.W, h);
    const dark = 1 - light(this.clock).bright;
    if (dark > 0.3) {
      g.fillStyle = '#ffffff';
      for (const [x, y, s] of this.stars) {
        g.globalAlpha = Math.min(1, (dark - 0.3) * 2) * (0.6 + 0.4 * Math.sin(this.t * 2 + x * 40));
        g.fillRect(x * this.W, y * h, s * 1.6, s * 1.6);
      }
      g.globalAlpha = 1;
    }
    const { sun, u } = sunAt(this.clock);
    const x = this.W * (0.08 + 0.84 * u);
    const y = h * (0.3 - 0.22 * Math.sin(Math.PI * u));
    const r = Math.min(26, h * 0.05);
    g.fillStyle = sun ? 'rgba(255,220,120,0.35)' : 'rgba(255,255,255,0.15)';
    g.beginPath();
    g.arc(x, y, r * 1.7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = sun ? '#ffd23f' : '#f4f1de';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (!sun) {
      // (A crescent: a bite out of it, the colour of the sky.)
      g.fillStyle = top;
      g.beginPath();
      g.arc(x + r * 0.45, y - r * 0.2, r * 0.85, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Dusk and night over the town (in the view h high): darker and bluer,
  // a glow of gold at sunset -- and the lights coming on: the houses'
  // windows, the streetlamps on the corners, the cars' headlights.
  dusk(view, h) {
    const { g } = this;
    const { bright, warm } = light(this.clock);
    const dark = 1 - bright;
    if (warm > 0.05) {
      g.fillStyle = `rgba(255,140,60,${0.12 * warm})`;
      g.fillRect(0, 0, this.W, h);
    }
    if (dark < 0.05) return;
    g.fillStyle = `rgba(14,20,64,${0.62 * dark})`;
    g.fillRect(0, 0, this.W, h);
    const on = Math.min(1, Math.max(0, (dark - 0.35) * 2.5));
    if (!on) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const glow = (x, y, z, size, rgb, a) => {
      if (!this.seen(view, x, y)) return;
      const at = view.at(x, y, z);
      if (!at) return;
      const r = Math.min(260, view.scale(x, y, z) * size);
      const grad = g.createRadialGradient(at[0], at[1], 0, at[0], at[1], r);
      grad.addColorStop(0, `rgba(${rgb},${a * on})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(at[0], at[1], r, 0, Math.PI * 2);
      g.fill();
    };
    for (const p of this.town.places) {
      if (p.kind === 'home' || p.kind === 'post' || p.kind === 'shop' || p.kind === 'cafe' || (p.kind === 'lot' && this.stage[p.id] === 3)) {
        glow(p.x + 0.5, p.y + 0.5, 0.3, 0.45, '255,210,120', 0.55);
      }
    }
    for (const { x, y } of this.junctions) glow(x + 0.5, y + 0.5, 0.02, 0.9, '255,230,170', 0.35);
    for (const c of this.traffic.cars) {
      if (this.fp?.h === c && !(this.fp.away > 0.25)) continue;
      const [fx, fy] = [Math.cos(c.head), Math.sin(c.head)];
      glow(c.x + fx * ((c.len || 0.38) + 0.25), c.y + fy * ((c.len || 0.38) + 0.25), 0.02, 0.35, '255,245,200', 0.6);
    }
    g.restore();
  }

  // The town from above.
  drawTown() {
    const { g, view } = this;
    const k = view.k;
    this.sky(this.viewH);
    g.save();
    g.beginPath();
    g.rect(0, 0, this.W, this.viewH);
    g.clip();
    I.paint(g, view, I.slab(SIZE).parts);
    this.drawGround(view);
    // Everything standing up, back to front -- see-through when it's in
    // front of a helper.
    const spots = this.helpers.map((h) => ({ d: view.depth(h.x, h.y), at: view.at(h.x, h.y, 0.2) }));
    for (const o of this.things(view).sort((a, b) => a.d - b.d)) {
      let alpha = 1;
      if (o.tall) {
        const [ox, oy] = view.at(o.x, o.y);
        if (spots.some((s) => s.d < o.d && Math.abs(s.at[0] - ox) < k * 0.5 && s.at[1] > oy - k * o.tall && s.at[1] < oy + k * 0.3)) alpha = 0.35;
      }
      o.draw(alpha);
    }
    this.dusk(view, this.viewH);
    this.overlays(view, this.helpers.filter((h) => h.path.length > 0 && !h.budging));
    this.drawGo();
    g.restore();
    this.drawTray(false);
  }

  // From the driver's seat (the walker's eyes; the postal worker's, out on
  // a delivery): the town all round at street level, the way to the job in
  // dots, the dashboard and wheel -- and the buttons.
  drawSeat() {
    const { g, eye } = this;
    const f = this.fp;
    const h = f.h;
    const d = h.deliver;
    if (h.kind === 'walker') eye.set(h.x - Math.cos(f.head) * 0.14, h.y - Math.sin(f.head) * 0.14, 0.5, f.head + f.look, -0.34);
    else eye.set(h.x + Math.cos(f.head) * 0.2, h.y + Math.sin(f.head) * 0.2, 0.36, f.head + f.look, -0.16);
    // On a delivery, the camera floats out of the cab to watch from across
    // the street (and back in after).
    const c = f.out;
    if (f.away > 0 && c) {
      const k = f.away * f.away * (3 - 2 * f.away);
      const mix = (a, b) => a + (b - a) * k;
      const turn = Math.atan2(Math.sin(c.h + f.look - eye.h), Math.cos(c.h + f.look - eye.h));
      eye.set(mix(eye.x, c.x), mix(eye.y, c.y), mix(eye.z, c.z), eye.h + turn * k, mix(eye.pitch, c.pitch));
    }
    this.sky(this.seatH);
    g.save();
    g.beginPath();
    g.rect(0, 0, this.W, this.seatH);
    g.clip();
    // Fields all round the town, then the town.
    I.rect(g, eye, -40, -40, SIZE + 40, SIZE + 40, '#7cc15a');
    I.rect(g, eye, 0, 0, SIZE, SIZE, '#8fd16a');
    this.drawGround(eye);
    // The way to the job: dots along it.
    if (!d) {
      const pts = f.route || [];
      let left = 0;
      for (let i = 1; i < pts.length; i++) {
        const [a, b] = [pts[i - 1], pts[i]];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        for (; left < len; left += 0.35) {
          const u = left / len;
          const [px, py] = [a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u];
          if (Math.hypot(px - eye.x, py - eye.y) > 0.6) I.disc(g, eye, px, py, 0.06, 0.06, '#ffd166', 0.01);
        }
        left -= len;
      }
    }
    // The way you'll go at the next corner: a big arrow on the road (bright
    // when it's the way you chose).
    if (f.corner && !d) this.roadArrow(eye, f.corner);
    for (const o of this.things(eye).sort((a, b) => a.d - b.d)) o.draw(1);
    this.dusk(eye, this.seatH);
    this.overlays(eye, d ? [] : [h]);
    // In the cab: the dashboard and the wheel, turning as you turn (going
    // as the camera floats out).
    if (h.kind !== 'walker' && f.away < 0.3) this.dashboard(h, f.wheel);
    // Held up: why, big, up top -- a red light, the red hand, someone
    // crossing, a car.
    if (f.wait) this.waitSign(f.wait);
    g.restore();
    this.drawPads();
    this.drawTray(true);
  }

  // An arrow painted on the road through an intersection: in, and out the
  // way you'll go.
  roadArrow(view, { at, into, out, s = 1 }) {
    const { x: cx, y: cy } = at;
    const fill = '#ffd166';
    const bar = (ax, ay, bx, by) => {
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const [nx, ny] = [(-(by - ay) / len) * 0.08 * s, ((bx - ax) / len) * 0.08 * s];
      I.flat(this.g, view, [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]], fill, 0.012);
    };
    bar(cx - into.x * 0.45 * s, cy - into.y * 0.45 * s, cx + into.x * 0.08 * s, cy + into.y * 0.08 * s);
    bar(cx - out.x * 0.08 * s, cy - out.y * 0.08 * s, cx + out.x * 0.3 * s, cy + out.y * 0.3 * s);
    const [tx, ty] = [cx + out.x * 0.58 * s, cy + out.y * 0.58 * s];
    const [bx, by] = [cx + out.x * 0.28 * s, cy + out.y * 0.28 * s];
    I.flat(this.g, view, [[tx, ty], [bx - out.y * 0.2 * s, by + out.x * 0.2 * s], [bx + out.y * 0.2 * s, by - out.x * 0.2 * s]], fill, 0.012);
  }

  // Why you're waiting, as a big picture at the top of the view.
  waitSign(why) {
    const { g } = this;
    const x = this.W / 2;
    const y = 112;
    const r = 46 + Math.sin(this.t * 6) * 3;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.strokeStyle = '#e63946';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (why === 'light') D.signal(g, x, y, 170, 'red');
    else if (why === 'walk') D.walkSign(g, x, y, 300, 'stop', 0);
    else {
      g.font = '50px system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(why === 'people' ? '🚶' : '🚗', x, y + 2);
    }
  }

  // The dashboard across the bottom of the windscreen, in the cab's colour,
  // and the steering wheel.
  dashboard(h, wheel) {
    const { g, W } = this;
    const top = this.seatH - Math.min(90, this.seatH * 0.16);
    g.fillStyle = { garbage: '#2f3e46', mail: '#3d0e14', mixer: '#4a3b1a' }[h.kind] || '#333333';
    g.beginPath();
    g.moveTo(0, this.seatH);
    g.lineTo(0, top + 18);
    g.quadraticCurveTo(W / 2, top - 14, W, top + 18);
    g.lineTo(W, this.seatH);
    g.closePath();
    g.fill();
    const r = Math.min(W * 0.2, 80);
    const cx = W / 2;
    const cy = this.seatH + r * 0.25;
    g.save();
    g.translate(cx, cy);
    g.rotate(wheel);
    g.strokeStyle = '#1b1b1b';
    g.lineWidth = r * 0.22;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = r * 0.14;
    g.beginPath();
    for (const a of [Math.PI, 0, -Math.PI / 2]) {
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.stroke();
    g.fillStyle = COLORS[h.kind];
    g.beginPath();
    g.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // The buttons over the helpers waiting to start: a round button in the
  // helper's colour, with its next job's picture, pulsing gently, and a
  // little green "go" in the corner.
  drawGo() {
    const { g } = this;
    for (const b of this.goButtons()) {
      const r = b.r * (1 + Math.sin(this.t * 5) * 0.06);
      const c = COLORS[b.h.kind];
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath();
      g.arc(b.x, b.y + 3, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(b.x - r * 0.35, b.y + r * 0.8);
      g.lineTo(b.x, b.y + r + 9);
      g.lineTo(b.x + r * 0.35, b.y + r * 0.8);
      g.fill();
      g.beginPath();
      g.arc(b.x, b.y, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(b.x, b.y, r * 0.78, 0, Math.PI * 2);
      g.fill();
      g.font = `${Math.round(r * 0.95)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(b.icon, b.x, b.y + 1);
      const [gx, gy, gr] = [b.x + r * 0.72, b.y - r * 0.72, r * 0.42];
      g.fillStyle = '#2ecc71';
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(gx, gy, gr, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(gx - gr * 0.3, gy - gr * 0.45);
      g.lineTo(gx + gr * 0.5, gy);
      g.lineTo(gx - gr * 0.3, gy + gr * 0.45);
      g.closePath();
      g.fill();
    }
  }

  // Arrows over where the helpers (those given) are going, and -- once the
  // mail van's started -- the letters and parcels houses are waiting for;
  // little pictures popping up where a job was done.
  overlays(view, pointing) {
    const { g } = this;
    const bob = Math.sin(this.t * 5) * 0.06;
    const size = (x, y, z) => Math.min(150, view.scale(x, y, z));
    const waiting = new Map();
    const mail = this.helpers.find((h) => h.kind === 'mail');
    for (const j of this.town.jobs) if (mail && this.started(mail) && !this.done.has(j.i) && (j.kind === 'letter' || j.kind === 'parcel')) waiting.set(j.place, ICONS[j.kind]);
    for (const p of this.town.places) {
      if (!waiting.has(p.id)) continue;
      const [x, y, z] = [p.x + (p.w || 1) / 2, p.y + (p.h || 1) / 2, 0.75];
      const at = view.at(x, y, z);
      if (at) D.bubble(g, at[0], at[1], size(x, y, z) * 0.9, waiting.get(p.id), bob * size(x, y, z));
    }
    for (const h of pointing) {
      const dest = this.targetPlace(h);
      if (!dest) continue;
      const [x, y, z] = [dest.x + (dest.w || 1) / 2, dest.y + (dest.h || 1) / 2, 0.85];
      const at = view.at(x, y, z);
      if (at) D.arrow(g, at[0], at[1], size(x, y, z), COLORS[h.kind], bob * size(x, y, z));
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const f of this.fx) {
      const at = view.at(f.x, f.y, 0.7 + f.t * 0.8);
      if (!at) continue;
      g.globalAlpha = Math.max(0, 1 - f.t / 1.4);
      g.font = `${Math.round(size(f.x, f.y, 0.7) * (0.5 + f.t * 0.3) * f.k)}px system-ui, sans-serif`;
      g.fillText(f.icon, at[0], at[1]);
    }
    g.globalAlpha = 1;
  }

  // The driving buttons: ◀ ▲ ▶ along the bottom (the way to turn glowing),
  // and the way back out to the town, top left.
  drawPads() {
    const { g } = this;
    const f = this.fp;
    g.fillStyle = '#f1f5f9';
    g.fillRect(0, this.seatH, this.W, this.H - this.seatH);
    const glow = 0.5 + 0.5 * Math.sin(this.t * 8);
    for (const b of this.pads) {
      // (Faded: it would do nothing now, so it does nothing. Glowing: the
      // way to the job at the corner coming up -- or ▲, with no corner to
      // choose at. Just pressed: a flash.)
      const live = this.can(b.act);
      g.globalAlpha = live ? 1 : 0.25;
      const way = b.act === 'go' ? 'straight' : b.act;
      const lit = live && way === (this.choosing() ? f.hint || 'straight' : 'straight');
      const flash = f.flash?.act === b.act ? Math.max(0, 1 - (this.t - f.flash.t) / 0.4) : 0;
      if (lit || flash) {
        g.fillStyle = `rgba(255,200,0,${Math.max(lit ? 0.35 + 0.4 * glow : 0, flash)})`;
        g.beginPath();
        g.arc(b.x, b.y, b.r + 9 + flash * 6, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = b.act === 'go' ? '#2ecc71' : '#ffffff';
      g.strokeStyle = '#1d3557';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      if (b.act === 'exit') {
        g.font = `${Math.round(b.r * 1.1)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('🗺️', b.x, b.y + 1);
        continue;
      }
      // An arrow: up, left or right.
      const a = { go: -Math.PI / 2, left: Math.PI, right: 0 }[b.act];
      const s = b.r * 0.55;
      g.fillStyle = b.act === 'go' ? '#ffffff' : '#1d3557';
      g.beginPath();
      g.moveTo(b.x + Math.cos(a) * s, b.y + Math.sin(a) * s);
      g.lineTo(b.x + Math.cos(a + 2.4) * s, b.y + Math.sin(a + 2.4) * s);
      g.lineTo(b.x + Math.cos(a - 2.4) * s, b.y + Math.sin(a - 2.4) * s);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Could anything at (x, y) show, from this camera?
  seen(view, x, y) {
    if (view instanceof I.Eye) return view.sees(x, y);
    const [sx, sy] = view.at(x, y);
    const k = view.k;
    return sx > -k * 1.3 && sx < this.W + k * 1.3 && sy > -k * 0.7 && sy < this.viewH + k * 1.3;
  }

  // Which way the street at the edge of town (x, y) goes out of it.
  outOf(x, y) {
    if (isRoad(x, y - 1) || isRoad(x, y + 1)) return { x: 0, y: y === 0 ? -1 : 1 };
    return { x: x === 0 ? -1 : 1, y: 0 };
  }

  // The ground: the places' yards, the sidewalks and streets, the middle
  // lines, crosswalks and stop lines.
  drawGround(view) {
    const { g } = this;
    const R = (x0, y0, x1, y1, c) => I.rect(g, view, x0, y0, x1, y1, c);
    for (const p of this.town.places) {
      const c = { park: '#6cc04a', lot: '#c8a27a', dump: '#a98467', yard: '#e9c46a' }[p.kind];
      if (c) R(p.x + 0.06, p.y + 0.06, p.x + (p.w || 1) - 0.06, p.y + (p.h || 1) - 0.06, c);
      if (p.kind === 'park') I.disc(g, view, p.x + 1.25, p.y + 1.2, 0.42, 0.3, '#4cc9f0');
    }
    const roads = [];
    for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) if (isRoad(x, y) && this.seen(view, x + 0.5, y + 0.5)) roads.push([x, y]);
    const W = 0.18;
    for (const [x, y] of roads) R(x - W, y - W, x + 1 + W, y + 1 + W, '#b5bac2');
    for (const [x, y] of roads) R(x - W + 0.02, y - W + 0.02, x + 1 + W - 0.02, y + 1 + W - 0.02, '#e1e4e9');
    for (const [x, y] of roads) R(x - 0.003, y - 0.003, x + 1.003, y + 1.003, '#5d6470');
    // The turning circles at the ends of the streets, round an island.
    for (const [x, y] of roads) {
      if (!atEdge(x, y)) continue;
      const o = circleAt({ x, y }, this.outOf(x, y));
      I.disc(g, view, o.x, o.y, CIRCLE.paved, CIRCLE.paved, '#5d6470', 0.001);
      I.disc(g, view, o.x, o.y, CIRCLE.island + 0.03, CIRCLE.island + 0.03, '#e1e4e9', 0.004);
      I.disc(g, view, o.x, o.y, CIRCLE.island, CIRCLE.island, '#6cc04a', 0.006);
    }
    const white = '#f8f9fa';
    for (const [x, y] of roads) {
      if (isJunction(x, y) || atEdge(x, y)) continue;
      const ns = isRoad(x, y - 1) || isRoad(x, y + 1);
      const a = (ns ? isJunction(x, y - 1) : isJunction(x - 1, y)) ? 0.44 : 0;
      const b = (ns ? isJunction(x, y + 1) : isJunction(x + 1, y)) ? 0.56 : 1;
      for (let u = a + 0.04; u < b - 0.04; u += 0.32) {
        const e = Math.min(b, u + 0.18);
        if (ns) R(x + 0.475, y + u, x + 0.525, y + e, white);
        else R(x + u, y + 0.475, x + e, y + 0.525, white);
      }
    }
    for (const { ix: x, iy: y, arm } of this.crossings) {
      if (!this.seen(view, x + 0.5, y + 0.5)) continue;
      for (let q = 0; q < 5; q++) {
        const o = 0.06 + q * 0.2;
        if (arm === 'n') R(x + o, y - 0.4, x + o + 0.1, y - 0.1, white);
        if (arm === 's') R(x + o, y + 1.1, x + o + 0.1, y + 1.4, white);
        if (arm === 'w') R(x - 0.4, y + o, x - 0.1, y + o + 0.1, white);
        if (arm === 'e') R(x + 1.1, y + o, x + 1.4, y + o + 0.1, white);
      }
      if (arm === 'n') R(x, y - 0.48, x + 0.5, y - 0.44, white);
      if (arm === 's') R(x + 0.5, y + 1.44, x + 1, y + 1.48, white);
      if (arm === 'w') R(x - 0.48, y + 0.5, x - 0.44, y + 1, white);
      if (arm === 'e') R(x + 1.44, y, x + 1.48, y + 0.5, white);
    }
    // Shadows under everyone.
    for (const m of [...this.helpers, ...this.ambient]) {
      if (this.fp?.h === m && !(this.fp.away > 0.25)) continue; // (you, in the cab)
      const r = m.kind === 'person' || m.kind === 'walker' ? 0.12 : 0.3;
      if (view instanceof I.Eye && Math.hypot(m.x - view.x, m.y - view.y) < 0.45) continue;
      if (this.seen(view, m.x, m.y)) I.disc(g, view, m.x, m.y, r, r, 'rgba(0,0,0,0.16)');
    }
  }

  // Everything standing up in the town: { x, y (where it stands), d (how
  // near), tall (how high it stands, if it can hide a helper), draw(alpha) }.
  // (From the driver's seat, not the truck you're in -- just the dog, when
  // you're walking it.)
  things(view) {
    const { g, t } = this;
    const list = [];
    const add = (x, y, draw, tall = 0, close = 0.2) => {
      if (!this.seen(view, x, y)) return;
      // (Not anyone right on top of you, filling the view.)
      if (view instanceof I.Eye && Math.hypot(x - view.x, y - view.y) < close) return;
      list.push({ x, y, d: view.depth(x, y), tall, draw });
    };
    const model = (m, tall, close) => add(m.x, m.y, (a) => I.paint(g, view, m.parts, a), tall, close);
    const sign = (x, y, z, icon) => {
      const at = view.at(x, y, z);
      if (!at) return;
      g.font = `${Math.round(Math.min(120, view.scale(x, y, z) * 0.34))}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(icon, at[0], at[1]);
    };
    const taken = new Set();
    for (const p of this.town.places) {
      for (let x = p.x; x < p.x + (p.w || 1); x++) for (let y = p.y; y < p.y + (p.h || 1); y++) taken.add(y * SIZE + x);
      const cx = p.x + (p.w || 1) / 2;
      const cy = p.y + (p.h || 1) / 2;
      const h = Math.atan2(p.door.y - p.y, p.door.x - p.x);
      if (p.kind === 'home') model(I.house(cx, cy, h, p.color), 0.95);
      else if (BUILDINGS[p.kind]) {
        const m = I.building(cx, cy, h, ...BUILDINGS[p.kind]);
        add(cx, cy, (a) => {
          I.paint(g, view, m.parts, a);
          g.globalAlpha = a;
          sign(cx + Math.cos(h) * 0.39, cy + Math.sin(h) * 0.39, 0.47, SIGNS[p.kind]);
          g.globalAlpha = 1;
        }, 0.95);
      } else if (p.kind === 'lot') {
        if (this.stage[p.id]) model(I.house(cx, cy, h, p.color, this.stage[p.id]), 0.95);
        else model(I.stakes(cx, cy));
      } else if (p.kind === 'dump' || p.kind === 'yard') {
        const m = p.kind === 'dump' ? I.heap(cx, cy) : I.bricks(cx, cy);
        add(cx, cy, (a) => {
          I.paint(g, view, m.parts, a);
          sign(cx, cy, 0.6, SIGNS[p.kind]);
        });
      } else if (p.kind === 'park') {
        for (const [tx, ty, size] of [[0.45, 0.5, 1.1], [1.5, 0.45, 0.95], [0.5, 1.5, 0.9]]) model(I.tree(p.x + tx, p.y + ty, size), 0.75);
        model(I.bench(p.x + 0.95, p.y + 0.9));
      }
      // A bin out by the door, waiting for the truck.
      if (this.town.jobs.some((j) => j.kind === 'bin' && j.place === p.id && !this.done.has(j.i))) {
        model(I.bin(cx + (p.door.x - p.x) * 0.4, cy + (p.door.y - p.y) * 0.4));
      }
    }
    // Trees where there's nothing else -- and a little one on each island.
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        if (isRoad(x, y) && atEdge(x, y)) {
          const o = circleAt({ x, y }, this.outOf(x, y));
          model(I.tree(o.x, o.y, 0.55), 0.45);
        }
        if (isRoad(x, y) || taken.has(y * SIZE + x)) continue;
        model(I.tree(x + 0.32, y + 0.36, 1), 0.75);
        model(I.tree(x + 0.7, y + 0.68, 0.8), 0.6);
      }
    }
    // The traffic lights on the corners, and the walk signals by the
    // crosswalks (drawn flat, facing you).
    const flatOn = (x, y, z, draw) => {
      const at = view.at(x, y, z);
      if (at) draw(at, Math.min(220, view.scale(x, y, z)));
    };
    // Each light is on the far right-hand corner for the traffic it's for,
    // facing it (n: the way it faces): its lamps only show from in front.
    const front = (nx, ny, px, py) => {
      const [dx, dy] = view === this.eye ? [view.x - px, view.y - py] : [view.eye[0], view.eye[1]];
      return nx * dx + ny * dy > 0.6 * Math.hypot(dx, dy);
    };
    const POLES = [
      [-0.1, -0.34, 'ew', 1, 0], // going west
      [1.1, -0.34, 'ns', 0, 1], // going north
      [-0.1, 1.24, 'ns', 0, -1], // going south
      [1.1, 1.24, 'ew', -1, 0], // going east
    ];
    for (const { x, y } of this.junctions) {
      if (!isLit(x, y)) continue;
      const l = lights(x, y, t);
      for (const [cx, cy, axis, nx, ny] of POLES) {
        const m = I.pole(x + cx, y + cy, 0.42);
        add(x + cx, y + cy, () => {
          I.paint(g, view, m.parts);
          const back = !front(nx, ny, x + cx, y + cy);
          flatOn(x + cx, y + cy, 0.62, ([sx, sy], s) => D.signal(g, sx, sy, s * 0.8, l[axis], back));
        });
      }
    }
    const ENDS = { n: [[-0.1, -0.62], [1.1, -0.62]], s: [[-0.1, 1.62], [1.1, 1.62]], w: [[-0.62, -0.1], [-0.62, 1.1]], e: [[1.62, -0.1], [1.62, 1.1]] };
    for (const c of this.crossings) {
      if (!isLit(c.ix, c.iy)) continue;
      const sign2 = walkSignal(c, t);
      for (const [cx, cy] of ENDS[c.arm]) {
        const m = I.pole(c.ix + cx, c.iy + cy, 0.3);
        add(c.ix + cx, c.iy + cy, () => {
          I.paint(g, view, m.parts);
          flatOn(c.ix + cx, c.iy + cy, 0.38, ([sx, sy], s) => D.walkSign(g, sx, sy, s * 0.7, sign2, t));
        });
      }
    }
    // Everyone on the move. (Helpers with work to do bob now and then, to
    // say "tap me".)
    for (const m of [...this.ambient, ...this.helpers]) {
      const helper = this.helpers.includes(m);
      const idle = helper && !m.path.length && m.pause <= 0 && this.target(m);
      const lift = Math.sin(m.hop * Math.PI) * 0.35 + (idle && !this.fp ? Math.max(0, Math.sin(t * 4)) * 0.15 : 0);
      const going = m.path.length > 0 && !m.wait;
      const me = this.fp?.h === m;
      if (m.kind === 'person' || m.kind === 'walker') {
        const dog = m.kind === 'walker';
        if (me) model(I.dog(m.x, m.y, m.head, t, going), 0, 0);
        else model(I.person(m.x, m.y, m.head, t, dog ? COLORS.walker : m.color, { walking: going || m.playing > 0, dog, z: lift }), 0, 0.45);
      } else if (!me || this.fp.away > 0.25) {
        const v = I.vehicle(m.kind, m.x, m.y, m.head, t, m.color, lift, !!m.deliver && this.postie(m.deliver).open);
        add(m.x, m.y, (a) => {
          I.paint(g, view, v.parts, a);
          if (m.kind === 'garbage' && m.load) sign(m.x, m.y, 0.75 + lift, '🗑️'.repeat(Math.min(3, m.load)));
        });
      }
      // The postal worker out of the van, round the back for the letter or
      // parcel, up to the door with it, and back without it.
      if (m.deliver) {
        const p = this.postie(m.deliver);
        model(I.person(p.x, p.y, p.head, t, '#1d4e89', { walking: p.walking, postie: true, carry: p.carry, z: p.z }));
      }
    }
    return list;
  }

  // The level's jobs as pictures, each ticked off when it's done: in the
  // band at the bottom between the two turn buttons -- or, in the driver's
  // seat, small along the top.
  drawTray(seat) {
    const { g } = this;
    const jobs = this.town.jobs;
    const box = seat ? 30 : BOX;
    const gap = seat ? 4 : 5;
    const per = seat ? Math.max(1, Math.floor((this.W - 90) / (box + gap))) : this.per;
    const cols = Math.min(jobs.length, per);
    const rows = Math.ceil(jobs.length / per);
    let y0;
    if (seat) {
      y0 = 10;
    } else {
      const top = this.viewH;
      g.fillStyle = '#f1f5f9';
      g.fillRect(0, top, this.W, this.trayH);
      g.fillStyle = 'rgba(0,0,0,0.08)';
      g.fillRect(0, top, this.W, 2);
      y0 = top + (this.trayH - rows * (box + gap) + gap) / 2;
    }
    // (No jobs just now: the time of day, big.)
    if (!jobs.length && !seat) {
      g.font = `${Math.round(BOX * 0.9)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText({ dawn: '🌅', morning: '🌤️', midday: '☀️', evening: '🌇', night: '🌙' }[partAt(this.clock)], this.W / 2, this.viewH + this.trayH / 2);
    }
    const x0 = seat ? 70 + (this.W - 70 - cols * (box + gap)) / 2 : (this.W - cols * (box + gap) + gap) / 2;
    jobs.forEach((j, n) => {
      const x = x0 + (n % per) * (box + gap);
      const y = y0 + Math.floor(n / per) * (box + gap);
      const done = this.done.has(j.i);
      g.fillStyle = done ? '#c7f9cc' : '#fff';
      g.strokeStyle = COLORS[this.town.helpers.find((h) => h.id === j.helper).kind];
      g.lineWidth = seat ? 2 : 3;
      g.beginPath();
      g.roundRect(x, y, box, box, seat ? 7 : 10);
      g.fill();
      g.stroke();
      g.font = `${Math.round(box * 0.6)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.globalAlpha = done ? 0.45 : 1;
      g.fillText(j.kind === 'build' && j.stage === 3 ? '🏠' : ICONS[j.kind], x + box / 2, y + box / 2 + 1);
      g.globalAlpha = 1;
      if (done) {
        g.font = `900 ${Math.round(box * 0.55)}px system-ui, sans-serif`;
        g.fillStyle = '#2b9348';
        g.fillText('✓', x + box - box * 0.22, y + box * 0.27);
      }
    });
    if (seat) return;
    // The turn buttons: round arrows, anticlockwise and clockwise.
    for (const b of this.buttons) {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#1d3557';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(b.x, b.y, BTN, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      const r = BTN * 0.5;
      const a0 = -Math.PI * 0.85;
      const a1 = Math.PI * 0.45;
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(b.x, b.y, r, a0, a1, false);
      g.stroke();
      // The arrowhead, at the end it turns toward.
      const end = b.dir > 0 ? a1 : a0;
      const ex = b.x + r * Math.cos(end);
      const ey = b.y + r * Math.sin(end);
      const tx = -Math.sin(end) * b.dir;
      const ty = Math.cos(end) * b.dir;
      g.fillStyle = '#1d3557';
      g.beginPath();
      g.moveTo(ex + tx * 7, ey + ty * 7);
      g.lineTo(ex - ty * 6 - tx * 3, ey + tx * 6 - ty * 3);
      g.lineTo(ex + ty * 6 - tx * 3, ey - tx * 6 - ty * 3);
      g.closePath();
      g.fill();
    }
  }
}
