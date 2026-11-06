// Card illustration for the arcade hub: a block of ice with a penguin frozen
// inside, a few chunks already chopped off, and the ice pick.
import { level, centroid, W, H } from './model.js';
import { emoji, preload } from '../benji/emoji.js';

export function paint(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  const cw = rect.width;
  const ch = rect.height;
  const draw = () => {
    const bg = g.createLinearGradient(0, 0, 0, ch);
    bg.addColorStop(0, '#0b3a5b');
    bg.addColorStop(1, '#1e6f9f');
    g.fillStyle = bg;
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let k = 0; k < 24; k++) {
      g.beginPath();
      g.arc(((k * 0.618) % 1) * cw, ((k * 0.37) % 1) * ch, 1.5 + (k % 3), 0, Math.PI * 2);
      g.fill();
    }
    const s = (ch * 0.84) / H;
    const ox = cw * 0.5 - (W * s) / 2;
    const oy = ch * 0.08;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${Math.round(W * s * 0.55)}px system-ui, sans-serif`;
    emoji(g, '🐧', ox + (W * s) / 2, oy + (H * s) / 2);
    const lv = level(3);
    // (Chopped off already: the chunk over the penguin's face, and one more.)
    const near = (px, py) => lv.chunks.reduce((b, c, i) => {
      const [x, y] = centroid(c.pts);
      return Math.hypot(x - px, y - py) < b.d ? { i, d: Math.hypot(x - px, y - py) } : b;
    }, { i: -1, d: Infinity }).i;
    const gone = [near(W * 0.5, H * 0.38), near(W, H)];
    lv.chunks.forEach((c, i) => {
      if (gone.includes(i)) return;
      g.beginPath();
      c.pts.forEach(([x, y], k) => (k ? g.lineTo(ox + x * s, oy + y * s) : g.moveTo(ox + x * s, oy + y * s)));
      g.closePath();
      g.fillStyle = c.max > 1 ? 'rgba(176,220,250,0.95)' : 'rgba(222,244,255,0.93)';
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.stroke();
    });
    g.font = `${Math.round(ch * 0.4)}px system-ui, sans-serif`;
    g.save();
    g.translate(ox + W * s + ch * 0.12, oy + ch * 0.2);
    g.rotate(0.3);
    emoji(g, '⛏️', 0, 0);
    g.restore();
  };
  preload(['🐧', '⛏️']);
  draw();
  // (Again once the pictures are in.)
  setTimeout(draw, 400);
  return rect;
}
