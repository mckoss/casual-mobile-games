// Browser smoke test: serves the app, plays real levels with swipe gestures
// in headless Chromium (phone viewport), and checks for runtime errors.
// Skips itself when Playwright isn't installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = null;
}

const root = new URL('..', import.meta.url).pathname;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
};

// overrides: path -> body served instead of the file (to fake a new deploy).
// delays: path -> milliseconds to hold the response (to watch progress).
function serve(overrides = new Map(), delays = new Map()) {
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (delays.has(path)) await new Promise((r) => setTimeout(r, delays.get(path)));
    if (overrides.has(path)) {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
      return res.end(overrides.get(path));
    }
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

// Waits until an async check in the page comes out true. (Not
// page.waitForFunction: it doesn't wait for a promise -- one counts as
// true straight away.)
async function waitUntil(page, check, arg, timeout = 30000) {
  const end = Date.now() + timeout;
  while (!(await page.evaluate(check, arg))) {
    if (Date.now() > end) throw new Error(`timed out waiting for ${check}`);
    await page.waitForTimeout(200);
  }
}

// Swipe a car with the mouse (pointer events) in the given direction.
async function swipe(page, car, sign) {
  const pt = await page.evaluate(([i, s]) => {
    const p = window.__carJamPlay;
    const c = p.cars[i];
    const [x, y] = p.carCenter(c);
    const r = p.canvas.getBoundingClientRect();
    const sx = r.left + p.ox + x * p.T;
    const sy = r.top + p.oy + y * p.T;
    const d = p.T * 0.9 * s;
    return { sx, sy, ex: c.horiz ? sx + d : sx, ey: c.horiz ? sy : sy + d };
  }, [car, sign]);
  await page.mouse.move(pt.sx, pt.sy);
  await page.mouse.down();
  await page.mouse.move((pt.sx + pt.ex) / 2, (pt.sy + pt.ey) / 2, { steps: 2 });
  await page.mouse.move(pt.ex, pt.ey, { steps: 2 });
  await page.mouse.up();
}

// Play the current level by following the built-in hints.
async function solveWithHints(page) {
  for (let guard = 0; guard < 200; guard++) {
    if (await page.locator('.dialog:not([hidden])').count()) return true;
    const hint = await page.evaluate(() => {
      const p = window.__carJamPlay;
      if (p.pos.every((v) => v < 0)) return 'wait';
      p.showHint();
      const h = p.hint;
      if (!h) return null;
      // Wait for the car to come to rest before swiping it.
      return p.cars[h.car].mode === 'lot' ? { car: h.car, sign: h.sign } : 'wait';
    });
    assert.ok(hint, 'hint available');
    if (hint !== 'wait') {
      const before = await page.evaluate(() => window.__carJamPlay.moves);
      await swipe(page, hint.car, hint.sign);
      const after = await page.evaluate(() => window.__carJamPlay.moves);
      if (process.env.E2E_DEBUG) console.log(JSON.stringify(hint), before, after);
    }
    await page.waitForTimeout(hint === 'wait' ? 250 : 120);
  }
  return false;
}

test('hub loads, a level can be played to the win screen', { skip: !chromium, timeout: 120000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=car-jam]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__carJamPlay);

    assert.ok(await solveWithHints(page), 'level 1 solved');
    assert.match(await page.locator('.dialog h3').textContent(), /!/);
    const moves = Number(await page.locator('[data-moves]').textContent());
    const par = await page.evaluate(() => window.__carJamPlay.level.par);
    assert.equal(moves, par, 'hints give a par solution');

    // On to level 2 via the dialog; progress is saved.
    await page.locator('[data-act=next]').click();
    await page.waitForFunction(() => location.hash === '#/car-jam/2');
    assert.ok(await solveWithHints(page), 'level 2 solved');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:car-jam:progress')));
    assert.equal(saved.unlocked, 3);
    assert.equal(saved.stars['1'], 3);

    // A bigger level with grannies, hedges and trucks runs cleanly too.
    await page.evaluate(() => localStorage.setItem('pocket-arcade:car-jam:progress', JSON.stringify({ unlocked: 25, stars: {} })));
    await page.goto(`http://localhost:${server.address().port}/#/car-jam/22`);
    await page.reload();
    await page.waitForFunction(() => window.__carJamPlay && location.hash === '#/car-jam/22');
    assert.ok(await solveWithHints(page), 'level 22 solved');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('after the first visit the app works fully offline', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const url = `http://localhost:${server.address().port}/`;
    await page.goto(url);
    // Wait for the service worker to finish precaching and take control --
    // and, the arcade being browsed, to keep every game.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
    });
    // (Every file the app has.)
    const { files } = new Function('self', `${await readFile(new URL('../sw-manifest.js', import.meta.url), 'utf8')}; return self.PRECACHE;`)({});
    await waitUntil(page, async (list) => {
      for (const f of list) if (!(await caches.match(f))) return false;
      return true;
    }, files);
    await context.setOffline(true);
    server.close();
    await page.reload();
    await page.locator('[data-game=car-jam]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__carJamPlay && window.__carJamPlay.cars.length > 0);
    assert.equal(await page.locator('canvas.board').count(), 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('a link to one game: it plays, downloads just that game (offline too), and points to the arcade', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const url = `http://localhost:${server.address().port}/#/water`;
    await page.goto(url);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
    });
    await waitUntil(page, async () => !!(await caches.match('games/water/model.js')));
    await page.waitForTimeout(500);
    const cached = await page.evaluate(async () => ({
      lander: !!(await caches.match('games/lander/audio/eagle-has-landed.mp3')),
      carJam: !!(await caches.match('games/car-jam/play.js')),
      art: !!(await caches.match('games/car-jam/art.js')),
    }));
    assert.deepEqual(cached, { lander: false, carJam: false, art: true }, 'just this game (and the home screen pictures)');
    // Offline, it still plays.
    await context.setOffline(true);
    server.close();
    await page.reload();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__water);
    // And the arcade's there to find.
    await page.locator('[data-act=levels]').click();
    assert.match(await page.locator('.arcade-link').textContent(), /Pocket Arcade/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

// Tap the middle of an arrow's tail cell in Tap Maze.
async function tapArrow(page, i) {
  const pt = await page.evaluate((i) => {
    const p = window.__tapMazePlay;
    const [x, y] = p.board.arrows[i].cells[0];
    const r = p.canvas.getBoundingClientRect();
    return { x: r.left + p.ox + (x + 0.5) * p.T, y: r.top + p.oy + (y + 0.5) * p.T };
  }, i);
  await page.mouse.click(pt.x, pt.y);
}

test('tap maze: blocked arrows cost a heart, clearing the board wins', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=tap-maze]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__tapMazePlay);

    // Find an arrow that is blocked right now and tap it.
    const blocked = await page.evaluate(() => {
      const p = window.__tapMazePlay;
      for (let i = 0; i < p.alive.length; i++) {
        const ray = [];
        const { cells, dir } = p.board.arrows[i];
        let [x, y] = cells[cells.length - 1];
        for (x += dir[0], y += dir[1]; x >= 0 && y >= 0 && x < p.board.w && y < p.board.h; x += dir[0], y += dir[1]) ray.push(p.board.occ[y * p.board.w + x]);
        if (ray.some((j) => j >= 0 && j !== i)) return i;
      }
      return -1;
    });
    assert.ok(blocked >= 0, 'level 1 starts with a blocked arrow');
    await tapArrow(page, blocked);
    await page.waitForFunction(() => window.__tapMazePlay.hearts === 2 && window.__tapMazePlay.anims.size === 0);
    assert.equal(await page.locator('.hearts svg.lost').count(), 1, 'a bump costs a heart');
    assert.equal(await page.evaluate(() => window.__tapMazePlay.alive.filter(Boolean).length),
      await page.evaluate(() => window.__tapMazePlay.alive.length), 'blocked arrow stays');

    // Now clear the board using the hint each time.
    for (let guard = 0; guard < 200; guard++) {
      if (await page.locator('.dialog:not([hidden])').count()) break;
      const next = await page.evaluate(() => {
        const p = window.__tapMazePlay;
        if (p.anims.size || p.alive.every((a) => !a)) return -1;
        p.showHint();
        return p.hint ? p.hint.i : -1;
      });
      if (next >= 0) await tapArrow(page, next);
      await page.waitForTimeout(150);
    }
    await page.locator('.dialog:not([hidden])').waitFor();
    assert.equal(await page.locator('.dialog .stars i.on').count(), 2, 'stars = hearts left');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:tap-maze:progress')));
    assert.equal(saved.unlocked, 2);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('analytics events recorded offline are sent once back online', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // Stand-in for gtag.js so the test never talks to Google.
    let gtagLoads = 0;
    await context.route('https://www.googletagmanager.com/**', (route) => {
      gtagLoads++;
      route.fulfill({ contentType: 'text/javascript', body: 'window.__gtagLoaded = true;' });
    });
    const page = await context.newPage();
    const url = `http://localhost:${server.address().port}/`;
    // First visit installs the offline cache.
    await page.goto(url);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
      localStorage.setItem('pocket-arcade:analytics-test', 'true');
    });
    // Later the app is opened and played with no connection.
    await context.setOffline(true);
    await page.reload();
    await page.locator('[data-game=car-jam]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__carJamPlay);
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:analytics-queue')).map((e) => e.name));
    assert.ok(queued.includes('level_start'), `queued while offline: ${queued}`);

    await context.setOffline(false);
    await page.waitForFunction(() => window.__gtagLoaded &&
      JSON.parse(localStorage.getItem('pocket-arcade:analytics-queue')).length === 0);
    const sent = await page.evaluate(() => window.dataLayer.filter((a) => a[0] === 'event').map((a) => [a[1], a[2]]));
    const names = sent.map(([n]) => n);
    assert.ok(names.includes('app_open') && names.includes('level_start') && names.includes('page_view'), names.join());
    assert.equal(sent.find(([n]) => n === 'level_start')[1].game, 'car-jam');
    assert.ok(gtagLoads >= 1);
  } finally {
    await browser.close();
    server.close();
  }
});

