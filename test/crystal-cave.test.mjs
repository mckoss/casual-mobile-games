import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRoof, makeLevel, specFor, newGame, fire, swap, stars, bestShot,
  rowLen, cellX, cellY, inGrid, neighbours, filled, unsupported, coloursOn, trace, cloneGame,
  COLS, R, ROW_H, W, DEAD_ROW, SHOOT, AIM_MAX, CART, POWERS, MATCH, PICTURES, pictureFor,
} from '../games/crystal-cave/engine.js';

// A hand-made roof for the rule tests: rows as strings ('.' empty, 'S' stone,
// a digit a colour).
const level = (rows, creep = 10) => ({ rows, colours: 3, creep, queue: 1 });
const gem = (colour) => ({ kind: 'gem', colour });
// The aim at a cell's centre (y runs down from the roof; the shot flies up).
const aimAt = (r, c) => Math.atan2(cellX(r, c) - SHOOT.x, SHOOT.y - cellY(r));
const where = (list) => list.map(([r, c]) => `${r},${c}`).sort();
// The cells of one colour joined to (r, c).
const group = (cells, r, c) => {
  const colour = cells[r][c].colour;
  const seen = new Set([`${r},${c}`]);
  const out = [[r, c]];
  for (let i = 0; i < out.length; i++) {
    for (const [nr, nc] of neighbours(...out[i])) {
      if (seen.has(`${nr},${nc}`) || cells[nr]?.[nc]?.colour !== colour) continue;
      seen.add(`${nr},${nc}`);
      out.push([nr, nc]);
    }
  }
  return out;
};

test('the roof is a honeycomb: eight to an even row, seven to an odd one set half a cell over', () => {
  assert.equal(rowLen(0), COLS);
  assert.equal(rowLen(1), COLS - 1);
  assert.equal(rowLen(6), 8);
  assert.equal(cellX(0, 0), R);
  assert.equal(cellX(1, 0), 2 * R, 'an odd row starts half a cell in');
  assert.equal(cellX(0, 7), W - R, 'an even row reaches the far wall');
  assert.equal(cellX(1, 6), W - 2 * R);
  assert.equal(cellY(0), R, 'the top row hangs from the roof');
  assert.ok(Math.abs(cellY(3) - cellY(2) - ROW_H) < 1e-9);
  assert.ok(Math.abs(cellY(2, 1) - cellY(3)) < 1e-9, 'a crept roof is a row lower');
  // In the middle, six neighbours; each is exactly a crystal's width away.
  for (const [r, c] of [[2, 3], [3, 3]]) {
    const around = neighbours(r, c);
    assert.equal(around.length, 6, `(${r}, ${c}) has six neighbours`);
    for (const [nr, nc] of around) {
      const d = Math.hypot(cellX(nr, nc) - cellX(r, c), cellY(nr) - cellY(r));
      assert.ok(Math.abs(d - 2 * R) < 1e-9, `(${nr}, ${nc}) touches (${r}, ${c}): ${d}`);
    }
  }
  assert.deepEqual(where(neighbours(2, 3)), where([[2, 2], [2, 4], [1, 2], [1, 3], [3, 2], [3, 3]]));
  assert.deepEqual(where(neighbours(3, 3)), where([[3, 2], [3, 4], [2, 3], [2, 4], [4, 3], [4, 4]]));
  // At the edges, fewer: nothing above the top row or beyond the walls.
  assert.deepEqual(where(neighbours(0, 0)), where([[0, 1], [1, 0]]));
  assert.deepEqual(where(neighbours(2, 7)), where([[2, 6], [1, 6], [3, 6]]));
  // (An odd row's end cell has no side neighbour, but sits under two.)
  assert.deepEqual(where(neighbours(1, 0)), where([[1, 1], [0, 0], [0, 1], [2, 0], [2, 1]]));
  assert.deepEqual(where(neighbours(1, 6)), where([[1, 5], [0, 6], [0, 7], [2, 6], [2, 7]]));
  assert.ok(inGrid(0, 0) && inGrid(0, 7) && inGrid(1, 6) && inGrid(40, 0));
  assert.ok(!inGrid(-1, 0) && !inGrid(0, -1) && !inGrid(0, 8) && !inGrid(1, 7));
});

