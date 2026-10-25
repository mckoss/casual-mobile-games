import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, isRoad, route, drivePath, nearestRoad, makeTown, dayPlan, jobAt, nextJob, canDo, builtBefore, LOTS, PARTS } from '../games/benji/town.js';
import { tick, partAt, light, sky, WINDOW, NIGHT, DAY } from '../games/benji/clock.js';
import { walkways, walkDoor, junctions, crossings, isJunction, isLit, lights, mayWalk, walkSignal, zebra, WALK_TIME } from '../games/benji/streets.js';
import { Traffic, lanePoint, startDir, streetTiles, footprint, body, bump } from '../games/benji/traffic.js';

test('the town: every place off the streets, on its own tile, with a door on a street, all joined up', () => {
  const town = makeTown(1);
  const seen = new Set();
  for (const p of town.places) {
    for (let x = p.x; x < p.x + (p.w || 1); x++) {
      for (let y = p.y; y < p.y + (p.h || 1); y++) {
        assert.ok(!isRoad(x, y), `${p.id} not on a street`);
        assert.ok(!seen.has(y * SIZE + x), `${p.id} has its own tile`);
        seen.add(y * SIZE + x);
      }
    }
    assert.ok(isRoad(p.door.x, p.door.y), `${p.id}'s door is on a street`);
    const touching = Math.abs(p.door.x - Math.max(p.x, Math.min(p.x + (p.w || 1) - 1, p.door.x))) + Math.abs(p.door.y - Math.max(p.y, Math.min(p.y + (p.h || 1) - 1, p.door.y)));
    assert.equal(touching, 1, `${p.id}'s door is beside it`);
  }
  const a = town.places[0].door;
  for (const p of town.places) {
    const r = route(a, p.door);
    assert.deepEqual(r[r.length - 1], p.door);
    for (let k = 1; k < r.length; k++) assert.equal(Math.abs(r[k].x - r[k - 1].x) + Math.abs(r[k].y - r[k - 1].y), 1, 'a step at a time');
  }
  assert.deepEqual(nearestRoad(0.4, 2.6), { x: 0, y: 2 });
});

// Plays a part of the day the way tapping does: each helper in turn to its
// next job (the mixer back to the yard to load up between stages).
function playThrough(town) {
  const done = new Set();
  const at = Object.fromEntries(town.helpers.map((h) => [h.id, h.at]));
  const loaded = { mixer: false }; // (the mixer starts empty)
  for (let guard = 0; guard < 200 && done.size < town.jobs.length; guard++) {
    for (const h of town.helpers) {
      if (h.kind === 'mixer' && loaded[h.id] === false) {
        at[h.id] = town.places.find((p) => p.id === 'yard').door;
        loaded[h.id] = true;
        continue;
      }
      const j = nextJob(town, h, done);
      if (!j) continue;
      const door = town.places.find((p) => p.id === j.place).door;
      assert.ok(route(at[h.id], door).length > 0);
      at[h.id] = door;
      const found = jobAt(town, h, door, done);
      assert.ok(found, `level ${town.n}: ${h.id} can do its job at ${j.place}`);
      done.add(found.i);
      if (found.kind === 'build') loaded[h.id] = false;
    }
  }
  return done.size === town.jobs.length;
}

test('every part of every day can be finished, just by tapping each helper in turn', () => {
  for (let n = 1; n <= 40; n++) {
    const town = makeTown(n);
    assert.ok(town.phases.length >= 2 && town.phases[0].part === 'morning', `day ${n} has a morning, and more`);
    for (const phase of town.phases) {
      assert.ok(PARTS.includes(phase.part) && phase.jobs.length > 0);
      assert.ok(playThrough({ ...town, jobs: phase.jobs }), `day ${n}, ${phase.part}, finished`);
    }
  }
});

