// The Chopping Game in play: the block of ice, the surprise inside it, and
// the chopping. Tap the ice to chop it -- or hold, and keep on chopping:
// cracks spread from each chop, a chunk chopped through shatters and its
// pieces tumble away, and with the last of the ice gone, out comes the
// surprise.
import { W, H, chop, free, left, centroid } from './model.js';
import { emoji } from '../benji/emoji.js';

const REPEAT = 0.26; // seconds between chops, holding on
// Ice, thicker for each chop it takes: lighter to deeper blue.
const ICE = ['', 'rgba(222,244,255,0.93)', 'rgba(176,220,250,0.95)', 'rgba(132,190,240,0.97)'];

export class Play {
  constructor(canvas, lv, hooks, found = []) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.lv = lv;
    this.hooks = hooks;
    this.found = found;
    this.t = 0;
    this.cracks = lv.chunks.map(() => []);
    this.shards = [];
    this.sparks = [];
    this.swings = [];
    this.flakes = Array.from({ length: 40 }, (_, i) => ({ x: (i * 0.618) % 1, y: (i * 0.37) % 1, s: 0.5 + ((i * 0.29) % 1), v: 0.02 + ((i * 0.13) % 1) * 0.04 }));
    this.freedAt = null;
    this.hold = null;
    this.resize();
    this.bind();
    let last = performance.now();
    const loop = (now) => {
      this.update(Math.min(0.05, (now - last) / 1000));
      last = now;
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.unbind?.();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.W = Math.max(1, rect.width);
    this.H = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    // The block: as big as fits, below the row of surprises found so far.
    const top = 64;
    this.s = Math.min((this.W * 0.86) / W, ((this.H - top - 30) * 0.92) / H);
    this.ox = (this.W - W * this.s) / 2;
    this.oy = top + (this.H - top - H * this.s) / 2;
  }

  toScreen([x, y]) {
    return [this.ox + x * this.s, this.oy + y * this.s];
  }

  // Where a point on the page is in the block.
  toBlock(px, py) {
    return [(px - this.ox) / this.s, (py - this.oy) / this.s];
  }