test('a shot sticks in the nearest empty cell to the crystal it touches, or in the top row at the roof', () => {
  // Straight up into a crystal hanging at x = 8: it stops a crystal's width
  // below it and snaps into a cell under it.
  const G = newGame(level(['00000000', '...1...']));
  G.loaded = gem(2);
  const ev = fire(G, 0);
  assert.ok(neighbours(1, 3).some(([r, c]) => r === ev.landed[0] && c === ev.landed[1]), `landed ${ev.landed} under (1, 3)`);
  assert.equal(ev.landed[0], 2);
  const [x, y] = ev.path.at(-1);
  assert.ok(Math.hypot(x - cellX(1, 3), y - cellY(1)) < 2 * R, `stopped touching it at (${x}, ${y})`);
  assert.deepEqual(G.cells[ev.landed[0]][ev.landed[1]], gem(2));
  // Under a full top row it slips between two and sits in the row below.
  const H = newGame(level(['00000000']));
  H.loaded = gem(1);
  assert.deepEqual(fire(H, 0).landed, [1, 3]);
  // With nothing in the way it flies to the roof and sticks in the top row.
  const K = newGame(level(['0.......']));
  K.loaded = gem(1);
  const up = fire(K, aimAt(0, 4));
  assert.deepEqual(up.landed, [0, 4]);
  assert.equal(up.path.at(-1)[1], cellY(0), 'stopped at the roof');
});

test('a shot bounces off a side wall and comes back across', () => {
  const G = newGame(level(['0.......']));
  G.loaded = gem(1);
  const ev = fire(G, -0.6); // aimed up and to the left
  assert.ok(ev.path.some(([x]) => x === R), `the path touches the left wall: ${JSON.stringify(ev.path)}`);
  assert.ok(ev.path.at(-1)[0] > SHOOT.x, 'and finishes to the right of the shooter');
  assert.ok(cellX(...ev.landed) > SHOOT.x, `landed ${ev.landed} on the far side`);
  // The same on the other side, and the aim is held short of flat.
  const right = trace(G.cells, 0, 0.6);
  assert.ok(right.path.some(([x]) => x === W - R), 'off the right wall too');
  assert.deepEqual(trace(G.cells, 0, Math.PI / 2).path, trace(G.cells, 0, AIM_MAX).path, 'no flatter than AIM_MAX');
});

test('three of a colour touching shatter, listed as [r, c, crystal]; two do not', () => {
  const G = newGame(level(['00011000']));
  G.loaded = gem(1);
  const ev = fire(G, 0);
  assert.equal(MATCH, 3);
  assert.deepEqual(ev.landed, [1, 3]);
  assert.deepEqual(ev.shattered.map(([r, c]) => `${r},${c}`).sort(), ['0,3', '0,4', '1,3']);
  for (const [r, c, crystal] of ev.shattered) {
    assert.deepEqual(crystal, gem(1), `(${r}, ${c}) was a colour-1 gem`);
    assert.equal(G.cells[r]?.[c] ?? null, null, `and (${r}, ${c}) is empty now`);
  }
  assert.deepEqual(ev.dropped, []);
  assert.equal(G.cells.length, 1, 'the row the shot made is gone again');
  // Only two of the colour: the shot just sticks.
  const H = newGame(level(['00010000']));
  H.loaded = gem(1);
  const two = fire(H, 0);
  assert.deepEqual(two.landed, [1, 3]);
  assert.deepEqual(two.shattered, []);
  assert.deepEqual(H.cells[1][3], gem(1));
});