test('deliveries in any order, pulling up on any side of the house', () => {
  const town = makeTown(5);
  const mail = { id: 'mail' };
  const letters = town.jobs.filter((j) => j.helper === 'mail');
  assert.ok(letters.length >= 2);
  for (const j of [...letters].reverse()) {
    const p = town.places.find((q) => q.id === j.place);
    for (const d of p.doors) {
      assert.ok(Math.abs(d.x - p.x) + Math.abs(d.y - p.y) >= 1 && isRoad(d.x, d.y), 'a street beside it');
      assert.equal(jobAt(town, mail, d, new Set())?.i, j.i, `${j.place} from ${d.x},${d.y}`);
    }
  }
  // (A corner house: two streets beside it, either will do.)
  assert.ok(town.places.find((p) => p.id === 'h6').doors.length >= 2);
});

test('the days: bins in the morning, the dog in the evening; the town grows as houses are built', () => {
  assert.deepEqual(makeTown(1).phases.map((p) => p.part), ['morning', 'evening']);
  assert.deepEqual(makeTown(1).phases[0].jobs.map((j) => j.kind), ['bin', 'recycle', 'dump']);
  assert.deepEqual(makeTown(1).phases[1].jobs.map((j) => j.kind), ['walk', 'home']);
  assert.deepEqual(Object.keys(dayPlan(1).morning), ['garbage']);
  assert.equal(builtBefore(2), 0);
  assert.equal(builtBefore(3), 1);
  // The house built on day 2 is a home from day 3 on (with bins out, letters...).
  assert.equal(makeTown(3).places.find((p) => p.id === LOTS[0]).kind, 'home');
  assert.equal(makeTown(2).places.find((p) => p.id === LOTS[0]).kind, 'lot');
  // Every house built, there are still jobs at midday.
  for (let n = 20; n < 30; n++) assert.ok(makeTown(n).phases.length === 3, `day ${n}`);
  // A day is the same every time.
  assert.deepEqual(makeTown(7), makeTown(7));
  // Any order: the recycling before the trash, the dump whenever (the truck
  // tips out what it has); but the park before home, and a house from the
  // ground up.
  const one = makeTown(1);
  const truck = one.helpers.find((h) => h.kind === 'garbage');
  const [trash, recycling, dump] = one.jobs;
  assert.ok(canDo(one, truck, recycling, new Set()) && canDo(one, truck, trash, new Set([recycling.i])));
  assert.ok(canDo(one, truck, dump, new Set()));
  assert.equal(jobAt(one, truck, one.places.find((p) => p.id === 'dump').door, new Set())?.kind, 'dump');
  assert.equal(nextJob(one, truck, new Set()).kind, 'bin', 'bins first, unless you choose');
  const walker = { id: 'dog0' };
  const evening = { ...one, jobs: one.phases[1].jobs };
  assert.ok(!canDo(evening, walker, evening.jobs[1], new Set()), 'not home before the park');
  assert.ok(canDo(evening, walker, evening.jobs[1], new Set([evening.jobs[0].i])));
  const two = makeTown(2);
  const builds = { ...two, jobs: two.phases[1].jobs };
  assert.ok(!canDo(builds, { id: 'mixer' }, builds.jobs[2], new Set([builds.jobs[0].i])), 'not the roof before the walls');
  // The post: letters, and every other one a package.
  assert.deepEqual(makeTown(2).jobs.map((j) => j.kind), ['letter', 'parcel', 'letter']);
});

