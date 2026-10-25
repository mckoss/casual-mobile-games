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
  // recording won't play -- the phone's own.
  let hush = null;
  const speak = (text) => {
    if (!window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1.25;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      // (No voice: just the pictures, then.)
    }
  };
  const say = (text) => {
    if (!ctx.getSetting('sound')) return;
    hush?.();
    hush = null;
    const url = clipFor(text);
    if (!url || !ctx.loadClip) {
      speak(text);
      return;
    }
    ctx.loadClip(url).then((clip) => {
      if (clip) hush = ctx.playClip(url, 1);
      else speak(text);
    });
  };
  // (Loaded ahead, so the first line isn't late.)
  for (const text of RECORDED) ctx.loadClip?.(clipFor(text));

  function teardown() {
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

  function showTown() {
    teardown();
    root.innerHTML = `
      <div class="screen play-screen bt-screen">
        <header class="bar">
          <button class="icon-btn" data-act="home" aria-label="Back">${ICON.back}</button>
          <h2>Day ${day} <span class="bt-part">🌅</span></h2>
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
    // Handle for the end-to-end tests (test/e2e.test.mjs).
    window.__benji = play;
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