test('updates: progress on the home screen only, Update installs the newest, nothing switches by itself', { skip: !chromium, timeout: 90000 }, async () => {
  const { readFile: rf } = await import('node:fs/promises');
  const { version } = JSON.parse(await rf(new URL('../package.json', import.meta.url), 'utf8'));
  const manifest = await rf(new URL('../sw-manifest.js', import.meta.url), 'utf8');
  const swSource = await rf(new URL('../sw.js', import.meta.url), 'utf8');
  const overrides = new Map();
  const delays = new Map();
  const server = await serve(overrides, delays);
  // "Deploy" a new version: same files, new precache manifest and worker.
  const deploy = (v) => {
    overrides.set('/sw-manifest.js', manifest
      .replace(/"appVersion": "[^"]+"/, `"appVersion": "${v}"`)
      .replace(/"version": "[^"]+"/, `"version": "deploy-${v}"`));
    overrides.set('/sw.js', `${swSource}\n// deploy ${v}\n`);
  };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const base = `http://localhost:${server.address().port}/`;
    await page.goto(base);
    assert.match(await page.locator('.hub-foot .version').textContent(), new RegExp(`^v${version.replace(/\./g, '\\.')}`));
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
    });
    const active = () => page.evaluate(() => new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => resolve(e.data);
      navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION', client: 'test' }, [ch.port2]);
    }));
    const waiting = () => page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg.waiting) return null;
      return new Promise((resolve) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => resolve(e.data);
        reg.waiting.postMessage({ type: 'GET_VERSION', client: 'test' }, [ch.port2]);
      });
    });
    const bar = page.locator('.update-bar');

    // 1. Version 99 downloads (slowly) with a progress bar on the home screen.
    deploy('99.0.0');
    delays.set('/games/tap-maze/model.js', 2500);
    await page.locator('.hub-foot .version').click();
    await page.locator('.update-bar[data-state=downloading] .progress-fill').waitFor({ timeout: 20000 });
    assert.match(await bar.textContent(), /Downloading update v99\.0\.0/);
    assert.match(await bar.textContent(), new RegExp(`You have v${version.replace(/\./g, '\\.')} · \\d+ of \\d+ files`));
    // ...but never over a game.
    await page.locator('[data-game=breakout]').click();
    await page.locator('.bo-choice').first().waitFor();
    assert.equal(await bar.count(), 0, 'no update bar inside a game');
    await page.locator('[data-act=home]').click();
    await page.locator('.update-bar[data-state=ready]').waitFor({ timeout: 20000 });
    assert.match(await bar.textContent(), /Version 99\.0\.0 is ready/);
    assert.equal(await page.locator('.update-bar .install-now').textContent(), 'Update to v99.0.0');
    assert.doesNotMatch(await bar.textContent(), /install/i);
    delays.clear();

    // 2. A newer version arrives while 99 is waiting. Update must install the
    //    newest one (this used to do nothing).
    deploy('100.0.0');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    for (let k = 0; k < 100 && (await waiting()) !== '100.0.0'; k++) await page.waitForTimeout(200);
    assert.equal(await waiting(), '100.0.0');
    await Promise.all([page.waitForEvent('load'), page.locator('.update-bar .install-now').click()]);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    assert.equal(await active(), '100.0.0');

    // 3. A version that downloads while you play never interrupts the game,
    //    and restarting the app doesn't switch either: it waits on the home
    //    screen for you to tap Update.
    await page.locator('[data-game=breakout]').click();
    await page.locator('.bo-choice').first().waitFor();
    await page.evaluate(() => (window.__stillHere = true));
    deploy('101.0.0');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    for (let k = 0; k < 100 && (await waiting()) !== '101.0.0'; k++) await page.waitForTimeout(200);
    assert.equal(await waiting(), '101.0.0');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.__stillHere), true, 'the game was not reloaded');
    assert.equal(await page.locator('.update-bar').count(), 0);
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.waitForTimeout(800);
    assert.equal(await active(), '100.0.0', 'restarting did not switch versions');
    await page.goto(base);
    await page.locator('.update-bar[data-state=ready]').waitFor({ timeout: 20000 });
    assert.equal(await page.locator('.update-bar .install-now').textContent(), 'Update to v101.0.0');
    await Promise.all([page.waitForEvent('load'), page.locator('.update-bar .install-now').click()]);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    assert.equal(await active(), '101.0.0');
  } finally {
    await browser.close();
    server.close();
  }
});

test('an update from the home screen downloads every game -- new ones too -- before it is ready', { skip: !chromium, timeout: 90000 }, async () => {
  const { readFile: rf } = await import('node:fs/promises');
  const manifest = await rf(new URL('../sw-manifest.js', import.meta.url), 'utf8');
  const swSource = await rf(new URL('../sw.js', import.meta.url), 'utf8');
  const overrides = new Map();
  const server = await serve(overrides);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
      }
    });
    await waitUntil(page, async () => !!(await caches.match('__arcade__')));
    // As if the arcade's download was cut short: a whole game missing.
    await page.evaluate(async () => {
      for (const key of await caches.keys()) {
        const cache = await caches.open(key);
        for (const req of await cache.keys()) if (req.url.includes('/games/car-jam/')) await cache.delete(req);
      }
    });
    // A new version, with a new game in it.
    const next = manifest
      .replace(/"appVersion": "[^"]+"/, '"appVersion": "99.0.0"')
      .replace(/"version": "[^"]+"/, '"version": "deploy-99"')
      .replace('"files": [', '"files": [\n    "games/zzz-new/play.js",');
    overrides.set('/sw-manifest.js', next);
    overrides.set('/sw.js', `${swSource}\n// deploy 99\n`);
    overrides.set('/games/zzz-new/play.js', 'export {};');
    const { files } = new Function('self', `${next}; return self.PRECACHE;`)({});
    await page.locator('.hub-foot .version').click();
    await page.locator('.update-bar[data-state=ready]').waitFor({ timeout: 30000 });
    const missing = await page.evaluate(async (list) => {
      const cache = await caches.open('pocket-arcade-deploy-99');
      const out = [];
      for (const f of list) if (!(await cache.match(f))) out.push(f);
      return out;
    }, files);
    assert.deepEqual(missing, [], 'every file of the new version, before Update');
  } finally {
    await browser.close();
    server.close();
  }
});