test('the clock: an easy pace while there are jobs, waiting at the end of their time till they are done; quickly on with nothing to do', () => {
  assert.equal(partAt(0), 'dawn');
  assert.equal(partAt(0.1), 'morning');
  assert.equal(partAt(0.4), 'midday');
  assert.equal(partAt(0.6), 'evening');
  assert.equal(partAt(0.9), 'night');
  // Busy: a quarter of a day in about a minute, then it waits.
  let t = WINDOW.morning[0];
  for (let s = 0; s < 600; s++) t = tick(t, 1, 'morning', false);
  assert.equal(t, WINDOW.morning[1], 'waits at the end of the morning');
  assert.ok(Math.abs(tick(0.1, 1, 'morning', false) - 0.1 - 1 / DAY) < 1e-12);
  // Nothing to do: on quickly -- the whole night in a few seconds.
  let n = 0;
  for (t = NIGHT; t < 1; n++) t = tick(t, 1 / 30);
  assert.ok(n / 30 < 12, `night in ${n / 30}s`);
  // Light by day, dark at night, gold at sunset.
  assert.equal(light(0.4).bright, 1);
  assert.ok(light(0.9).bright < 0.15);
  assert.ok(light(0.7).warm > 0.9);
  assert.match(sky(0.4)[0], /^rgb\(169,220,255\)$/);
});

// ------------------------------------------------- sidewalks and traffic

test('the sidewalks: off the streets except at the crosswalks, all joined up, one outside every door', () => {
  const w = walkways();
  const inStreet = (x, y) => isRoad(Math.floor(x), Math.floor(y)) && x % 1 > 0.001 && x % 1 < 0.999 && y % 1 > 0.001 && y % 1 < 0.999;
  let count = 0;
  w.adj.forEach((edges, a) => {
    for (const e of edges) {
      const p = w.nodes[a];
      const q = w.nodes[e.to];
      const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
      if (e.cross) {
        count++;
        assert.ok(isJunction(...[e.cross.ix, e.cross.iy]), 'a crosswalk is by an intersection');
        assert.ok(isRoad(Math.floor(mid.x), Math.floor(mid.y)), 'a crosswalk crosses a street');
        assert.ok(!inStreet(p.x, p.y) && !inStreet(q.x, q.y), 'and starts and ends on the sidewalk');
        assert.ok(Math.hypot(q.x - p.x, q.y - p.y) < 1.2, 'straight across');
      } else {
        for (const pt of [p, q, mid]) assert.ok(!inStreet(pt.x, pt.y), `sidewalk at ${pt.x},${pt.y} is off the street`);
      }
    }
  });
  assert.equal(count / 2, crossings().length);
  assert.equal(crossings().length, junctions().length * 4, 'a crosswalk on every arm of every intersection');
  const town = makeTown(10);
  const spots = town.places.map((p) => walkDoor(w, p));
  for (const p of town.places) {
    const n = w.nodes[walkDoor(w, p)];
    assert.ok(Math.hypot(n.x - (p.door.x + 0.5), n.y - (p.door.y + 0.5)) < 0.75, `${p.id}'s spot is by its door`);
    assert.ok(!isJunction(p.door.x, p.door.y), `${p.id}'s door isn't in an intersection`);
  }
  for (const b of spots) {
    const r = w.route(spots[0], b);
    assert.equal(r[r.length - 1], b, 'every spot can be walked to');
  }
});

test('the lights: the two ways take turns, with all red between; walk with the traffic going your way', () => {
  for (const { x, y } of junctions()) {
    let greens = { ew: 0, ns: 0 };
    for (let t = 0; t < 30; t += 0.05) {
      const l = lights(x, y, t);
      assert.ok(l.ew === 'red' || l.ns === 'red', 'never both going');
      for (const axis of ['ew', 'ns']) if (l[axis] === 'green') greens[axis]++;
      const cross = { ix: x, iy: y, arm: 'n', walk: 'ew' };
      if (mayWalk(cross, t)) {
        assert.equal(l.ns, 'red', 'walk across the north-south street while its traffic has a red');
        assert.ok(l.left > WALK_TIME, 'and time to get over');
      }
      // A walk signal turns to the red hand before the green ends.
      assert.ok(!(walkSignal(cross, t) === 'walk' && l.ew !== 'green'));
    }
    assert.ok(greens.ew > 100 && greens.ns > 100, 'each way gets its turn');
  }
});