test('whatever a shattered group held up drops, and the roof gets shorter', () => {
  // (1, 2) and (1, 4) hang only from the pair at (0, 3) and (0, 4); a crystal
  // hangs under each of them.
  const G = newGame(level(['00.11.00', '..2.2..', '..2..2..']));
  assert.deepEqual(unsupported(G.cells), [], 'everything hangs from the roof to begin with');
  G.loaded = gem(1);
  const ev = fire(G, 0);
  assert.equal(ev.shattered.length, 3);
  assert.deepEqual(where(ev.dropped), where([[1, 2], [1, 4], [2, 2], [2, 5]]));
  for (const [, , crystal] of ev.dropped) assert.deepEqual(crystal, gem(2));
  assert.equal(G.cells.length, 1, 'only the top row is left');
  assert.equal(filled(G.cells).length, 4);
  assert.equal(G.dropped, 4);
  assert.equal(G.cart, 4);
});

test('stone never matches anything, and drops only when cut loose', () => {
  // A stone fired under two stones just sticks: no stone ever shatters.
  const G = newGame(level(['00.SS.00']));
  G.loaded = { kind: 'stone' };
  const ev = fire(G, 0);
  assert.deepEqual(ev.landed, [1, 3]);
  assert.deepEqual(ev.shattered, []);
  assert.deepEqual(G.cells[1][3], { kind: 'stone' });
  assert.deepEqual(coloursOn(G.cells), [0], 'stone is no colour');
  // A gem by a stone doesn't count it; stones hanging under a group that
  // shatters drop with it (not shattered).
  const H = newGame(level(['00.11.00', '..S.S..']));
  H.loaded = gem(1);
  const cut = fire(H, 0);
  assert.ok(cut.shattered.every(([, , crystal]) => crystal.kind === 'gem'), 'no stone shattered');
  assert.deepEqual(where(cut.dropped), where([[1, 2], [1, 4]]));
  for (const [, , crystal] of cut.dropped) assert.equal(crystal.kind, 'stone');
});

test('a blast shatters itself and every neighbour, whatever its colour', () => {
  const G = newGame(level(['00120100', '..0.2..']));
  G.loaded = { kind: 'blast' };
  const ev = fire(G, 0);
  assert.deepEqual(ev.landed, [1, 3]);
  assert.deepEqual(where(ev.shattered), where([[1, 3], [1, 2], [1, 4], [0, 3], [0, 4]]));
  const kinds = ev.shattered.map(([, , crystal]) => crystal.colour ?? crystal.kind);
  assert.deepEqual(kinds.sort(), [0, 0, 2, 2, 'blast']);
  assert.equal(G.cells[0].filter(Boolean).length, 6, 'the rest of the top row stays');
});

test('a prism matches any colour: landed between two of one colour it shatters them', () => {
  // The top row alternates colours, so only the pair of 2s below makes three.
  const G = newGame(level(['01010101', '..2.2..']));
  G.loaded = { kind: 'prism' };
  const ev = fire(G, 0);
  assert.deepEqual(ev.landed, [1, 3]);
  assert.deepEqual(where(ev.shattered), where([[1, 3], [1, 2], [1, 4]]));
  assert.equal(ev.shattered.find(([r, c]) => r === 1 && c === 3)[2].kind, 'prism');
  assert.deepEqual(coloursOn(G.cells), [0, 1]);
});

test('a prism with no group to finish stays put, and later counts as a gem\'s colour', () => {
  // A prism under (0, 3) of colour 1 and (0, 4) of colour 0: two of each, no more.
  const G = newGame(level(['01010101']));
  G.loaded = { kind: 'prism' };
  assert.deepEqual(fire(G, 0).shattered, []);
  assert.equal(G.cells[1][3].kind, 'prism');
  assert.deepEqual(coloursOn(G.cells), [0, 1], 'a prism is no colour of its own');
  // A colour-0 gem landed under it, to the right: gem, prism and (0, 4) make three.
  G.loaded = gem(0);
  const ev = fire(G, 0.02);
  assert.deepEqual(ev.landed, [2, 4]);
  assert.deepEqual(where(ev.shattered), where([[2, 4], [1, 3], [0, 4]]));
  // The same prism would have done for colour 1 just as well.
  const H = newGame(level(['01010101']));
  H.loaded = { kind: 'prism' };
  fire(H, 0);
  H.loaded = gem(1);
  const other = fire(H, -0.02);
  assert.deepEqual(other.landed, [2, 3]);
  assert.deepEqual(where(other.shattered), where([[2, 3], [1, 3], [0, 3]]));
});

