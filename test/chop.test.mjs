import { test } from 'node:test';
import assert from 'node:assert/strict';
import { level, chop, chunkAt, free, left, area, centroid, sizeOf, SURPRISES, W, H } from '../games/chop/model.js';

test('chop: each block is cut into chunks that fill it, with no gaps and no overlaps', () => {
  for (let n = 1; n <= 40; n++) {
    const lv = level(n);
    const { cols, rows } = sizeOf(n);
    assert.equal(lv.chunks.length, cols * rows);
    const total = lv.chunks.reduce((a, c) => a + area(c.pts), 0);
    assert.ok(Math.abs(total - W * H) < 1e-9, `level ${n}: ${total}`);
    // (Every point of the block in exactly one chunk.)
    for (let i = 0; i < 200; i++) {
      const x = ((i * 0.618034) % 1) * W;
      const y = ((i * 0.381966 + 0.05) % 1) * H;
      const hits = lv.chunks.filter((c) => {
        let inside = false;
        for (let a = 0, b = c.pts.length - 1; a < c.pts.length; b = a++) {
          const [xa, ya] = c.pts[a];
          const [xb, yb] = c.pts[b];
          if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside;
        }
        return inside;
      });
      assert.equal(hits.length, 1, `level ${n} at ${x},${y}`);
    }
    // Not too small to tap.
    for (const c of lv.chunks) assert.ok(area(c.pts) > 0.008, `level ${n}: a sliver`);
  }
});

test('chop: one chop a chunk to begin with, thicker ice (two or three) later, and more chunks', () => {
  for (const n of [1, 2]) assert.ok(level(n).chunks.every((c) => c.hp === 1));
  assert.ok(level(1).chunks.length <= 6);
  assert.ok(level(12).chunks.length > level(1).chunks.length);
  assert.ok(level(12).chunks.length <= 30);
  const late = Array.from({ length: 10 }, (_, k) => level(10 + k).chunks).flat();
  assert.ok(late.some((c) => c.hp === 2) && late.some((c) => c.hp === 3));
  assert.ok(late.every((c) => c.hp >= 1 && c.hp <= 3 && c.max === c.hp));
  // The same block every time, and a new surprise for each.
  assert.deepEqual(level(7), level(7));
  assert.equal(level(1).surprise, SURPRISES[0]);
  assert.equal(level(SURPRISES.length + 1).surprise, SURPRISES[0]);
});

test('chop: tap every chunk (and again, for thick ice) and the surprise is free', () => {
  const lv = level(11);
  assert.equal(chop(lv, -0.1, 0.5), null, 'off the ice: nothing');
  let chops = 0;
  const need = lv.chunks.reduce((a, c) => a + c.hp, 0);
  while (!free(lv)) {
    const c = lv.chunks.find((k) => k.hp > 0);
    const [x, y] = centroid(c.pts);
    const r = chop(lv, x, y);
    assert.ok(r, 'chopped');
    assert.equal(r.broke, lv.chunks[r.i].hp === 0);
    chops++;
    assert.ok(chops <= need);
  }
  assert.equal(chops, need);
  assert.equal(left(lv), 0);
  assert.equal(chunkAt(lv, 0.5, 0.6), -1, 'nothing left there');
});