// Runs the town's traffic for a while -- cars and people going all over,
// and some (like the helpers) parking for a long while now and then --
// checking the rules every step.
function traffic(seconds, cars = 6, people = 8, seed = 1, parkers = 0) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const w = walkways();
  const streets = streetTiles(SIZE);
  const anyStreet = () => streets[Math.floor(rand() * streets.length)];
  const tr = new Traffic(w);
  const taken = new Set();
  for (let k = 0; k < cars + parkers; k++) {
    let tile = anyStreet();
    while (taken.has(`${tile.x},${tile.y}`)) tile = anyStreet();
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) taken.add(`${tile.x + dx},${tile.y + dy}`);
    const dir = startDir(tile);
    tr.cars.push({ tile, dir, ...lanePoint(tile, dir), path: [], trips: 0, patience: 2, len: k % 2 ? 0.29 : 0.38, parker: k >= cars, rest: 0 });
  }
  for (let k = 0; k < people; k++) {
    const node = Math.floor(rand() * w.nodes.length);
    tr.people.push({ node, ...w.nodes[node], path: [], trips: 0 });
  }
  const dt = 1 / 30;
  const seen = { entries: 0, crossings: 0, waits: 0, zebra: 0 };
  for (let t = 0; t < seconds; t += dt) {
    tr.t = t;
    for (const c of tr.cars) {
      if (c.rest > 0) {
        c.rest -= dt;
        continue;
      }
      if (!c.path.length) {
        if (c.parker && c.trips % 2) c.rest = 8 + rand() * 12;
        c.path = drivePath(c.tile, c.dir, anyStreet()).slice(1);
        c.trips++;
      }
      const before = c.pass;
      tr.drive(c, 1.8, dt);
      if (c.pass && c.pass !== before) {
        seen.entries++;
        const [ix, iy] = c.pass.split(',').map(Number);
        if (isLit(ix, iy)) {
          const axis = c.dir.x || (c.tile.x !== ix) ? 'ew' : 'ns';
          assert.equal(lights(ix, iy, t)[axis], 'green', 'cars go on green');
        } else {
          const others = tr.cars.filter((o) => o !== c && tr.through(o, c.pass));
          assert.equal(others.length, 0, 'no lights: one car through at a time');
        }
      }
      if (c.wait === 'light') seen.waits++;
      // Off the sidewalks: in the street, always.
      assert.ok(isRoad(Math.floor(c.x), Math.floor(c.y)), `car on the street at ${c.x},${c.y}`);
    }
    for (const p of tr.people) {
      if (!p.path.length) {
        p.path = w.route(p.node, Math.floor(rand() * w.nodes.length)).slice(1);
        p.trips++;
      }
      const was = p.crossing;
      tr.walk(p, 0.9, dt);
      if (p.crossing && p.crossing !== was) {
        seen.crossings++;
        if (isLit(p.crossing.ix, p.crossing.iy)) assert.equal(walkSignal(p.crossing, t), 'walk', 'people start across on the walk signal');
        else seen.zebra++;
      }
      if (p.crossing) assert.ok(!tr.carsOn(p.crossing) || was, 'no car on the crosswalk as they start');
    }
    // No car ever in another.
    for (let i = 0; i < tr.cars.length; i++) {
      for (let j = i + 1; j < tr.cars.length; j++) {
        const [a, b] = [tr.cars[i], tr.cars[j]];
        assert.ok(!bump(body(a), body(b)), `cars at ${a.x.toFixed(2)},${a.y.toFixed(2)} and ${b.x.toFixed(2)},${b.y.toFixed(2)} overlap at ${t.toFixed(2)}`);
      }
    }
    // Nobody on a crosswalk while a car is going over it.
    for (const p of tr.people) {
      if (!p.crossing) continue;
      const [x0, y0, x1, y1] = zebra(p.crossing.ix, p.crossing.iy, p.crossing.arm);
      for (const c of tr.cars) {
        const [a0, b0, a1, b1] = footprint(c);
        const near = a1 > x0 && a0 < x1 && b1 > y0 && b0 < y1;
        assert.ok(!near, `a car at ${c.x.toFixed(2)},${c.y.toFixed(2)} on the crosswalk with someone on it (${p.crossing.arm} of ${p.crossing.ix},${p.crossing.iy}) at ${t.toFixed(2)}`);
      }
    }
  }
  return { tr, seen };
}