test('a drill stops at nothing: it bores out the crystals on its way, off the walls and all, up to the roof; what they held drops', () => {
  const rows = ['01201201', '2012012', '01.12201', '..0....'];
  // Straight up the middle it takes every crystal within reach of x = 8, to
  // the roof, landing nowhere; (3, 2) hung only from (2, 3), so it drops.
  const G = newGame(level(rows));
  G.loaded = { kind: 'drill' };
  const ev = fire(G, 0);
  assert.equal(ev.landed, null);
  assert.deepEqual(where(ev.shattered), where([[0, 3], [0, 4], [1, 3], [2, 3], [2, 4]]));
  assert.deepEqual(where(ev.dropped), where([[3, 2]]));
  assert.ok(ev.path.at(-1)[1] < 0, 'it went out through the roof');
  assert.equal(G.loaded.kind, 'gem', 'and the next crystal is up');
  // At a wide angle it comes off the wall like a gem and goes on boring
  // (nothing spent on a shot that leaves through the side).
  for (const angle of [-1.2, -0.6, 0.6, 1.3]) {
    const H = newGame(level(rows));
    H.loaded = { kind: 'drill' };
    const drill = fire(H, angle);
    assert.ok(drill.path.some(([x]) => x === R || x === W - R), `a drill at ${angle} bounces`);
    assert.ok(drill.path.at(-1)[1] < 0, `and still leaves through the roof: ${drill.path.at(-1)}`);
    assert.ok(drill.shattered.length >= 3, `boring out crystals on the way: ${drill.shattered.length}`);
    assert.equal(drill.landed, null);
  }
});

test('the roof creeps down a row every `creep` shots', () => {
  const G = newGame(level(['00000000'], 3));
  const crept = [];
  for (let k = 0; k < 7; k++) {
    G.loaded = { kind: 'stone' }; // (no shot shatters anything)
    crept.push(fire(G, aimAt(0, k % 2 ? 1 : 6)).crept);
  }
  assert.deepEqual(crept, [false, false, true, false, false, true, false]);
  assert.equal(G.shift, 2);
  assert.equal(G.shots, 7);
  // A crept roof sits lower, and a shot meets it lower down.
  assert.equal(cellY(0, G.shift), cellY(2), 'the top row sits where row 2 was');
  assert.ok(Math.abs(trace(G.cells, G.shift, 0).y - trace(G.cells, 0, 0).y - 2 * ROW_H) < 1, 'the shot stops two rows lower');
});

test('a crystal in the dead row is a cave-in, and the game takes no more shots', () => {
  // A chain of stone straight down the middle to row DEAD_ROW - 1.
  const rows = [];
  for (let r = 0; r < DEAD_ROW; r++) rows.push('.'.repeat(3) + 'S' + '.'.repeat(rowLen(r) - 4));
  rows[0] = '0000S000';
  const G = newGame(level(rows));
  assert.deepEqual(unsupported(G.cells), []);
  G.loaded = { kind: 'stone' };
  const ev = fire(G, 0);
  assert.equal(ev.landed[0], DEAD_ROW);
  assert.equal(ev.over, 'cavein');
  assert.equal(G.over, 'cavein');
  assert.equal(fire(G, 0), null);
  assert.equal(G.shots, 1, 'the refused shot isn\'t counted');
  // Or the roof creeps down onto the line: one row short, with a creep due.
  const H = newGame(level(rows.slice(0, DEAD_ROW - 1), 1));
  H.loaded = { kind: 'stone' };
  const crept = fire(H, 0);
  assert.equal(crept.landed[0], DEAD_ROW - 1);
  assert.ok(crept.crept);
  assert.equal(crept.over, 'cavein');
});

