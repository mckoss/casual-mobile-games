// Benji's Town: the town, going on from day to day (no levels).
import { makeTown } from './town.js';
import { Play } from './play.js';
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
    const { text } = queue.shift();
    let over = false;
    const done = () => {
      if (over) return;
      over = true;
      hush = null;
      speaking = false;
      setTimeout(next, 150);
    };
    const url = clipFor(text);
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
  const quiet = () => {
    queue.length = 0;
    hush?.();
    window.speechSynthesis?.cancel();
  };
  // (Loaded ahead, so the first line isn't late.)
  for (const text of RECORDED) ctx.loadClip?.(clipFor(text));

  function teardown() {
    quiet();
    if (play) play.destroy();
    play = null;
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = null;
  }

  // The day the town's on: kept from one visit to the next. (From the
  // levels it used to have: two levels a day.)
  const old = ctx.load('progress', null);
  let day = ctx.load('day', old?.unlocked > 1 ? Math.ceil((old.unlocked - 1) / 2) : 1);
  const PART = { dawn: '🌅', morning: '🌤️', midday: '☀️', evening: '🌇', night: '🌙' };
  // Driving them yourself, or watching them go: yours to choose, and kept.
  let drive = ctx.load('drive', false);

  function showTown() {
    teardown();
    root.innerHTML = `
      <div class="screen play-screen bt-screen">
        <header class="bar">
          <button class="icon-btn" data-act="home" aria-label="Back">${ICON.back}</button>
          <h2>Day ${day} <span class="bt-part">🌅</span></h2>
          <button class="icon-btn bt-drive" data-act="drive" aria-label="Drive them yourself" aria-pressed="${drive}">🚗</button>
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
      // A part of the day begins (or night falls): the picture in the title.
      onPart: (part) => {
        title.innerHTML = `Day ${day} <span class="bt-part">${PART[part]}</span>`;
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
      play.drive = drive;
      if (!drive && play.fp) play.leave();
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
          { label: '✕', act: 'keep', run: () => (root.querySelector('.dialog').hidden = true) },
          { label: '↻', act: 'new', primary: true, run: () => {
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
  return { route, destroy: teardown };
}