test('breakout: locks orientation where possible, pauses on rotation where not', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const url = `http://localhost:${server.address().port}/#/breakout`;
    const errors = [];

    // A phone that allows locking: record what we lock to.
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.__locks = [];
      screen.orientation.lock = async (kind) => window.__locks.push(kind);
      screen.orientation.unlock = () => window.__locks.push('unlock');
    });
    await page.goto(url);
    await page.locator('.bo-choice[data-kind=landscape]').click();
    await page.waitForFunction(() => window.__breakout);
    assert.deepEqual(await page.evaluate(() => window.__locks), ['landscape']);
    // The lock turns the screen sideways.
    await page.setViewportSize({ width: 844, height: 390 });
    assert.equal(await page.evaluate(() => window.__breakout.game.L.cols), 14);
    // The paddle sits high enough to leave thumb room (~1.3 cm) below it.
    const gap = async (p) => p.evaluate(() => {
      const b = window.__breakout;
      const r = b.canvas.getBoundingClientRect();
      const bottom = r.top + b.oy + (b.game.paddle.y + b.game.paddle.h) * b.scale;
      return window.innerHeight - bottom;
    });
    await page.waitForFunction(() => {
      const b = window.__breakout;
      const r = b.canvas.getBoundingClientRect();
      return window.innerHeight - (r.top + b.oy + (b.game.paddle.y + b.game.paddle.h) * b.scale) >= 49;
    }, null, { timeout: 5000 }).catch(() => {});
    assert.ok(await gap(page) >= 49, `room below paddle: ${await gap(page)}px`);
    // Play a little on autopilot: bricks break and the score goes up.
    await page.evaluate(() => (window.__breakout.autopilot = true));
    await page.waitForFunction(() => window.__breakout.game.score > 0, null, { timeout: 20000 });
    assert.ok(Number(await page.locator('[data-score]').textContent()) > 0);
    // Leaving the game releases the lock.
    await page.locator('[data-act=menu]').click();
    assert.equal(await page.evaluate(() => window.__locks.at(-1)), 'unlock');
    await page.close();

    // A phone that can't lock (like iOS): rotating mid-game pauses it.
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    p2.on('pageerror', (e) => errors.push(e.message));
    await p2.addInitScript(() => {
      screen.orientation.lock = () => Promise.reject(new Error('NotSupportedError'));
    });
    await p2.goto(url);
    await p2.locator('.bo-choice[data-kind=portrait]').click();
    await p2.waitForFunction(() => window.__breakout);
    await p2.evaluate(() => (window.__breakout.autopilot = true));
    await p2.waitForTimeout(500);
    await p2.setViewportSize({ width: 844, height: 390 });
    await p2.locator('.bo-overlay:not([hidden])').waitFor();
    assert.match(await p2.locator('.bo-overlay').textContent(), /Turn your phone back to portrait/);
    assert.equal(await p2.evaluate(() => window.__breakout.paused), true);
    const frozen = await p2.evaluate(() => ({ ...window.__breakout.game.ball }));
    await p2.waitForTimeout(300);
    assert.deepEqual(await p2.evaluate(() => ({ ...window.__breakout.game.ball })), frozen, 'ball frozen while paused');
    // Turn back: tap to carry on.
    await p2.setViewportSize({ width: 390, height: 844 });
    await p2.waitForFunction(() => document.querySelector('.bo-overlay').textContent.includes('Tap to continue'));
    await p2.locator('.bo-overlay').click();
    assert.equal(await p2.evaluate(() => window.__breakout.paused), false);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('benji’s town: fire! it breaks out at a house, and the fire engine goes and puts it out', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.evaluate(() => localStorage.setItem('pocket-arcade:benji:day', '2'));
    await page.goto(`http://localhost:${server.address().port}/#/benji`);
    await page.waitForFunction(() => window.__benji);
    const r = await page.evaluate(() => {
      const p = window.__benji;
      cancelAnimationFrame(p.raf);
      const said = [];
      const sounds = [];
      p.hooks.say = (w) => w && said.push(w);
      p.hooks.sfx = (n) => sounds.push(n);
      const run = (secs, until) => {
        for (let i = 0; i < secs * 30 && !until(); i++) p.update(1 / 30);
      };
      run(30, () => p.part);
      p.fireAt = p.t; // (now, not in a little while)
      run(1, () => p.fire);
      const engine = p.helpers.find((h) => h.kind === 'fire');
      const lit = { fire: !!p.fire, job: p.town.jobs.some((j) => j.kind === 'fire'), ready: p.ready(engine) };
      p.start(engine);
      // On its way: lights and siren on, through any red light.
      let urgent = 0;
      let red = false;
      run(120, () => {
        if (engine.urgent && !engine.spray) urgent += 1 / 30;
        red ||= engine.wait === 'light';
        return p.fire === null;
      });
      run(3, () => false); // (and then, what was done)
      const job = p.town.jobs.find((j) => j.kind === 'fire');
      return { lit, out: p.fire === null && p.done.has(job.i), said, sounds, urgent, red, after: engine.urgent };
    });
    assert.deepEqual(r.lit, { fire: true, job: true, ready: true }, 'a fire, its job, and the fire engine ready');
    assert.ok(r.out, 'put out');
    assert.ok(r.said.includes('Fire! Call the fire engine!'));
    assert.ok(r.said.includes('You put out the fire, great job!'));
    for (const s of ['crackle', 'siren', 'spray']) assert.ok(r.sounds.includes(s), s);
    // (The siren the whole way: after the first, round again as it goes.)
    assert.ok(r.urgent < 2.6 || r.sounds.includes('wail'), 'wail');
    assert.ok(r.urgent && !r.red, 'lights flashing on the way, and no stopping for red lights');
    assert.equal(r.after, false, 'lights off once the fire is out');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('benji’s town: tap the helpers and they do their jobs, morning to evening; night falls and it\'s the next day; a treat on the way; later, drive them from the driver\'s seat', { skip: !chromium, timeout: 240000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    // Straight into the town (no levels): day 1, at dawn.
    await page.locator('[data-game=benji]').click();
    await page.waitForFunction(() => window.__benji);
    assert.match(await page.locator('.bt-screen h2').textContent(), /^Day 1/);
    // The turn buttons turn the town a quarter at a time.
    const turn = await page.evaluate(() => {
      const p = window.__benji;
      const r = p.canvas.getBoundingClientRect();
      return { x: r.left + p.buttons[1].x, y: r.top + p.buttons[1].y };
    });
    await page.mouse.click(turn.x, turn.y);
    await page.waitForFunction(() => window.__benji.rot === 1 && !window.__benji.spin);
    // The morning: a button over the garbage truck for its next job (and
    // no arrow to where till it's started); tap it, again and again, till
    // the morning's jobs are done.
    const buttons = () => page.evaluate(() => {
      const p = window.__benji;
      const r = p.canvas.getBoundingClientRect();
      return p.goButtons().map((b) => ({ id: b.h.id, x: r.left + b.x, y: r.top + b.y }));
    });
    await page.waitForFunction(() => window.__benji.goButtons().length === 1);
    // (Left a moment, it says what to do -- and that button bounces.)
    await page.waitForFunction(() => window.__benji.hint?.h.id === 'garbage', null, { timeout: 8000 });
    let pressed = 0;
    for (let k = 0; k < 150 && !(await page.evaluate(() => window.__benji.won)); k++) {
      for (const b of await buttons()) {
        await page.mouse.click(b.x, b.y);
        pressed++;
        assert.ok(await page.evaluate(() => window.__benji.helpers[0].path.length > 0 || window.__benji.helpers[0].pause > 0), 'off it goes');
      }
      await page.waitForTimeout(400);
    }
    assert.ok(pressed >= 3, `a press for each job (${pressed})`);
    assert.equal(await page.evaluate(() => window.__benji.part.part), 'morning');
    // On through the day (faster, for the test): the dog in the evening,
    // then night falls -- everyone home -- and it's the next morning, kept.
    await page.evaluate(() => {
      window.__benji.speed = 6;
      window.__parts = [];
      const p = window.__benji;
      const on = p.hooks.onPart;
      p.hooks.onPart = (w) => (window.__parts.push(w), on?.(w));
    });
    for (let k = 0; k < 300 && (await page.evaluate(() => window.__benji.town.day)) === 1; k++) {
      for (const b of await buttons()) await page.mouse.click(b.x, b.y);
      await page.waitForTimeout(250);
    }
    const parts = await page.evaluate(() => window.__parts);
    for (const part of ['midday', 'evening', 'night', 'dawn']) assert.ok(parts.includes(part), `${part} came (${parts})`);
    assert.equal(await page.evaluate(() => localStorage.getItem('pocket-arcade:benji:day')), '2');
    assert.match(await page.locator('.bt-screen h2').textContent(), /^Day 2/);
    // A treat on the way: a helper out on a trip, and the café's sign
    // tapped -- off it goes for an ice cream, in and out, "Yum!", and on.
    await page.evaluate(() => { window.__benji.speed = 1; window.__said = []; const p = window.__benji; const say = p.hooks.say; p.hooks.say = (w) => (window.__said.push(w), say?.(w)); });
    await page.waitForFunction(() => {
      const p = window.__benji;
      const h = p.helpers.find((m) => m.kind !== 'walker' && (p.ready(m) || m.path.length > 2));
      if (h && p.ready(h)) p.start(h);
      return h && h.path.length > 2 && h.pause <= 0;
    }, null, { timeout: 30000, polling: 250 });
    await page.evaluate(() => {
      const p = window.__benji;
      const cafe = p.town.places.find((q) => q.kind === 'cafe');
      const [x, y, z] = p.signOf(cafe);
      const [sx, sy] = p.view.at(x, y, z);
      if (sx > 0 && sx < p.W && sy > 0 && sy < p.viewH && p.signAt(p.view, sx, sy) !== cafe) throw new Error('the sign, under the finger');
      p.treat(cafe);
    });
    assert.ok(await page.evaluate(() => window.__benji.helpers.some((h) => h.treat?.place === 'cafe')), 'off for an ice cream');
    await page.waitForFunction(() => window.__said.includes('Yum! Ice cream!'), null, { timeout: 45000 });
    // Driving: tap a helper and you're in the driver's seat. Any
    // arrow and you're off (it goes the way to the job by itself, unless you
    // choose); every press is answered -- at the job you stop till the next.
    // (Driving's yours to choose: the car button, top right -- kept.)
    // (The steering wheel: on, and you're straight into a driver's seat;
    // off and on again, back into the same one.)
    const work = await page.evaluate(() => window.__benji.helpers.some((h) => window.__benji.targetPlace(h)));
    await page.locator('.bt-screen [data-act=drive]').click();
    const seat = await page.evaluate(() => window.__benji.fp?.h.id);
    if (work) {
      assert.ok(seat, 'into a driver\'s seat at once');
      await page.locator('.bt-screen [data-act=drive]').click();
      assert.equal(await page.evaluate(() => window.__benji.fp), null, 'out again');
      await page.locator('.bt-screen [data-act=drive]').click();
      assert.equal(await page.evaluate(() => window.__benji.fp?.h.id), seat, 'back in the same one');
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('pocket-arcade:benji:drive')), 'true');
    await page.reload();
    await page.waitForFunction(() => window.__benji?.drive && window.__benji.part);
    await page.evaluate(() => {
      window.__said = [];
      const p = window.__benji;
      const say = p.hooks.say;
      p.hooks.say = (w) => (window.__said.push(w), say?.(w));
    });
    const pad = (act) => page.evaluate((act) => {
      const p = window.__benji;
      const r = p.canvas.getBoundingClientRect();
      const b = p.pads.find((q) => q.act === act);
      return { x: r.left + b.x, y: r.top + b.y };
    }, act);
    let seated = false;
    let turned = false;
    let faded = false;
    // (Hooray, when it comes -- the next part of the day can follow straight
    // on, if the clock's already there.)
    await page.evaluate(() => {
      const p = window.__benji;
      const win = p.win.bind(p);
      p.win = () => {
        window.__won = true;
        win();
      };
    });
    for (let k = 0; k < 400 && !(await page.evaluate(() => window.__won)); k++) {
      const st = await page.evaluate(() => {
        const p = window.__benji;
        const h = p.fp?.h || p.helpers.find((m) => p.targetPlace(m));
        return h && { fp: !!p.fp, go: p.fp?.go, hint: p.fp?.hint, walker: h.kind === 'walker', live: p.fp && ['left', 'go', 'right'].filter((a) => p.can(a)), busy: h.pause > 0 || !!h.deliver, stale: !!p.fp && !p.fp.go && p.fp.intent !== null, at: p.screenOf(h.x, h.y, 0.25) };
      });
      if (!st) {
        await page.waitForTimeout(300);
        continue;
      }
      if (!st.fp) {
        await page.mouse.click(st.at.x, st.at.y);
        await page.waitForTimeout(300);
        continue;
      }
      if (!seated) {
        // (A finger across the windshield looks round.)
        const r = await page.evaluate(() => { const c = window.__benji.canvas.getBoundingClientRect(); return { x: c.left + 300, y: c.top + 300 }; });
        await page.mouse.move(r.x, r.y);
        await page.mouse.down();
        for (let i = 1; i <= 6; i++) await page.mouse.move(r.x - i * 25, r.y);
        assert.ok(await page.evaluate(() => window.__benji.fp.look > 0.3), 'looked round');
        await page.mouse.up();
      }
      seated = true;
      // (Stopped, nothing's left chosen; busy with a job, the arrows are
      // faded, and pressing one does nothing.)
      assert.ok(!st.stale, 'no arrow left chosen while stopped');
      if (st.busy) {
        assert.deepEqual(st.live, [], 'no arrows while busy with a job');
        const b = await pad('left');
        await page.mouse.click(b.x, b.y);
        faded = await page.evaluate(() => !window.__benji.fp || window.__benji.fp.intent === null);
      } else if (st.go && !st.walker) {
        // (Driving along: nothing to press till you stop.)
        assert.deepEqual(st.live, [], 'no buttons while driving along');
      } else if (!st.go) {
        // (Stopped -- at a corner, one block at a time: the way to the job;
        // the way through it shows on the road at once, and it's said.)
        const way = st.hint === 'left' || st.hint === 'right' ? st.hint : 'go';
        const act = st.live.includes(way) ? way : 'go';
        const was = await page.evaluate(() => JSON.stringify(window.__benji.fp?.corner?.out));
        const go = await pad(act);
        await page.mouse.click(go.x, go.y);
        if (!turned && act !== 'go' && !st.walker) {
          turned = await page.evaluate(([w, was]) => {
            const p = window.__benji;
            return !!p.fp?.corner && JSON.stringify(p.fp.corner.out) !== was && window.__said.includes(w);
          }, [act === 'left' ? 'Left!' : 'Right!', was]);
        }
      }
      await page.waitForTimeout(250);
    }
    assert.ok(turned, 'a turn chosen, shown and said');
    assert.ok(faded, 'a press during a job does nothing');
    assert.ok(seated, 'drove it from the driver\'s seat');
    assert.ok(await page.evaluate(() => window.__won), 'the morning\'s jobs done');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('lunar lander, Apollo 11: the computer flies down from orbit, hands over, and a landing on clear ground counts', { skip: !chromium, timeout: 120000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/#/lander`);
    // Open to everyone, from the mission list.
    await page.locator('.ll-apollo').click();
    await page.locator('.ll-start[data-start=low]').click();
    await page.waitForFunction(() => window.__lander?.level.apollo);
    const start = await page.evaluate(() => ({ computer: window.__lander.computer, warp: window.__lander.timeScale, alt: window.__lander.L.y }));
    assert.ok(start.computer && start.warp === 16 && start.alt > 15000, JSON.stringify(start));
    assert.match(await page.locator('.ll-warp').textContent(), /16×/);
    // The real voices come in at their moments (listened for from here on).
    await page.evaluate(() => {
      const p = window.__lander;
      const say = p.hooks.voice;
      window.__voices = [];
      p.hooks.voice = (name) => (window.__voices.push(name), say(name));
    });
    // Fast-forward: the computer flies it to Low Gate, then it's yours.
    await page.evaluate(() => window.__lander.setWarp(64));
    await page.waitForFunction(() => !window.__lander.computer, null, { timeout: 90000 });
    const handed = await page.evaluate(() => ({ prog: window.__lander.L.prog, warp: window.__lander.timeScale, msg: window.__lander.message?.text }));
    assert.equal(handed.prog, 66);
    assert.equal(handed.warp, 1);
    assert.match(handed.msg, /boulders/);
    // Set it down gently on clear ground, where Eagle landed.
    await page.evaluate(() => {
      const p = window.__lander;
      const b = p.level.base;
      Object.assign(p.L, { x: (b.x0 + b.x1) / 2, y: b.y + 1.5, vx: 0, vy: -0.6, angle: 0, omega: 0 });
    });
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 15000 });
    assert.match(await page.locator('.dialog h3').textContent(), /Eagle has landed/);
    const voices = await page.evaluate(() => window.__voices);
    for (const v of ['alarm-1202', 'alarm-1201', 'contact-light']) assert.ok(voices.includes(v), `${v} in ${voices}`);
    // ...and each clip decodes.
    const lengths = await page.evaluate(async () => {
      const a = await import('/js/lib/audio.js');
      const names = ['go-for-pdi', 'alarm-1202', 'alarm-1201', 'sixty-seconds', 'thirty-seconds', 'contact-light'];
      return Promise.all(names.map(async (n) => (await a.loadClip(new URL(`/games/lander/audio/a11-${n}.mp3`, location.href).href))?.duration));
    });
    assert.ok(lengths.every((d) => d > 0.8 && d < 6), JSON.stringify(lengths));
    assert.match(await page.locator('.dialog').textContent(), /Fuel left: \d+ s/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:lander:progress')));
    assert.ok(saved.apollo.low >= 1);
    // Back on the chooser, the stars show.
    await page.locator('.dialog [data-act=levels]').click();
    await page.locator('.ll-start[data-start=low] i').filter({ hasText: '★' }).waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('lunar lander: thrust button lifts off, a landing scores, a crash explodes', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=lander]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__lander);

    // Hold THRUST with a real pointer: the lander leaves the pad.
    const btn = await page.locator('.ll-thrust').boundingBox();
    await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => window.__lander.L.landed === null && window.__lander.L.y > window.__lander.level.startPad.y + 2);
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__lander.input.thrust), false, 'releasing stops the engine');

    // Climb hard: the view keeps the lander below the instrument panel.
    const hidden = await page.evaluate(async () => {
      const p = window.__lander;
      p.L.fuel = p.L.fuelMax;
      p.timeScale = 4;
      p.input.thrust = true;
      let worst = Infinity;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const cam = p.camera();
        const top = p.cssH - (p.L.y + 5.2 - cam.bottom) * cam.scale;
        worst = Math.min(worst, top - p.panelBottom);
      }
      p.input.thrust = false;
      return worst;
    });
    assert.ok(hidden >= 0, `lander stays clear of the panel (${hidden.toFixed(1)} px)`);

    // Pause: the lander holds still mid-air until you tap to carry on.
    await page.locator('[data-act=pause]').click();
    const y0 = await page.evaluate(() => window.__lander.L.y);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__lander.L.y), y0, 'frozen while paused');
    assert.ok(await page.locator('.ll-paused:not([hidden])').count());
    await page.locator('.ll-paused').click();
    assert.equal(await page.evaluate(() => window.__lander.paused), false);

    // Let the autopilot fly the rest, fast-forwarded. Top the tank back up
    // first: on a slow test machine the button may have been held a long
    // time, and this test is about landing, not fuel.
    await page.evaluate(async () => {
      const m = await import('/games/lander/engine.js');
      const p = window.__lander;
      p.L.fuel = p.L.fuelMax;
      p.timeScale = 6;
      p.pilot = m.autopilot;
    });
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 60000 });
    assert.match(await page.locator('.dialog h3').textContent(), /landed|landing|piece/i);
    assert.ok(await page.locator('.dialog .ll-score').count());
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:lander:progress')));
    assert.equal(saved.unlocked, 2);
    // Flown with assist on (part of the way): noted on the card and saved,
    // for the A on the level grid.
    assert.ok(await page.locator('.dialog .ll-assisted').count());
    assert.equal(saved.assisted?.['1'], true);
    // "The Eagle has landed" plays (it decodes), until you leave the score card.
    const clip = await page.evaluate(async () => {
      const a = await import('/js/lib/audio.js');
      const buf = await a.loadClip(new URL('/games/lander/audio/eagle-has-landed.mp3', location.href).href);
      return { playing: a.clipCount(), seconds: buf?.duration };
    });
    assert.equal(clip.playing, 1);
    assert.ok(clip.seconds > 14 && clip.seconds < 16, `clip is ${clip.seconds} s`);

    // Fly again (which stops the clip) and crash on purpose.
    await page.evaluate(() => (window.__lander.pilot = null));
    await page.locator('[data-act=replay]').click();
    assert.equal(await page.evaluate(async () => (await import('/js/lib/audio.js')).clipCount()), 0);
    await page.evaluate(() => {
      const p = window.__lander;
      p.L.landed = null;
      p.L.y += 60;
      p.L.vy = -20;
    });
    await page.waitForFunction(() => window.__lander.L.crashed);
    assert.ok(await page.evaluate(() => window.__lander.debris.length > 5 && window.__lander.particles.length > 20), 'fireball and wreckage');
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 10000 });
    assert.match(await page.locator('.dialog h3').textContent(), /Crashed/);
    // Try again: the fly-over replays, with the path just flown (ending in
    // the crash) drawn on it, then the mission starts over.
    await page.locator('[data-act=retry]').click();
    const replay = await page.evaluate(() => {
      const p = window.__lander;
      return { intro: !!p.intro, points: p.lastTry?.path.length, reason: p.lastTry?.reason, landed: p.L.landed };
    });
    assert.ok(replay.intro && replay.points > 1 && /Impact/.test(replay.reason) && replay.landed === 'start', JSON.stringify(replay));
    await page.waitForFunction(() => !window.__lander.intro, null, { timeout: 15000 });

    // Crash again and ask to be shown: the autopilot flies it (fast-forwarded
    // here) and lands, and that doesn't count toward your progress.
    await page.evaluate(() => {
      const p = window.__lander;
      p.L.landed = null;
      p.L.y += 60;
      p.L.vy = -20;
    });
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 10000 });
    await page.locator('[data-act=showme]').click();
    assert.ok(await page.evaluate(() => window.__lander.demo));
    assert.ok(await page.locator('.ll-demo:not([hidden])').count());
    await page.evaluate(() => (window.__lander.timeScale = 6));
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 60000 });
    assert.match(await page.locator('.dialog h3').textContent(), /how it/);
    // Its best flight, exactly as worked out: the same score.
    const planned = await page.evaluate(() => window.__lander.level.best.res.score.total);
    assert.match(await page.locator('.dialog').textContent(), new RegExp(`scored ${planned},`));
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:lander:progress')));
    assert.deepEqual(after, saved);
    await page.locator('[data-act=retry]').click();
    assert.equal(await page.evaluate(() => window.__lander.demo), false);
    assert.equal(await page.locator('.ll-demo:not([hidden])').count(), 0);
    // The level grid: mission 1 marked A (landed with assist), explained.
    await page.locator('[data-act=levels]').click();
    assert.equal(await page.locator('.lvl[data-n="1"] .lvl-badge').textContent(), 'A');
    assert.match(await page.locator('.levels-intro').last().textContent(), /landed with ASSIST on/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('jigsaw: pick a photo, it is saved, pieces snap into place, progress resumes', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // A test "photo": render a colourful picture to PNG.
    const shot = await browser.newPage({ viewport: { width: 640, height: 480 } });
    await shot.setContent('<body style="margin:0;background:linear-gradient(45deg,#f72585,#4361ee,#4cc9f0)"><h1 style="font:80px sans-serif;color:#fff;margin:150px 60px">Hello!</h1></body>');
    const png = await shot.screenshot();
    await shot.close();

    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=jigsaw]').click();
    await page.locator('.jg-sizes button[data-n="24"]').click();
    await page.locator('input[data-src=gallery]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.pieces.length > 0);
    const n = await page.evaluate(() => window.__jigsaw.pieces.length);
    assert.ok(n >= 20 && n <= 30, `about 24 pieces (${n})`);

    // Pieces start scrambled and turned (each a random quarter turn, so
    // about three in four -- at least a quarter of them, all but never).
    const turned = await page.evaluate(() => window.__jigsaw.pieces.filter((p) => p.rot !== 0).length);
    assert.ok(turned >= n / 4, `pieces start turned (${turned}/${n})`);

    // A turned piece dropped on its spot doesn't fit; tapping turns it, and
    // once it's the right way up it snaps in.
    const geo = () => page.evaluate(() => {
      const p = window.__jigsaw;
      const piece = p.pieces.find((q) => q.rot !== 0 && !q.placed);
      const idx = p.pieces.indexOf(piece);
      p.order = [...p.order.filter((i) => i !== idx), idx]; // on top
      const at = p.pos(piece);
      const home = p.home(piece);
      const r = p.canvas.getBoundingClientRect();
      return { idx, rot: piece.rot, from: [r.left + at.x + p.pw / 2, r.top + at.y + p.ph / 2], to: [r.left + home.x + p.pw / 2 + 4, r.top + home.y + p.ph / 2 - 3] };
    });
    const drag = await geo();
    await page.mouse.move(...drag.from);
    await page.mouse.down();
    await page.mouse.move(...drag.to, { steps: 8 });
    await page.mouse.up();
    assert.equal(await page.locator('[data-placed]').textContent(), '0', 'turned piece does not fit');
    for (let k = drag.rot; k < 4; k++) {
      await page.mouse.click(...drag.to);
      await page.waitForTimeout(80);
    }
    assert.equal(await page.locator('[data-placed]').textContent(), '1');
    assert.equal(await page.evaluate((i) => window.__jigsaw.pieces[i].placed, drag.idx), true);

    // Two neighbours put together away from their spot (turned the same
    // way) lock into one piece...
    const pair = await page.evaluate(() => {
      const p = window.__jigsaw;
      const a = p.pieces.find((q) => !q.placed && q.col + 1 < p.cols && !p.at(q.row, q.col + 1).placed);
      const b = p.at(a.row, a.col + 1);
      for (const q of [a, b]) {
        q.rot = q.turn = 1;
        p.renderPiece(q);
      }
      p.setCentre(a, p.W * 0.35, p.H * 0.25);
      const want = p.beside(a, b);
      p.setCentre(b, want.x + 50, want.y + 60);
      const ia = p.pieces.indexOf(a);
      const ib = p.pieces.indexOf(b);
      p.order = [...p.order.filter((i) => i !== ia && i !== ib), ia, ib];
      p.dirty = true;
      const r = p.canvas.getBoundingClientRect();
      const cb = p.centre(b);
      return { ia, ib, from: [r.left + cb.x, r.top + cb.y], to: [r.left + want.x + 5, r.top + want.y - 4] };
    });
    await page.mouse.move(...pair.from);
    await page.mouse.down();
    await page.mouse.move(...pair.to, { steps: 8 });
    await page.mouse.up();
    const grouped = await page.evaluate(({ ia, ib }) => {
      const p = window.__jigsaw;
      return p.pieces[ia].group !== 0 && p.pieces[ia].group === p.pieces[ib].group;
    }, pair);
    assert.equal(grouped, true, 'locked together');
    // ...and then drag as one.
    const grab = await page.evaluate(({ ia }) => {
      const p = window.__jigsaw;
      const r = p.canvas.getBoundingClientRect();
      const c = p.centre(p.pieces[ia]);
      return [r.left + c.x, r.top + c.y];
    }, pair);
    await page.mouse.move(...grab);
    await page.mouse.down();
    await page.mouse.move(grab[0] + 40, grab[1] + 30, { steps: 6 });
    await page.mouse.up();
    const together = await page.evaluate(({ ia, ib }) => {
      const p = window.__jigsaw;
      const a = p.pieces[ia];
      const b = p.pieces[ib];
      const want = p.beside(a, b);
      const c = p.centre(b);
      return Math.hypot(c.x - want.x, c.y - want.y);
    }, pair);
    assert.ok(together < 0.5, `still locked together after the drag (${together})`);

    // Pinch with two fingers to zoom the table.
    const box = await page.locator('.jg-screen canvas').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const at = (d) => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(30) });
    for (const d of [45, 60, 75, 90]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(d) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const zoom = await page.evaluate(() => window.__jigsaw.view.s);
    assert.ok(zoom > 2.5 && zoom < 3.5, `zoomed in about 3x (${zoom})`);
    // ...and back out.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(90) });
    for (const d of [60, 40, 25]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(d) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.evaluate(() => window.__jigsaw.view.s), 1);

    // The clock only counts time you're actually at it: it pauses after
    // 30 seconds without a touch.
    const paused = await page.evaluate(async () => {
      const p = window.__jigsaw;
      p.lastTouch = performance.now() - 31000;
      const t0 = p.time();
      await new Promise((r) => setTimeout(r, 400));
      const still = p.time() === t0 && p.idle();
      p.touch();
      await new Promise((r) => setTimeout(r, 400));
      return still && p.time() > t0;
    });
    assert.equal(paused, true);

    // The picture is hidden; Peek shows it only while held.
    const peekBox = await page.locator('[data-act=peek]').boundingBox();
    await page.mouse.move(peekBox.x + peekBox.width / 2, peekBox.y + peekBox.height / 2);
    await page.mouse.down();
    assert.equal(await page.evaluate(() => window.__jigsaw.peek), true);
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__jigsaw.peek), false);

    // Leave and come back: the photo is saved and the puzzle can be continued.
    await page.locator('[data-act=menu]').click();
    await page.locator('[data-list=photos] .jg-tile').first().waitFor();
    assert.equal(await page.locator('[data-list=photos] .jg-tile').count(), 1);
    await page.locator('.jg-continue button').click();
    await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.placedCount() === 1);

    // Finish it.
    await page.evaluate(() => {
      const p = window.__jigsaw;
      for (const piece of p.pieces) if (!piece.placed) p.place(piece);
    });
    await page.locator('.dialog:not([hidden])').waitFor();
    assert.match(await page.locator('.dialog h3').textContent(), /Puzzle complete/);
    assert.equal(await page.locator('.dialog .jg-chart path').count(), 2, 'a chart of progress over time');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('night driver: two thumbs at once, a fork read right, a wrong turn, game over', { skip: !chromium, timeout: 120000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=night-driver]').click();
    await page.locator('.dialog [data-act=start]').click();

    // Right thumb holds GAS while the left thumb drags the wheel: real
    // multi-touch, through the browser's touch input.
    const gas = await page.locator('.nd-gas').boundingBox();
    const wheel = await page.locator('.nd-steer').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const g = { x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 1 };
    const w = { x: wheel.x + wheel.width / 2, y: wheel.y + wheel.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [g] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [g, w] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [g, { ...w, x: w.x + i * 12 }] });
    }
    const held = await page.evaluate(() => ({ ...window.__nightDriver.input }));
    assert.equal(held.gas, true);
    assert.ok(held.steer > 0.5, `steering right (${held.steer})`);
    await page.waitForFunction(() => window.__nightDriver.car.v > 3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => !window.__nightDriver.input.gas && window.__nightDriver.input.steer === 0);

    // Let it drive itself (fast) to the first fork: it reads the sign right.
    await page.evaluate(() => {
      const p = window.__nightDriver;
      p.car.time = 900;
      p.car.x = p.road.center(p.car.z);
      p.autopilot = true;
      p.timeScale = 6;
    });
    await page.waitForFunction(() => window.__nightDriver.road.forks[0]?.side, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__nightDriver.road.forks[0].side === window.__nightDriver.road.forks[0].safe), true);
    assert.equal(await page.evaluate(() => window.__nightDriver.car.goodCalls), 1);

    // Now take the wrong road: it ends in the hazard the sign warned of.
    const hazard = await page.evaluate(() => {
      const p = window.__nightDriver;
      p.pilotOpts = { wrong: true, speed: 25 }; // (too slow to jump a drawbridge)
      p.road.extend(p.car.z + 6000);
      return p.road.forks[1].hazard;
    });
    await page.waitForFunction(() => window.__nightDriver.car.crashes > 0, null, { timeout: 60000 });
    const { CRASH_LINES } = await import('../games/night-driver/signs.js');
    // (After a fall, the line shows once you hit the bottom.)
    await page.waitForFunction((t) => window.__nightDriver.message?.title === t, CRASH_LINES[hazard][0], { timeout: 30000 });

    // Out of time: coast to a stop and see the score.
    await page.evaluate(() => {
      const p = window.__nightDriver;
      p.autopilot = false;
      p.car.time = 0.5;
    });
    await page.locator('.dialog:not([hidden]) [data-act=again]').waitFor({ timeout: 60000 });
    assert.match(await page.locator('.dialog p').textContent(), /Score \d+/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('car jam: sending a car at a granny costs 2 moves', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://localhost:${server.address().port}/#/car-jam/1`);
    await page.waitForFunction(() => window.__carJamPlay);
    await page.evaluate(async () => {
      const p = window.__carJamPlay;
      const { solve } = await import('/games/car-jam/model.js');
      // Make a granny step out in front of every car that leaves the lot.
      let once = true;
      const real = p.mergeBlocked.bind(p);
      p.mergeBlocked = (car) => (once ? ((once = false), 'granny') : real(car));
      const sol = solve(p.m, p.pos, 40000);
      for (const mv of sol.moves) {
        p.tryMove(mv.car, mv.sign);
        if (p.cars[mv.car].mode === 'exit') break;
      }
    });
    await page.waitForFunction(() => window.__carJamPlay.scares === 1);
    assert.equal((await page.locator('[data-penalty]').textContent()).trim(), '+2');
  } finally {
    await browser.close();
    server.close();
  }
});