test('shattering the last crystal clears the roof and ends the game', () => {
  const G = newGame(level(['...11...']));
  G.loaded = gem(1);
  const ev = fire(G, 0);
  assert.equal(ev.over, 'cleared');
  assert.equal(G.over, 'cleared');
  assert.deepEqual(G.cells, []);
  assert.equal(fire(G, 0), null);
});

test('the crystal drawn is always a colour still on the roof, and so is the one loaded', () => {
  // A roof of one colour deals only that colour.
  for (let queue = 1; queue <= 20; queue++) {
    const G = newGame({ ...level(['22222222']), queue });
    assert.deepEqual([G.loaded, G.next], [gem(2), gem(2)]);
  }
  // Shatter the only 1s: whatever's drawn after is a 0 -- and so is the
  // crystal loaded, drawn again if the one waiting was a 1 (it was drawn a
  // shot ago, before the 1s went).
  for (let queue = 1; queue <= 20; queue++) {
    const G = newGame({ ...level(['00011000']), queue });
    G.loaded = gem(1);
    G.next = gem(1);
    fire(G, 0);
    assert.deepEqual(G.next, gem(0), `queue ${queue}`);
    assert.deepEqual(G.loaded, gem(0), `queue ${queue}: loaded again`);
  }
  // And through a whole game played by the computer miner: neither the
  // crystal loaded nor the next is ever a colour gone from the roof.
  const G = newGame(makeRoof(4));
  while (!G.over && G.shots < 60) {
    fire(G, bestShot(G));
    if (G.over) break;
    const on = coloursOn(G.cells);
    for (const c of [G.loaded, G.next]) if (c.kind === 'gem') assert.ok(on.includes(c.colour), `shot ${G.shots}: holding ${c.colour}, roof has ${on}`);
  }
  assert.ok(G.shots >= 10, `a game of ${G.shots} shots`);
});

test('swap exchanges the loaded crystal and the next', () => {
  const G = newGame(level(['00000000']));
  G.loaded = gem(1);
  G.next = { kind: 'blast' };
  swap(G);
  assert.deepEqual([G.loaded, G.next], [{ kind: 'blast' }, gem(1)]);
  swap(G);
  assert.deepEqual([G.loaded, G.next], [gem(1), { kind: 'blast' }]);
  assert.equal(fire(G, 0).crystal.kind, 'gem', 'the loaded one is the one fired');
});

test('the same shots at the same roof always get the same crystals', () => {
  const roof = makeRoof(5);
  const A = newGame(roof);
  const B = newGame(roof);
  assert.deepEqual(A, B);
  for (const angle of [-0.5, 0.3, 0, 1.0, -1.2, 0.8, -0.1, 0.45, -0.9, 0.2]) {
    if (A.over) break;
    assert.deepEqual(fire(A, angle), fire(B, angle));
    assert.deepEqual(A, B, `after the shot at ${angle}`);
  }
  // A cloned game plays on the same as the original, and apart from it.
  const C = cloneGame(A);
  assert.deepEqual(C, A);
  if (!A.over) {
    fire(C, 0);
    assert.notDeepEqual(C, A, 'firing the clone leaves the original alone');
  }
  // A different level has its own queue.
  assert.notDeepEqual(newGame(makeRoof(6)).queue, A.queue);
});