test('the traffic: cars stop at red and go on green (or take turns), people cross on the walk signal, never both on a crosswalk -- and everyone gets where they are going', () => {
  for (const seed of [1, 2, 3]) {
    const { tr, seen } = traffic(240, 6, 10, seed, 2);
    assert.ok(seen.entries > 50 && seen.crossings > 30 && seen.zebra > 10 && seen.waits > 0, JSON.stringify(seen));
    for (const c of tr.cars) assert.ok(c.trips >= (c.parker ? 3 : 5), `every car keeps going (${c.trips} trips)`);
    for (const p of tr.people) assert.ok(p.trips >= 3, `everyone keeps walking (${p.trips} trips)`);
  }
});

test('the end of a street: round the turning circle (the island on the left), and back the other way; no car goes down one unless it is going there', async () => {
  const { circleAt, CIRCLE, atEdge } = await import('../games/benji/streets.js');
  const tr = new Traffic(walkways());
  for (const [from, out] of [[{ x: 2, y: 3 }, { x: 0, y: -1 }], [{ x: 9, y: 10 }, { x: 1, y: 0 }]]) {
    const dir = out;
    const car = { tile: from, dir, ...lanePoint(from, dir), path: [], len: 0.38 };
    tr.cars = [car];
    const edge = { x: out.x ? 12 : from.x, y: out.y ? 0 : from.y };
    assert.ok(atEdge(edge.x, edge.y));
    car.path = drivePath(from, dir, edge).slice(1);
    let left = 0;
    for (let k = 0; k < 600 && car.path.length; k++) {
      const was = car.head;
      tr.drive(car, 1.8, 1 / 30);
      if (car.round) left += Math.atan2(Math.sin(car.head - was), Math.cos(car.head - was));
      // (Always on the street, or on the circle.)
      const o = circleAt(edge, out);
      assert.ok(isRoad(Math.floor(car.x), Math.floor(car.y)) || Math.hypot(car.x - o.x, car.y - o.y) < CIRCLE.paved, `${car.x},${car.y}`);
      assert.ok(Math.hypot(car.x - o.x, car.y - o.y) > CIRCLE.island + 0.14, `clear of the island ${car.x.toFixed(2)},${car.y.toFixed(2)} ${k}`);
    }
    assert.equal(car.path.length, 0);
    assert.deepEqual(car.tile, edge);
    assert.deepEqual(car.dir, { x: -out.x, y: -out.y }, 'facing back into town');
    assert.ok(Math.abs(Math.cos(car.head) + out.x) < 0.2 && Math.abs(Math.sin(car.head) + out.y) < 0.2, 'and lined up');
    assert.ok(left < -2.5, `round to the left (${left})`);
  }
  // (Cars out for a drive never go down the end of a street; nor through one.)
  for (const t of streetTiles(SIZE)) assert.ok(!atEdge(t.x, t.y) && t.x > 1 && t.y > 1 && t.x < SIZE - 2 && t.y < SIZE - 2);
  const way = drivePath({ x: 3, y: 2 }, { x: 1, y: 0 }, { x: 3, y: 6 });
  assert.ok(way.every((t) => t.y >= 2 && t.x >= 2), 'round the block, not round the circle');
});