test('about box: the version history, newest first', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const { readFile: rf } = await import('node:fs/promises');
    const { version } = JSON.parse(await rf(new URL('../package.json', import.meta.url), 'utf8'));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-act=about]').click();
    const heads = await page.locator('.about-ver h5').allTextContents();
    assert.match(heads[0], new RegExp(`^v${version.replace(/\./g, '\\.')}`));
    assert.match(heads[0], /you have this/);
    assert.equal(heads.at(-1), 'v1.0.0');
    assert.ok(heads.length > 20);
    await page.locator('.about [data-act=close]').click();
    assert.equal(await page.locator('.about').count(), 0);
  } finally {
    await browser.close();
    server.close();
  }
});

test('water lab: drag a beaker onto another to pour, and measure the amount asked for', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=water]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__water);
    assert.match(await page.locator('.wl-goal').textContent(), /Measure exactly \d+/);
    // The first pour of a shortest solution, by really dragging a beaker.
    const { from, to } = await page.evaluate(async () => {
      const p = window.__water;
      const { solve } = await import('/games/water/model.js');
      const [i, j] = solve(p.level.caps, p.state, p.level.goal)[0];
      const r = p.canvas.getBoundingClientRect();
      const at = (k) => [r.left + p.slots[k].x, r.top + p.slots[k].y - p.slots[k].h / 2];
      return { from: at(i), to: at(j) };
    });
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(() => window.__water.moves === 1 && !window.__water.anim);
    // The map of every way the water can go: you're one pour from the start,
    // and the shortest way on is drawn.
    await page.locator('[data-act=map]').click();
    await page.locator('.wl-map').waitFor();
    const map = await page.evaluate(() => {
      const v = window.__waterMap;
      return { states: v.graph.nodes.length, mine: v.mine.length, ahead: v.ahead.length, par: window.__water.level.par, drawn: v.canvas.width > 0 };
    });
    assert.ok(map.states > 2 && map.drawn);
    assert.equal(map.mine, 2, 'start, then here');
    assert.equal(map.ahead, map.par, 'here, and the rest of a shortest way');
    await page.locator('.wl-map [data-act=close]').click();
    assert.equal(await page.locator('.wl-map').count(), 0);
    // The rest of it, one pour at a time.
    const par = await page.evaluate(() => window.__water.level.par);
    for (let k = 1; k < par; k++) {
      await page.evaluate(async () => {
        const p = window.__water;
        const { solve } = await import('/games/water/model.js');
        const [i, j] = solve(p.level.caps, p.state, p.level.goal)[0];
        p.tryPour(i, j);
      });
      await page.waitForFunction((m) => window.__water.moves === m && !window.__water.anim, k + 1);
    }
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 10000 });
    assert.match(await page.locator('.dialog p').textContent(), new RegExp(`${par} pours`));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:water:progress')));
    assert.equal(saved.unlocked, 2);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('tangram: tap a piece to turn it, drag it into place, flip the parallelogram, and finish the house', { skip: !chromium, timeout: 60000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    // (Last on the home screen: a link to suggest the next game.)
    assert.equal(await page.locator('a.card.soon').getAttribute('href'), 'https://forms.gle/c4VowgiYLaTZehYG7');
    await page.locator('[data-game=tangram]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__tangram);
    // Where on the page a point on the board is.
    const at = (pt) => page.evaluate((pt) => {
      const p = window.__tangram;
      const r = p.canvas.getBoundingClientRect();
      const [x, y] = p.toScreen(pt);
      return [r.left + x, r.top + y];
    }, pt);
    // A large triangle, and its place in the roof the fewest turns away.
    const { turns, rot, from, to } = await page.evaluate(() => {
      const p = window.__tangram;
      const piece = p.pieces[0];
      const [best] = p.fig.slots.filter((s) => s.t === 'L').map((s) => ({ s, d: (s.rot - piece.rot + 8) % 8 })).sort((a, b) => a.d - b.d);
      return { turns: best.d, rot: best.s.rot, from: [piece.x, piece.y], to: [best.s.x, best.s.y] };
    });
    assert.ok(turns > 0);
    for (let k = 0; k < turns; k++) {
      await page.mouse.click(...(await at(from)));
      await page.waitForTimeout(200);
    }
    assert.equal(await page.evaluate(() => window.__tangram.pieces[0].rot), rot);
    // Dragged to its place and dropped a little off, it snaps in.
    const a = await at(from);
    const b = await at(to);
    await page.mouse.move(...a);
    await page.mouse.down();
    await page.mouse.move(b[0] + 6, b[1] - 5, { steps: 12 });
    await page.mouse.up();
    assert.ok(await page.evaluate(() => window.__tangram.slotOf(window.__tangram.pieces[0]) >= 0), 'snapped into place');
    // Flip turns the parallelogram over, and back.
    await page.locator('[data-act=flip]').click();
    assert.equal(await page.evaluate(() => window.__tangram.pieces[6].flip), 1);
    await page.locator('[data-act=flip]').click();
    assert.equal(await page.evaluate(() => window.__tangram.pieces[6].flip), 0);
    // Hints put the rest in, one at a time.
    for (let k = 0; k < 6; k++) {
      await page.locator('[data-act=hint]').click();
      await page.waitForFunction(() => !window.__tangram.pieces.some((p) => p.glide));
    }
    assert.equal(await page.evaluate(() => window.__tangram.placed()), 7);
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 10000 });
    assert.match(await page.locator('.dialog p').textContent(), /house, with 6 hints/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:tangram:progress')));
    assert.equal(saved.unlocked, 2);
    assert.equal(saved.stars[1], 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('morse rain: a cloud of letters; tap the one whose code you hear, and clear the screen', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=morse]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__morse);
    // The lesson's letters, to hear.
    assert.equal(await page.locator('.mr-key').count(), 5);
    await page.locator('[data-act=start]').click();
    await page.waitForFunction(() => window.__morse.target);
    // Really tap a tile with the letter played (holding the cloud still).
    const at = await page.evaluate(() => {
      const p = window.__morse;
      p.timeScale = 0;
      const tile = p.tiles.find((t) => t.ch === p.target);
      const r = p.canvas.getBoundingClientRect();
      return { x: r.left + tile.x, y: r.top + tile.y, n: p.tiles.length };
    });
    await page.touchscreen.tap(at.x, at.y);
    assert.equal(await page.evaluate(() => window.__morse.right), 1);
    assert.equal(await page.evaluate(() => window.__morse.tiles.length), at.n - 1);
    // The rest, answered.
    await page.evaluate(() => {
      const p = window.__morse;
      p.timeScale = 6;
      setInterval(() => {
        const tile = p.target && p.tiles.find((t) => t.ch === p.target);
        if (tile) p.answer(tile);
      }, 50);
    });
    await page.locator('.dialog:not([hidden]) .stars').waitFor({ timeout: 60000 });
    assert.match(await page.locator('.dialog p').textContent(), /All \d+ cleared/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:morse:progress')));
    assert.equal(saved.unlocked, 2);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('morse rain, sending: key a letter by tapping, and the cannon shoots it down', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=morse]').click();
    // The Send tab: its own levels.
    await page.locator('.mr-tabs [data-mode=send]').click();
    await page.waitForFunction(() => location.hash === '#/morse/send');
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__morseSend);
    await page.locator('[data-act=start]').click();
    await page.waitForFunction(() => window.__morseSend.tiles.length > 0);
    // Key the lowest tile's letter with the mouse, held for real: a short
    // press for a dit, a long one for a dah.
    const { code, box } = await page.evaluate(async () => {
      const { CODE } = await import('/games/morse/code.js');
      const p = window.__morseSend;
      p.timeScale = 0.2; // (slow the rain while we key)
      const low = p.tiles.slice().sort((a, b) => b.y - a.y)[0];
      const r = p.canvas.getBoundingClientRect();
      return { code: CODE[low.ch], box: { x: r.left + r.width / 2, y: r.top + r.height / 2 } };
    });
    await page.mouse.move(box.x, box.y);
    for (const s of code) {
      await page.mouse.down();
      await page.waitForTimeout(s === '.' ? 70 : 280);
      await page.mouse.up();
      await page.waitForTimeout(90);
    }
    await page.waitForFunction(() => window.__morseSend.hits === 1 || window.__morseSend.shots.length === 1, null, { timeout: 5000 });
    // The rest, fired at for us.
    await page.evaluate(() => {
      const p = window.__morseSend;
      p.timeScale = 4;
      setInterval(() => {
        for (const a of p.tiles) if (!p.shots.some((s) => s.tile === a)) p.fire(a.ch);
      }, 100);
    });
    await page.locator('.dialog:not([hidden]) .stars').waitFor({ timeout: 60000 });
    assert.match(await page.locator('.dialog p').textContent(), /shot down/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:morse:send-progress')));
    assert.equal(saved.unlocked, 2);
    assert.match(await page.locator('.dialog p').textContent(), /Sent at \d+ wpm/);
    assert.ok(saved.wpm[1] > 0, 'best effective speed kept');
    assert.equal(await page.evaluate(() => localStorage.getItem('pocket-arcade:morse:progress')), null, 'listening progress apart');
    // ...and shown on the level's tile.
    await page.evaluate(() => { location.hash = '#/morse/send'; });
    assert.equal(await page.locator('.lvl[data-n="1"] .lvl-note').textContent(), `${saved.wpm[1]} wpm`);
    assert.equal(await page.locator('.lvl[data-n="2"] .lvl-note').count(), 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('15: tap tiles to slide them (several at once), solve with hints, and see the walk', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=fifteen]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__fifteen?.play);
    const tap = async (cell) => {
      const [x, y] = await page.evaluate((c) => {
        const p = window.__fifteen.play;
        const r = p.canvas.getBoundingClientRect();
        const [cx, cy] = p.cellCenter(c);
        return [r.left + cx, r.top + cy];
      }, cell);
      await page.mouse.click(x, y);
    };
    // A tile two along the gap's row: both slide.
    const far = await page.evaluate(() => {
      const p = window.__fifteen.play;
      const g = p.board.indexOf(0);
      const x = g % p.w;
      return x <= p.w - 3 ? g + 2 : g - 2;
    });
    await tap(far);
    assert.equal(await page.evaluate(() => window.__fifteen.play.moves.length), 2);
    assert.equal(await page.locator('[data-moves]').textContent(), '2');
    // The Hint button: the tile to move glows.
    await page.locator('[data-act=hint]').click();
    await page.waitForFunction(() => window.__fifteen.play.glow);
    // Then the hints, home.
    for (let k = 0; k < 40 && !(await page.evaluate(() => window.__fifteen.play.won)); k++) {
      const c = await page.evaluate(() => window.__fifteen.coach().hint());
      await tap(c);
    }
    assert.ok(await page.evaluate(() => window.__fifteen.play.won), 'solved');
    await page.locator('.dialog:not([hidden]) .ff-graph').waitFor({ timeout: 10000 });
    const text = await page.locator('.dialog .ff-stats').textContent();
    assert.match(text, /\d+ moves, best possible \d+|the best possible/);
    assert.match(text, /with a hint/);
    assert.ok((await page.locator('.dialog .stars i.on').count()) <= 2, 'a hint: two stars at most');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:fifteen:progress')));
    assert.equal(saved.unlocked, 2);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('15: a 4x4 level gets its tables from the server, and follows every move exactly', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const tables = [];
    page.on('request', (r) => r.url().includes('tables-4x4') && tables.push(r.url()));
    const base = `http://localhost:${server.address().port}/`;
    await page.goto(base);
    await page.evaluate(() => localStorage.setItem('pocket-arcade:fifteen:progress', JSON.stringify({ unlocked: 11, stars: {} })));
    await page.goto(`${base}#/fifteen/11`);
    await page.waitForFunction(() => window.__fifteen?.play?.w === 4);
    const t0 = Date.now();
    const first = await page.evaluate(() => window.__fifteen.coach().hint());
    assert.ok(Date.now() - t0 < 15000, 'the first hint in good time');
    assert.equal(tables.length, 1, 'the ready-made tables, downloaded');
    // Follow three hints: each one step nearer.
    let c = first;
    for (let k = 0; k < 3; k++) {
      await page.evaluate((cell) => window.__fifteen.play.slide(cell), c);
      c = await page.evaluate(() => window.__fifteen.coach().hint());
    }
    const ds = await page.evaluate(() => window.__fifteen.coach().ds);
    assert.equal(ds.length, 4);
    assert.deepEqual(ds.slice(1), [ds[0] - 1, ds[0] - 2, ds[0] - 3]);
    // One the wrong way: one further.
    const wrong = await page.evaluate((best) => {
      const p = window.__fifteen.play;
      const g = p.board.indexOf(0);
      const near = [g - 1, g + 1, g - 4, g + 4].filter((x) => x >= 0 && x < 16 && (x === g - 4 || x === g + 4 || Math.floor(x / 4) === Math.floor(g / 4)));
      return near.find((x) => x !== best);
    }, c);
    await page.evaluate((cell) => window.__fifteen.play.slide(cell), wrong);
    const after = await page.evaluate(() => window.__fifteen.coach().done());
    assert.equal(Math.abs(after[4] - after[3]), 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('15: choose the tiles -- for any level, mid-game too; a photo whose tiles look alike gets numbered', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/#/fifteen`);
    // The level page: the chooser, and each level's size.
    await page.locator('.ff-style[data-style="pic:wheel"]').click();
    assert.equal(await page.locator('.lvl[data-n="1"] .lvl-note').textContent(), '3×2');
    await page.locator('.lvl[data-n="1"]').click();
    await page.waitForFunction(() => window.__fifteen?.play);
    assert.equal(await page.evaluate(() => window.__fifteen.play.style.key), 'pic:wheel');
    // Mid-game: the board stays, the tiles change.
    await page.evaluate(() => window.__fifteen.play.slide(window.__fifteen.play.board.indexOf(0) - 1));
    const board = await page.evaluate(() => window.__fifteen.play.board.join());
    await page.locator('[data-act=tiles]').click();
    await page.locator('.ff-sheet .ff-style[data-style="seq:clock"]').click();
    await page.waitForFunction(() => window.__fifteen.play.style.key === 'seq:clock');
    assert.equal(await page.evaluate(() => window.__fifteen.play.board.join()), board);
    // A photo all one colour: every tile alike, so numbered.
    const shot = await browser.newPage({ viewport: { width: 300, height: 200 } });
    await shot.setContent('<body style="margin:0;background:#3a7bd5"></body>');
    const png = await shot.screenshot();
    await shot.close();
    await page.locator('.ff-sheet .ff-add input').setInputFiles({ name: 'sky.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => window.__fifteen.play.style.kind === 'photo', null, { timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__fifteen.play.alike), true);
    assert.equal(await page.evaluate(() => window.__fifteen.play.labelled), true);
    // Remembered for the next level.
    await page.locator('[data-act=done]').click();
    assert.match(await page.evaluate(() => localStorage.getItem('pocket-arcade:fifteen:style')), /photo:/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('morse rain: letters to work on -- ranked, decaying after each ordinary game (not practice), listening and sending', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const base = `http://localhost:${server.address().port}/`;
    await page.goto(base);
    const weights = { K: 9, Q: 8, Y: 7, G: 6, W: 5, D: 4, R: 3, U: 2, S: 1 };
    await page.evaluate((w) => {
      localStorage.setItem('pocket-arcade:morse:trouble', JSON.stringify(w));
      localStorage.setItem('pocket-arcade:morse:progress', JSON.stringify({ unlocked: 12, stars: {} }));
    }, weights);
    await page.goto(`${base}#/morse`);
    assert.match(await page.locator('.mr-work-btn').textContent(), /K Q Y/);
    await page.locator('.mr-work-btn').click();
    await page.waitForFunction(() => location.hash === '#/morse/work');
    assert.equal(await page.locator('.mr-trouble li').count(), 9);
    assert.equal(await page.locator('.mr-trouble li.top').count(), 7);
    assert.match(await page.locator('.mr-practise').textContent(), /K Q Y G W D R/);
    // Practice: just those seven.
    await page.locator('.mr-practise').click();
    await page.waitForFunction(() => window.__morse?.spec.practice);
    const letters = await page.evaluate(() => window.__morse.tiles.map((t) => t.ch));
    assert.ok(letters.every((ch) => 'KQYGWDR'.includes(ch)), letters.join(''));
    await page.locator('[data-act=start]').click();
    // Play it through: find each at once.
    await page.evaluate(async () => {
      const p = window.__morse;
      p.timeScale = 4;
      for (let k = 0; k < 600 && !p.over; k++) {
        await new Promise((r) => setTimeout(r, 50));
        const t = p.target && p.tiles.find((x) => x.ch === p.target);
        if (t) p.answer(t);
      }
    });
    await page.locator('.dialog:not([hidden]) [data-act=work]').waitFor({ timeout: 20000 });
    assert.match(await page.locator('.dialog h3').textContent(), /Practice done/);
    // Practice changes nothing: it only drills the hardest.
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:morse:trouble'))), weights);
    assert.equal(await page.evaluate(() => localStorage.getItem('pocket-arcade:morse:listen-stats')), null);
    // An ordinary level does: every old weight fades by 0.9 (found at once:
    // no new points).
    await page.goto(`${base}#/morse/1`);
    await page.waitForFunction(() => window.__morse?.spec.n === 1);
    await page.locator('[data-act=start]').click();
    await page.evaluate(async () => {
      const p = window.__morse;
      p.timeScale = 4;
      for (let k = 0; k < 600 && !p.over; k++) {
        await new Promise((r) => setTimeout(r, 50));
        const t = p.target && p.tiles.find((x) => x.ch === p.target);
        if (t) p.answer(t);
      }
    });
    await page.locator('.dialog:not([hidden]) .stars').waitFor({ timeout: 20000 });
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:morse:trouble')));
    for (const [ch, w] of Object.entries(weights)) assert.ok(Math.abs(after[ch] - w * 0.9) < 0.01, `${ch}: ${after[ch]}`);
    const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:morse:listen-stats')));
    assert.equal(stats.games, 1);
    // Sending has its own list, and its own practice.
    await page.evaluate(() => localStorage.setItem('pocket-arcade:morse:send-trouble', JSON.stringify({ X: 6, Z: 5, B: 4 })));
    await page.goto(`${base}#/morse/send`);
    assert.match(await page.locator('.mr-work-btn').textContent(), /X Z B/);
    await page.locator('.mr-work-btn').click();
    await page.waitForFunction(() => location.hash === '#/morse/send/work');
    assert.match(await page.locator('.levels-intro').first().textContent(), /reached the ground/);
    await page.locator('.mr-practise').click();
    await page.waitForFunction(() => window.__morseSend?.spec.practice);
    assert.ok((await page.evaluate(() => window.__morseSend.queue.concat(window.__morseSend.tiles.map((t) => t.ch)))).every((ch) => 'XZB'.includes(ch)));
    // No unlocking from practice.
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:morse:progress')).unlocked), 12);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('jigsaw: patterns from the shared library -- each a puzzle, the same again when resumed', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/#/jigsaw`);
    await page.locator('.jg-sizes button[data-n="24"]').click();
    const tiles = page.locator('[data-list=patterns] .jg-tile');
    await tiles.first().waitFor();
    assert.equal(await tiles.count(), 9);
    await page.locator('[data-list=patterns] [data-pattern=wheel]').click();
    await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.pieces.length > 0, null, { timeout: 20000 });
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:jigsaw:current') || 'null'));
    // Back to the menu (saved), and resume: the same pattern, drawn again.
    await page.locator('[data-act=menu]').click();
    const first = await saved();
    assert.match(first.id, /^pattern:wheel:\d+$/);
    await page.locator('.jg-continue button').click();
    await page.waitForFunction(() => window.__jigsaw && window.__jigsaw.pieces.length > 0, null, { timeout: 20000 });
    await page.locator('[data-act=menu]').click();
    assert.equal((await saved()).id, first.id);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('elevator operator: tap a shaft to send a lift, deliver everyone, scored against the dispatcher', { skip: !chromium, timeout: 90000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=elevator]').click();
    await page.locator('.lvl[data-n="1"]').click();
    await page.locator('[data-act=start]').click();
    await page.waitForFunction(() => window.__elevator && !window.__elevator.paused);

    // The first day has one lift. Tap its shaft at the 5th floor: that's where it goes.
    const box = await page.locator('canvas').boundingBox();
    const at = await page.evaluate(() => {
      const t = window.__elevator.towers[0];
      return { x: t.ox + t.shaftX[0] + t.shaftW / 2, y: t.rowY(5) + t.rowH / 2, lifts: t.sim.cars.length };
    });
    assert.equal(at.lifts, 1);
    await page.touchscreen.tap(box.x + at.x, box.y + at.y);
    assert.equal(await page.evaluate(() => window.__elevator.sim.cars[0].target), 5);
    await page.waitForFunction(() => window.__elevator.sim.cars[0].pos > 1.5);

    // Pause holds the clock.
    await page.locator('[data-act=pause]').click();
    const t0 = await page.evaluate(() => window.__elevator.sim.t);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__elevator.sim.t), t0);
    await page.locator('.pause-card').click();

    // Someone walks in from their office, presses the button and waits.
    await page.evaluate(() => (window.__elevator.timeScale = 8));
    await page.waitForFunction(() => [...window.__elevator.towers[0].people.values()].some((v) => v.mode === 'wait'), null, { timeout: 30000 });

    // Swipe the lift toward them (up or down its shaft): it's off to the
    // first floor that way where someone's waiting.
    await page.evaluate(() => (window.__elevator.timeScale = 1));
    await page.waitForFunction(() => {
      const p = window.__elevator;
      const car = p.sim.cars[0];
      return car.phase !== 'moving' && p.sim.waiting.some((w, f) => w.length && f !== p.sim.floorOf(car));
    }, null, { timeout: 30000 });
    const sw = await page.evaluate(() => {
      const p = window.__elevator;
      const t = p.towers[0];
      const car = p.sim.cars[0];
      const here = p.sim.floorOf(car);
      const f = p.sim.waiting.findIndex((w, g) => w.length && g !== here);
      return { x: t.ox + t.shaftX[0] + t.shaftW / 2, y: t.rowY(here) + t.rowH / 2, dir: Math.sign(f - here) };
    });
    await page.mouse.move(box.x + sw.x, box.y + sw.y);
    await page.mouse.down();
    await page.mouse.move(box.x + sw.x, box.y + sw.y - sw.dir * 60, { steps: 6 });
    await page.mouse.up();
    const went = await page.evaluate(() => {
      const p = window.__elevator;
      const car = p.sim.cars[0];
      return { target: car.target, here: p.sim.floorOf(car), waiting: car.target !== null && p.sim.waiting[car.target].length > 0 };
    });
    assert.ok(went.target !== null && Math.sign(went.target - went.here) === sw.dir && went.waiting, JSON.stringify({ went, sw }));

    // Run the rest fast, sending the lifts the way a player would (one stop
    // at a time, by hand rather than on autopilot), until everyone's there.
    await page.evaluate(async () => {
      const m = await import('/games/elevator/engine.js');
      const p = window.__elevator;
      p.timeScale = 30;
      window.__drive = setInterval(() => m.dispatch(p.sim), 20);
    });
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 40000 });
    await page.evaluate(() => clearInterval(window.__drive));
    const text = await page.locator('.dialog').innerText();
    assert.match(text, /Average trip\s+\d+ s\s+\d+ s/);
    assert.match(text, /Median trip/);
    assert.match(text, /RMS trip\s+\d+ s\s+\d+ s/);
    assert.match(text, /RMS trip over yours: \d+%/);
    assert.ok(await page.locator('.dialog .el-hist rect').count(), 'a histogram of trip times');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:elevator:progress')));
    assert.equal(saved.unlocked, 2);

    // Watch the dispatcher run the same level.
    await page.locator('[data-act=watch]').click();
    assert.ok(await page.evaluate(() => !!window.__elevator.autopilot));
    await page.evaluate(() => (window.__elevator.timeScale = 40));
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 40000 });
    assert.match(await page.locator('.dialog h3').textContent(), /computer/i);

    // Level 17: two towers, apartments and offices, four lifts.
    await page.evaluate(() => localStorage.setItem('pocket-arcade:elevator:progress', JSON.stringify({ unlocked: 17, stars: {} })));
    await page.goto(`http://localhost:${server.address().port}/#/elevator/17`);
    await page.reload();
    await page.locator('[data-act=start]').click();
    await page.waitForFunction(() => window.__elevator && window.__elevator.towers.length === 2 && !window.__elevator.paused);
    const twin = await page.evaluate(() => {
      const t = window.__elevator.towers[1];
      return { x: t.ox + t.shaftX[0] + t.shaftW / 2, y: t.oy + t.rowY(4) + t.rowH / 2, types: window.__elevator.towers.map((q) => q.B.type) };
    });
    assert.deepEqual(twin.types, ['residential', 'office']);
    await page.touchscreen.tap(box.x + twin.x, box.y + twin.y);
    assert.equal(await page.evaluate(() => window.__elevator.day.sims[1].cars[0].target), 4, 'the office tower\'s lift A');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('trial bike: gas and lean with two thumbs, a crash and the tap that goes again, the finish scored against par', { skip: !chromium, timeout: 120000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    // (Credited to whoever contributed it, on its card and its course list.)
    assert.equal(await page.locator('[data-game=trial-bike] .credit-link').getAttribute('data-href'), 'https://github.com/garnett-ui');
    await page.locator('[data-game=trial-bike] .card-title').click();
    assert.match(await page.locator('.levels-credit').textContent(), /Contributed by Garnett Callis/);
    assert.equal(await page.locator('.levels-credit a').getAttribute('href'), 'https://github.com/garnett-ui');
    await page.locator('.lvl[data-n="1"]').click();
    // (The course is test-ridden in a worker first.)
    await page.waitForFunction(() => window.__trialBike, null, { timeout: 30000 });
    const level = await page.evaluate(() => ({ par: window.__trialBike.level.par, checked: window.__trialBike.level.checked, flags: window.__trialBike.level.flags.length }));
    assert.ok(level.checked && level.par > 5, `course 1 was ridden by the computer (par ${level.par})`);

    // Right thumb holds GAS while the left thumb drags back: the bike moves
    // off, nose up. Real multi-touch, through the browser's touch input.
    const gas = await page.locator('.tb-gas').boundingBox();
    const lean = await page.locator('.tb-lean').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const g = { x: gas.x + gas.width / 2, y: gas.y + gas.height / 2, id: 1 };
    const l = { x: lean.x + lean.width / 2, y: lean.y + lean.height / 2, id: 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [g] });
    await page.waitForFunction(() => window.__trialBike.B.vx > 2);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [g, l] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [g, { ...l, x: l.x - i * 14 }] });
    }
    const held = await page.evaluate(() => ({ ...window.__trialBike.input }));
    assert.equal(held.gas, true);
    assert.ok(held.lean > 0.5, `leaning back (${held.lean})`);
    await page.waitForFunction(() => window.__trialBike.B.angle > 0.2 && window.__trialBike.B.front === null, null, { timeout: 5000 });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => !window.__trialBike.input.gas && window.__trialBike.input.lean === 0);

    // Pause: the bike holds still until you tap to carry on.
    await page.locator('[data-act=pause]').click();
    const x0 = await page.evaluate(() => window.__trialBike.B.x);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => window.__trialBike.B.x), x0, 'frozen while paused');
    assert.ok(await page.locator('.tb-paused:not([hidden])').count());
    await page.locator('.tb-paused').click();
    assert.equal(await page.evaluate(() => window.__trialBike.paused), false);

    // Tip it onto its helmet: a crash. The clock keeps running, the first
    // touch on the stage goes again from the start (no flag passed yet).
    await page.evaluate(() => {
      const p = window.__trialBike;
      p.B.angle = Math.PI;
      p.B.y += 2;
    });
    await page.waitForFunction(() => window.__trialBike.waiting, null, { timeout: 10000 });
    const crashed = await page.evaluate(() => ({ crashes: window.__trialBike.crashes, msg: window.__trialBike.message?.text, time: window.__trialBike.time }));
    assert.equal(crashed.crashes, 1);
    assert.match(crashed.msg, /HANDLEBARS/);
    assert.ok(await page.locator('.tb-showme:not([hidden])').count(), 'offered a demo');
    await page.locator('.stage').dispatchEvent('pointerdown');
    const again = await page.evaluate(() => ({ waiting: window.__trialBike.waiting, x: window.__trialBike.B.x, time: window.__trialBike.time, crashed: window.__trialBike.B.crashed }));
    assert.ok(!again.waiting && !again.crashed && again.x < 6 && again.time >= crashed.time, JSON.stringify(again));

    // Let the computer rider ride the rest, fast-forwarded: the finish card
    // scores against par, notes the crash, and saves progress and the time.
    await page.evaluate(async () => {
      const m = await import('/games/trial-bike/engine.js');
      const p = window.__trialBike;
      p.timeScale = 6;
      p.pilot = (level, B) => m.rider(level, B, level.pace);
    });
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 60000 });
    assert.match(await page.locator('.dialog h3').textContent(), /Made it|Over the line|Clean ride/);
    assert.match(await page.locator('.dialog p').textContent(), /par .*1 crash/s);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:trial-bike:progress')));
    assert.equal(saved.unlocked, 2);
    assert.ok(saved.stars['1'] >= 1 && saved.stars['1'] <= 2, 'one crash caps it at two stars');
    assert.ok(saved.times['1'] > 5, 'best time saved');

    // Ride again, crash, and ask to be shown: the computer rider does the
    // course (fast-forwarded here), and that doesn't count toward progress.
    await page.evaluate(() => (window.__trialBike.pilot = null));
    await page.locator('[data-act=replay]').click();
    await page.evaluate(() => {
      const p = window.__trialBike;
      p.B.angle = Math.PI;
      p.B.y += 2;
    });
    await page.waitForFunction(() => window.__trialBike.waiting, null, { timeout: 10000 });
    await page.locator('.tb-showme').dispatchEvent('pointerdown');
    assert.ok(await page.evaluate(() => window.__trialBike.demo));
    assert.ok(await page.locator('.tb-demo:not([hidden])').count());
    await page.evaluate(() => (window.__trialBike.timeScale = 6));
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 60000 });
    assert.match(await page.locator('.dialog h3').textContent(), /how it/);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:trial-bike:progress')));
    assert.deepEqual(after, saved);
    await page.locator('[data-act=retry]').click();
    assert.equal(await page.evaluate(() => window.__trialBike.demo), false);
    // The course grid shows the best time under course 1.
    await page.locator('[data-act=levels]').click();
    assert.match(await page.locator('.lvl[data-n="1"] .lvl-note').textContent(), /\d+\.\d s/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('crystal cave: aim with a drag and fire, a roof cleared scored against par, and a cave-in', { skip: !chromium, timeout: 120000 }, async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/`);
    await page.locator('[data-game=crystal-cave] .card-title').click();
    // The level list first.
    await page.locator('.lvl[data-n="1"]').waitFor();
    assert.equal(await page.locator('.lvl').first().getAttribute('data-n'), '1');
    await page.locator('.lvl[data-n="1"]').click();
    // (The roof is cleared by the computer miner in a worker first.)
    await page.waitForFunction(() => window.__crystalCave, null, { timeout: 30000 });
    const level = await page.evaluate(() => ({ n: window.__crystalCave.level.n, par: window.__crystalCave.level.par, checked: window.__crystalCave.level.checked }));
    assert.equal(level.n, 1);
    assert.ok(level.checked && level.par > 0, `level 1 was cleared by the computer miner (par ${level.par})`);

    // The first touch only puts the tip away; then a thumb drags to the left
    // to aim, and lets go to fire. Real touch, through the browser's input.
    await page.touchscreen.tap(195, 500);
    assert.ok(await page.locator('.tip[hidden]').count(), 'the tip is put away');
    assert.equal(await page.evaluate(() => window.__crystalCave.game.shots), 0, 'the first touch fired nothing');
    assert.equal(await page.evaluate(() => window.__crystalCave.aim), 0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 500, id: 1 }] });
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195 - i * 15, y: 500, id: 1 }] });
    }
    const aim = await page.evaluate(() => window.__crystalCave.aim);
    assert.ok(aim < 0, `aimed to the left (${aim})`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.evaluate(() => window.__crystalCave.game.shots), 1, 'letting go fired');

    // A roof that falls to one shot: two of a colour, and a third fired
    // straight up beside them. All three shatter, and the roof is clear --
    // in two shots, under par: three stars.
    await page.waitForFunction(() => window.__crystalCave.ready, null, { timeout: 10000 });
    await page.evaluate(() => {
      const p = window.__crystalCave;
      const row = (s) => [...s].map((ch) => (ch === '.' ? null : { kind: 'gem', colour: Number(ch) }));
      p.game.cells = [row('..00....')];
      p.shown = p.game.cells;
      p.game.loaded = { kind: 'gem', colour: 0 };
      p.game.next = { kind: 'gem', colour: 0 };
      p.game.cart = 10;
      p.fire(0);
    });
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 10000 });
    assert.equal(await page.evaluate(() => window.__crystalCave.outcome), 'cleared');
    assert.equal(await page.locator('.dialog h3').textContent(), 'Roof cleared!');
    assert.match(await page.locator('.dialog').innerText(), new RegExp(`2 shots.*${level.par - 2} under par`, 's'));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:crystal-cave:progress')));
    assert.ok(saved.unlocked >= 2);
    assert.equal(saved.stars['1'], 3);
    assert.equal(saved.shots['1'], 2);

    // On to level 2.
    await page.locator('[data-act=next]').click();
    await page.waitForFunction(() => window.__crystalCave?.level.n === 2, null, { timeout: 30000 });
    assert.match(page.url(), /#\/crystal-cave\/2$/);

    // A cave-in: the roof crept all but down to the line, and a crystal that
    // matches nothing sticks under it and crosses it.
    await page.evaluate(() => {
      const p = window.__crystalCave;
      const row = (s) => [...s].map((ch) => (ch === '.' ? null : { kind: 'gem', colour: Number(ch) }));
      p.game.cells = [row('...0....')];
      p.shown = p.game.cells;
      p.game.loaded = { kind: 'gem', colour: 1 };
      p.game.next = { kind: 'gem', colour: 1 };
      p.game.shift = 11;
      p.shift = 11;
      p.fire(0);
    });
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 10000 });
    assert.equal(await page.locator('.dialog h3').textContent(), 'Cave-in!');
    assert.equal(await page.evaluate(() => window.__crystalCave.outcome), 'cavein');
    assert.ok(await page.locator('.dialog [data-act=showme]').count(), 'offered a demo');
    await page.locator('.dialog [data-act=retry]').click();
    assert.ok(await page.locator('.dialog[hidden]').count());
    assert.equal(await page.evaluate(() => window.__crystalCave.game.shots), 0, 'a fresh go');

    // SHOW ME: the computer miner clears the roof (fast-forwarded here) in
    // par, and that doesn't count toward progress.
    await page.evaluate(() => {
      const p = window.__crystalCave;
      p.timeScale = 8;
      p.showMe();
    });
    await page.locator('.dialog:not([hidden])').waitFor({ timeout: 60000 });
    assert.equal(await page.locator('.dialog h3').textContent(), 'That’s how it’s done');
    const par2 = await page.evaluate(() => window.__crystalCave.level.par);
    assert.match(await page.locator('.dialog').innerText(), new RegExp(`cleared the roof in ${par2} shots`));
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('pocket-arcade:crystal-cave:progress')));
    assert.deepEqual(after, saved);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