test('dropping a cartful of crystals pays a power-up into next, each in turn', () => {
  // The pair at (0, 3) and (0, 4) holds up seven crystals each side (14 in all).
  const rows = ['00.11.00', '..2.2..', '222..222', '222.222'];
  const G = newGame(level(rows));
  assert.equal(CART, 8);
  const paid = [];
  for (let k = 0; k < 4; k++) {
    G.cells = newGame(level(rows)).cells;
    G.loaded = gem(1);
    const ev = fire(G, 0);
    assert.equal(ev.dropped.length, 14);
    paid.push(ev.paid);
    assert.deepEqual(G.next, { kind: ev.paid }, 'paid into next');
    assert.equal(G.cart, (6 * (k + 1)) % CART, 'what\'s over the cartful stays in the cart');
    assert.equal(G.owed, Math.floor((6 * (k + 1)) / CART), 'and a second cartful in one drop is owed, paid on the next shot');
  }
  assert.deepEqual(paid, [...POWERS, POWERS[0]]);
  assert.deepEqual(POWERS, ['blast', 'prism', 'drill']);
  // Each level's first payout is one further round: level 2 starts at prism, level 3 at drill, level 4 at blast again.
  for (const [n, first] of [[1, 'blast'], [2, 'prism'], [3, 'drill'], [4, 'blast'], [5, 'prism']]) {
    const K = newGame({ ...level(rows), n });
    K.loaded = gem(1);
    assert.equal(fire(K, 0).paid, first, `level ${n} pays ${first} first`);
  }
  // Short of a cartful, nothing is paid.
  const H = newGame(level(['00.11.00', '..2.2..']));
  H.loaded = gem(1);
  assert.equal(fire(H, 0).paid, null);
  assert.equal(H.next.kind, 'gem');
});

test('a roof has a full top row, stones apart and below it, nothing hanging loose, and the same roof every time', () => {
  for (let n = 1; n <= 60; n += 1) {
    for (const attempt of [0, 1, 5]) {
      const roof = makeRoof(n, attempt);
      const tag = `level ${n} attempt ${attempt}`;
      assert.equal(roof.rows[0].length, COLS);
      // (A picture hangs by its own top; every other shape has a full top row.)
      if (!pictureFor(n)) assert.ok(/^\d+$/.test(roof.rows[0]), `${tag}: top row full of gems (${roof.rows[0]})`);
      roof.rows.forEach((row, r) => assert.equal(row.length, rowLen(r), `${tag}: row ${r} is ${rowLen(r)} long`));
      if (!pictureFor(n)) assert.ok(roof.rows.length <= specFor(n).rows);
      const G = newGame(roof);
      assert.deepEqual(unsupported(G.cells), [], `${tag}: nothing hangs in the air`);
      for (const [r, c] of filled(G.cells)) {
        if (G.cells[r][c].kind !== 'stone') {
          assert.ok(G.cells[r][c].colour < roof.colours, `${tag}: colour in range`);
          continue;
        }
        assert.ok(!neighbours(r, c).some(([nr, nc]) => G.cells[nr]?.[nc]?.kind === 'stone'), `${tag}: stone at (${r}, ${c}) touches another`);
      }
      const stones = filled(G.cells).filter(([r, c]) => G.cells[r][c].kind === 'stone').length;
      assert.ok(stones <= specFor(n).stones, `${tag}: ${stones} stones`);
    }
  }
  assert.equal(makeRoof(1).shape, 'block');
  assert.equal(makeRoof(2, 7).shape, 'block');
  const shapes = new Set();
  for (let n = 3; n <= 40; n++) shapes.add(makeRoof(n).shape);
  assert.ok(shapes.size >= 4, `later roofs take other shapes: ${[...shapes]}`);
  assert.deepEqual(makeRoof(9, 2), makeRoof(9, 2));
  assert.notDeepEqual(makeRoof(9, 2).rows, makeRoof(9, 3).rows, 'a re-roll is a different roof');
  assert.notDeepEqual(makeRoof(9).rows, makeRoof(10).rows);
});

test('no roof has five of a colour touching', () => {
  for (let n = 1; n <= 60; n++) {
    for (const attempt of [0, 1, 5]) {
      const G = newGame(makeRoof(n, attempt));
      for (const [r, c] of filled(G.cells)) {
        if (G.cells[r][c].kind === 'stone') continue;
        const size = group(G.cells, r, c).length;
        assert.ok(size <= 4, `level ${n} attempt ${attempt}: ${size} of colour ${G.cells[r][c].colour} touching at (${r}, ${c})`);
      }
    }
  }
});