  // A chop at (px, py) on the page: the chunk there cracks, or breaks.
  chopAt(px, py) {
    if (this.freedAt !== null) return false;
    const [x, y] = this.toBlock(px, py);
    const r = chop(this.lv, x, y);
    this.swings.push({ x: px, y: py, t: 0 });
    if (!r) {
      this.hooks.sfx?.('tap');
      return false;
    }
    const c = this.lv.chunks[r.i];
    if (r.broke) {
      this.shatter(r.i, x, y);
      this.hooks.sfx?.('icebreak');
      this.hooks.haptic?.(25);
      if (free(this.lv)) {
        this.freedAt = this.t;
        this.hold = null;
        this.hooks.sfx?.('win');
        this.hooks.onFree?.(this.lv.surprise);
      }
    } else {
      // Cracks, out from the chop.
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2;
        const pts = [[x, y]];
        let [cx, cy] = [x, y];
        for (let step = 0; step < 4; step++) {
          cx += Math.cos(a + (Math.random() - 0.5) * 0.9) * 0.045;
          cy += Math.sin(a + (Math.random() - 0.5) * 0.9) * 0.045;
          pts.push([cx, cy]);
        }
        this.cracks[r.i].push(pts);
      }
      this.hooks.sfx?.('chop');
      this.hooks.haptic?.(10);
    }
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 120;
      this.sparks.push({ x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0 });
    }
    return true;
  }

  // A chunk chopped through: into pieces (from its middle out), each flung
  // off and falling.
  shatter(i, x, y) {
    const c = this.lv.chunks[i];
    const [mx, my] = centroid(c.pts);
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const tris = [];
    c.pts.forEach((a, k) => {
      const b = c.pts[(k + 1) % c.pts.length];
      const m = [mx, my];
      // (Each slice of it in four, for smaller pieces.)
      const [ma, mb, ab] = [mid(m, a), mid(m, b), mid(a, b)];
      tris.push([m, ma, mb], [ma, a, ab], [mb, ab, b], [ma, ab, mb]);
    });
    tris.forEach((tri) => {
      const [tx, ty] = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
      const dx = tx - x;
      const dy = ty - y;
      const d = Math.hypot(dx, dy) || 1;
      this.shards.push({ tri: tri.map(([px, py]) => [px - tx, py - ty]), x: tx, y: ty, vx: (dx / d) * (0.3 + Math.random() * 0.4), vy: (dy / d) * 0.3 - 0.4 - Math.random() * 0.3, spin: (Math.random() - 0.5) * 8, a: 0, t: 0, fill: ICE[c.max] });
    });
  }

  bind() {
    const c = this.canvas;
    const at = (e) => {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const down = (e) => {
      e.preventDefault();
      c.setPointerCapture?.(e.pointerId);
      const [px, py] = at(e);
      this.hold = { id: e.pointerId, px, py, next: this.t + REPEAT * 1.6 };
      this.chopAt(px, py);
    };
    const move = (e) => {
      if (this.hold && e.pointerId === this.hold.id) [this.hold.px, this.hold.py] = at(e);
    };
    const up = (e) => {
      if (this.hold && e.pointerId === this.hold.id) this.hold = null;
    };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    this.unbind = () => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
    };
  }

  update(dt) {
    this.t += dt;
    // Holding on: on chopping, where the finger is.
    if (this.hold && this.t >= this.hold.next) {
      this.hold.next = this.t + REPEAT;
      this.chopAt(this.hold.px, this.hold.py);
    }
    for (const p of this.shards) {
      p.t += dt;
      p.vy += 1.6 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += p.spin * dt;
    }
    this.shards = this.shards.filter((p) => p.t < 1.4);
    for (const p of this.sparks) {
      p.t += dt;
      p.vy += 400 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.sparks = this.sparks.filter((p) => p.t < 0.6);
    for (const w of this.swings) w.t += dt;
    this.swings = this.swings.filter((w) => w.t < 0.3);
    for (const f of this.flakes) {
      f.y += f.v * dt;
      f.x += Math.sin(this.t + f.s * 9) * 0.004 * dt;
      if (f.y > 1) f.y -= 1;
    }
  }

  path(pts, dx = 0, dy = 0) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = this.toScreen([p[0] + dx, p[1] + dy]);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.closePath();
  }

  draw() {
    const { g, W: cw, H: ch } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#0b3a5b');
    bg.addColorStop(1, '#1e6f9f');
    g.fillStyle = bg;
    g.fillRect(0, 0, cw, ch);
    // Snow, drifting down.
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (const f of this.flakes) {
      g.beginPath();
      g.arc(f.x * cw, f.y * ch, 1.2 + f.s * 1.8, 0, Math.PI * 2);
      g.fill();
    }
    // The surprises found so far, along the top.
    g.font = '26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const shown = this.found.slice(-Math.floor((cw - 20) / 34));
    shown.forEach((e, i) => emoji(g, e, 27 + i * 34, 32));
    // The surprise, frozen in the middle -- and, freed, jumping for joy.
    const [sx, sy] = this.toScreen([W / 2, H / 2]);
    const size = W * this.s * 0.55;
    let scale = 1;
    let lift = 0;
    if (this.freedAt !== null) {
      const u = this.t - this.freedAt;
      scale = 1 + 0.25 * Math.min(1, u * 3) + Math.sin(u * 10) * 0.05 * Math.max(0, 1 - u / 3);
      lift = Math.abs(Math.sin(u * 5)) * size * 0.18 * Math.max(0.3, 1 - u / 4);
    }
    g.font = `${Math.round(size * scale)}px system-ui, sans-serif`;
    emoji(g, this.lv.surprise.emoji, sx, sy - lift);
    // The ice still left.
    this.lv.chunks.forEach((c, i) => {
      if (c.hp <= 0) return;
      this.path(c.pts);
      g.fillStyle = ICE[c.max];
      g.fill();
      // (Chopped, and still standing: a little clearer.)
      if (c.hp < c.max) {
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fill();
      }
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.95)';
      g.lineWidth = 2;
      g.stroke();
      // A glint, near the top left of the chunk.
      const [mx, my] = centroid(c.pts);
      const [gx, gy] = this.toScreen([mx - 0.03, my - 0.03]);
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(gx - 8, gy + 4);
      g.lineTo(gx + 2, gy - 6);
      g.stroke();
      // Its cracks.
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.5;
      g.save();
      this.path(c.pts);
      g.clip();
      for (const crack of this.cracks[i]) {
        g.beginPath();
        crack.forEach((p, k) => {
          const [x, y] = this.toScreen(p);
          if (k) g.lineTo(x, y);
          else g.moveTo(x, y);
        });
        g.stroke();
      }
      g.restore();
    });
    // Pieces flying off.
    for (const p of this.shards) {
      const [x, y] = this.toScreen([p.x, p.y]);
      g.save();
      g.globalAlpha = Math.max(0, 1 - p.t / 1.4);
      g.translate(x, y);
      g.rotate(p.a);
      g.beginPath();
      p.tri.forEach(([px, py], k) => (k ? g.lineTo(px * this.s, py * this.s) : g.moveTo(px * this.s, py * this.s)));
      g.closePath();
      g.fillStyle = p.fill;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.5;
      g.stroke();
      g.restore();
    }
    // Sparkles at each chop, and the ice pick swinging down.
    for (const p of this.sparks) {
      g.fillStyle = `rgba(255,255,255,${1 - p.t / 0.6})`;
      g.beginPath();
      g.arc(p.x, p.y, 3, 0, Math.PI * 2);
      g.fill();
    }
    for (const w of this.swings) {
      g.save();
      g.translate(w.x + 18, w.y - 18);
      g.rotate(-0.9 + Math.min(1, w.t / 0.12) * 1.2);
      g.font = '44px system-ui, sans-serif';
      emoji(g, '⛏️', 0, 0);
      g.restore();
    }
    // Free: its name, and a shower of sparkles.
    if (this.freedAt !== null) {
      const u = this.t - this.freedAt;
      g.globalAlpha = Math.min(1, u * 2);
      g.fillStyle = '#ffffff';
      g.font = '900 34px system-ui, sans-serif';
      g.fillText(`${this.lv.surprise.name}!`, cw / 2, this.oy + H * this.s + 4);
      g.globalAlpha = 1;
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + u * 0.8;
        const d = size * (0.85 + 0.15 * Math.sin(u * 3 + k));
        g.font = '22px system-ui, sans-serif';
        emoji(g, '✨', sx + Math.cos(a) * d, sy - lift + Math.sin(a) * d);
      }
    }
  }

  // (For the tests: how much ice is left.)
  left() {
    return left(this.lv);
  }

  // (For the tests: where on the page chunk i is, or null if it's gone.)
  screenOf(i) {
    const c = this.lv.chunks[i];
    if (!c || c.hp <= 0) return null;
    // (Its middle: the chunks are all convex, so that's in it.)
    return this.toScreen(centroid(c.pts));
  }
}