test('the voice: every line it says is listed (to be recorded), and every recording it claims is there', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const { LINES, RECORDED, slug } = await import('../games/benji/voice.js');
  const said = new Set();
  for (const file of ['index.js', 'play.js']) {
    const src = readFileSync(new URL(`../games/benji/${file}`, import.meta.url), 'utf8');
    for (const call of src.matchAll(/\bsay\??\.?\((.*)\);/g)) {
      for (const [, text] of call[1].matchAll(/'([A-Z][^']*[!.])'/g)) said.add(text);
    }
  }
  assert.ok(said.size >= 9, [...said].join(' | '));
  for (const text of said) assert.ok(LINES.includes(text), `"${text}" is in LINES`);
  assert.equal(new Set(LINES.map(slug)).size, LINES.length, 'each its own file');
  assert.equal(slug('Here’s your letter!'), 'heres-your-letter');
  for (const text of RECORDED) {
    assert.ok(LINES.includes(text));
    assert.ok(existsSync(new URL(`../games/benji/voice/${slug(text)}.mp3`, import.meta.url)), `${slug(text)}.mp3 is there`);
  }
});

// ---------------------------------------------------- being the driver

test('driving yourself: following the turn shown, from where each helper starts, gets you to every door', async () => {
  const { ahead, driveTurn } = await import('../games/benji/steer.js');
  const town = makeTown(10);
  for (const h of town.helpers.filter((x) => x.kind !== 'walker')) {
    for (const p of town.places) {
      let t = h.at;
      let d = startDir(t);
      let steps = 0;
      for (; steps < 80 && !(t.x === p.door.x && t.y === p.door.y); steps++) {
        const path = ahead(t, d, driveTurn(t, d, p.door));
        assert.ok(path.length, `somewhere to go from ${t.x},${t.y}`);
        const n = path[0];
        assert.equal(Math.abs(n.x - t.x) + Math.abs(n.y - t.y), 1, 'a tile at a time, along the streets');
        assert.ok(isRoad(n.x, n.y));
        d = { x: n.x - t.x, y: n.y - t.y };
        t = n;
      }
      assert.ok(steps < 80, `${h.kind} from ${h.at.x},${h.at.y} to ${p.id}`);
    }
  }
  // Nothing ahead but the end of the street: round the circle, and back.
  const on = ahead;
  assert.deepEqual(on({ x: 0, y: 2 }, { x: -1, y: 0 }), [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }]);
  // At an intersection, out the way you're turning.
  assert.deepEqual(on({ x: 3, y: 2 }, { x: -1, y: 0 }, 'left'), [{ x: 2, y: 2 }, { x: 2, y: 3 }]);
  assert.deepEqual(on({ x: 3, y: 2 }, { x: -1, y: 0 }, 'right'), [{ x: 2, y: 2 }, { x: 2, y: 1 }]);
});

test('walking the dog yourself: following the turn shown gets you to the park and home, and only crosses at crosswalks', async () => {
  const { onFrom, walkAhead, walkTurn } = await import('../games/benji/steer.js');
  const w = walkways();
  const town = makeTown(10);
  const spots = town.places.map((p) => walkDoor(w, p));
  for (const from of spots.slice(0, 8)) {
    for (const to of spots) {
      if (from === to) continue;
      let a = from;
      let b = w.adj[from][0].to;
      let n = 0;
      for (; n < 400 && a !== to && b !== to; n++) {
        const turn = walkTurn(w, a, b, to);
        if (turn === 'back') {
          [a, b] = [b, a];
          continue;
        }
        const path = walkAhead(w, a, b, turn);
        assert.ok(path.length);
        // (Each step along a sidewalk or a crosswalk: a link in the network.)
        assert.ok(w.adj[b].some((e) => e.to === path[0]));
        [a, b] = [b, path[0]];
      }
      assert.ok(n < 400, `from ${from} to ${to}`);
    }
  }
  // Round a bend there's only one way on.
  const bendAt = w.nodes.findIndex((_, i) => w.adj[i].length === 2);
  const [x, y] = w.adj[bendAt].map((e) => e.to);
  assert.equal(onFrom(w, x, bendAt), y);
});