test('every tenth level is a picture, taken in turn, and the roof is that picture', () => {
  assert.equal(pictureFor(1), null);
  assert.equal(pictureFor(9), null);
  assert.deepEqual([10, 20, 30, 40, 50, 60].map(pictureFor), ['heart', 'star', 'smiley', 'diamond', 'mole', 'heart']);
  for (const n of [10, 20, 30, 40, 50]) {
    const roof = makeRoof(n);
    const mask = PICTURES[pictureFor(n)];
    assert.equal(roof.shape, `picture:${pictureFor(n)}`);
    assert.equal(roof.rows.length, mask.length, `level ${n}: as many rows as the picture`);
    // A crystal (or stone) wherever the picture has one, nothing elsewhere.
    roof.rows.forEach((row, r) => [...row].forEach((ch, c) => assert.equal(ch !== '.', mask[r][c] === '#', `level ${n} (${r}, ${c}): '${ch}' against '${mask[r][c]}'`)));
    assert.equal(unsupported(newGame(roof).cells).length, 0, `level ${n}: the picture hangs together`);
  }
  // Every picture's cells all hang from the roof, whatever the colours.
  for (const [name, mask] of Object.entries(PICTURES)) {
    const cells = mask.map((row) => [...row].map((ch) => (ch === '#' ? { kind: 'gem', colour: 0 } : null)));
    assert.equal(unsupported(cells).length, 0, `${name} hangs together`);
    mask.forEach((row, r) => assert.equal(row.length, rowLen(r), `${name} row ${r} is the grid's width`));
  }
});

test('levels grow: more rows, colours and stone, a faster creep, a higher par', () => {
  let prev = specFor(1);
  for (let n = 2; n <= 60; n++) {
    const s = specFor(n);
    assert.ok(s.rows >= prev.rows && s.colours >= prev.colours && s.stones >= prev.stones, `level ${n}: ${JSON.stringify(s)}`);
    assert.ok(s.creep <= prev.creep, `level ${n}: creep ${s.creep}`);
    assert.ok(s.par >= prev.par, `level ${n}: par ${s.par}`);
    prev = s;
  }
  const [a, b] = [specFor(1), specFor(60)];
  assert.ok(b.rows > a.rows && b.colours > a.colours && b.stones > a.stones && b.creep < a.creep && b.par > a.par);
  assert.equal(specFor(5).stones, 0, 'no stone before level 6');
  assert.ok(specFor(6).stones > 0);
  assert.ok(specFor(60).rows + 1 < DEAD_ROW, 'a full roof starts well clear of the dead row');
});

test('every level is proved by the computer miner: par is in [spec par, twice it], and the stored solution clears it in par', () => {
  for (const n of [1, 2, 3, 5, 8, 12, 20, 29, 30]) {
    const L = makeLevel(n);
    const want = specFor(n).par;
    assert.ok(L.checked, `level ${n} checked`);
    assert.ok(L.par >= want && L.par <= 2 * want, `level ${n}: par ${L.par} in [${want}, ${2 * want}]`);
    assert.equal(L.solution.length, L.par, `level ${n}: a solution of par shots`);
    // The solution is the par run: fired as stored, it clears the roof on the last shot.
    const G = newGame(L);
    L.solution.forEach((angle, k) => {
      const ev = fire(G, angle);
      assert.ok(ev, `level ${n}: shot ${k} fired (game over after ${G.shots}: ${G.over})`);
    });
    assert.equal(G.over, 'cleared', `level ${n} cleared by its solution`);
    assert.equal(G.shots, L.par);
  }
});

test('stars: three at par or under, two within half as many again, else one', () => {
  const L = { par: 10 };
  assert.equal(stars(L, 7), 3);
  assert.equal(stars(L, 10), 3);
  assert.equal(stars(L, 11), 2);
  assert.equal(stars(L, 15), 2);
  assert.equal(stars(L, 16), 1);
  assert.equal(stars({ par: 9 }, 14), 2, 'half as many again rounds up');
  assert.equal(stars({ par: 9 }, 15), 1);
});
