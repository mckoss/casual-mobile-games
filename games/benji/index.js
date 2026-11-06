// Benji's Town: the town, going on from day to day (no levels).
import { makeTown } from './town.js';
import { Play } from './play.js';
import { emojiURL } from './emoji.js';
import { RECORDED, clipFor } from './voice.js';
import { ICON, showDialog } from '../../js/lib/campaign.js';

export function mount(root, ctx, sub) {
  let play = null;
  let onResize = null;

  // Said out loud, for someone too little to read (with the sound on): in
  // a child's recorded voice, or -- for a line not recorded, or if the
  // recording won't play -- the phone's own. One line at a time: each waits
  // for the one before to finish (and one that's waited too long, now out of
  // date, is dropped).
  const STALE = 4000; // ms
  const queue = [];
  let hush = null;
  let speaking = false;
  const speak = (text, done) => {
    if (!window.speechSynthesis) return done();
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1.25;
      // (And if it never says it's finished, on after a while anyway.)
      const safety = setTimeout(done, 1500 + text.length * 90);
      u.onend = u.onerror = () => {
        clearTimeout(safety);
        done();
      };
      window.speechSynthesis.speak(u);
    } catch {
      // (No voice: just the pictures, then.)
      done();
    }
  };
  const next = () => {
    while (queue.length && performance.now() - queue[0].at > STALE) queue.shift();
    if (speaking || !queue.length) return;
    speaking = true;
    const { text, clip: own } = queue.shift();
    let over = false;
    const done = () => {
      if (over) return;
      over = true;
      hush = null;
      speaking = false;
      setTimeout(next, 150);
    };
    const url = own || clipFor(text);
    if (!url || !ctx.loadClip) {
      speak(text, done);
      return;
    }
    ctx.loadClip(url).then((clip) => {
      if (!clip) return speak(text, done);
      hush = ctx.playClip(url, 1);
      setTimeout(done, clip.duration * 1000);
    });
  };
  const say = (text) => {
    if (!text || !ctx.getSetting('sound')) return;
    // (Not the same thing twice in a row.)
    if (queue.some((q) => q.text === text)) return;
    queue.push({ text, at: performance.now() });
    next();
  };
  // Hooray: a cheer (the "yay" from the letter tracer), first in line.
  const YAY = new URL('./sounds/yay.mp3', import.meta.url).href;
  const cheer = () => {
    if (!ctx.getSetting('sound')) return;
    queue.unshift({ text: 'Yay!', clip: YAY, at: performance.now() });
    next();
  };
  const quiet = () => {
    queue.length = 0;
    hush?.();
    window.speechSynthesis?.cancel();
  };
  // (Loaded ahead, so the first line isn't late.)
  for (const text of RECORDED) ctx.loadClip?.(clipFor(text));
  ctx.loadClip?.(YAY);

  // (Away from the page -- the phone locked, say: the engine quiet. It
  // starts up again with the next frame drawn.)
  const hush2 = () => document.hidden && ctx.setLoop?.('motor', false);
  document.addEventListener('visibilitychange', hush2);

  function teardown() {
    quiet();
    if (play) play.destroy();
    ctx.setLoop?.('motor', false);
    play = null;
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = null;
  }

  // The day the town's on: kept from one visit to the next. (From the
  // levels it used to have: two levels a day.)
  const old = ctx.load('progress', null);
  let day = ctx.load('day', old?.unlocked > 1 ? Math.ceil((old.unlocked - 1) / 2) : 1);
  const PART = { dawn: '🌅', morning: '🌤️', midday: '☀️', evening: '🌇', night: '🌙' };
  // An emoji as its picture (some browsers have no emoji font).
  const pic = (ch) => `<img class="bt-emoji" src="${emojiURL(ch)}" alt="${ch}">`;
  // The switch shows what a tap does: a steering wheel (drive them
  // yourself), or the town from above (back to watching them go).
  const WHEEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/><path d="M3.3 10.6c3 1.2 5.6 1.4 6.3 1.4M20.7 10.6c-3 1.2-5.6 1.4-6.3 1.4M12 14.6V21"/></svg>';
  const TOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 13.5l9-4.5-9-4.5-9 4.5z"/><path d="M3 9v3.5l9 4.5 9-4.5V9"/><path d="M8.5 8.4V5.6l2.6-1.3 2.6 1.3v2.8" fill="currentColor" stroke-width="1.2"/><path d="M12 17v2.5"/></svg>';
  const switchIcon = () => (drive ? TOWN : WHEEL);
  // (No: a cross -- drawn, not the ✕ character, which some fonts lack.)
  const NO = '<svg class="bt-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const switchLabel = () => (drive ? 'Watch them go' : 'Drive them yourself');
  // Driving them yourself, or watching them go: yours to choose, and kept.
  let drive = ctx.load('drive', false);

  function showTown() {
    teardown();
    root.innerHTML = `
      <div class="screen play-screen bt-screen">
        <header class="bar">
          <button class="icon-btn" data-act="home" aria-label="Back">${ICON.back}</button>
          <h2>Day ${day} <span class="bt-part">${pic(PART.dawn)}</span></h2>
          <button class="icon-btn bt-drive" data-act="drive" aria-label="${switchLabel()}" aria-pressed="${drive}">${switchIcon()}</button>
          <button class="icon-btn" data-act="restart" aria-label="A new town">${ICON.restart}</button>
        </header>
        <div class="stage"><canvas class="board"></canvas></div>
        <div class="dialog" hidden></div>
      </div>`;
    ctx.track('level_start', { level: day });
    const title = root.querySelector('h2');
    play = new Play(root.querySelector('canvas'), makeTown(day), {
      sfx: ctx.sfx,
      haptic: ctx.haptic,
      say,
      cheer,
      // The engine you're driving: level 0 (ticking over) to 1, or null
      // for off.
      engine: (level) => {
        const on = level != null && !document.hidden;
        ctx.setLoop?.('motor', on);
        if (on) ctx.loopLevel?.('motor', level);
      },
      // A part of the day begins (or night falls): the picture in the title.
      onPart: (part) => {
        title.innerHTML = `Day ${day} <span class="bt-part">${pic(PART[part])}</span>`;
      },
      // A new morning: the next day, kept.
      onDay: (n) => {
        ctx.track('level_complete', { level: day, stars: 3 });
        day = n;
        ctx.save('day', day);
      },
    });
    play.drive = drive;
    // Handle for the end-to-end tests (test/e2e.test.mjs).
    window.__benji = play;
    // The car button: drive them yourself (lit), or watch them go.
    const car = root.querySelector('[data-act=drive]');
    car.onclick = () => {
      ctx.sfx('tap');
      drive = !drive;
      ctx.save('drive', drive);
      car.setAttribute('aria-pressed', String(drive));
      car.setAttribute('aria-label', switchLabel());
      car.innerHTML = switchIcon();
      // (On: into a driver's seat at once. Off: back out over the town.)
      play.setDrive(drive);
    };
    onResize = () => play?.resize();
    window.addEventListener('resize', onResize);
    root.querySelector('[data-act=home]').onclick = () => ctx.back('#/');
    // (For a grown-up: start again, with a new little town.)
    root.querySelector('[data-act=restart]').onclick = () => {
      ctx.sfx('tap');
      showDialog(root.querySelector('.dialog'), ctx, {
        title: 'A new town?',
        text: 'Back to day 1, with no houses built yet.',
        buttons: [
          { label: NO, act: 'keep', run: () => (root.querySelector('.dialog').hidden = true) },
          { label: ICON.restart.replace('<svg ', '<svg class="bt-btn-icon" '), act: 'new', primary: true, run: () => {
            day = 1;
            ctx.save('day', day);
            showTown();
          } },
        ],
      });
    };
  }

  function route() {
    showTown();
  }

  route(sub);
  return {
    route,
    destroy: () => {
      teardown();
      document.removeEventListener('visibilitychange', hush2);
    },
  };
}
