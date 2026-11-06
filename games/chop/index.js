// The Chopping Game: one block of ice after another, each with a surprise
// frozen inside (no levels to choose: on from the last one). Made for
// little ones -- nothing to read: tap the ice, and once the surprise is
// out, the big green button brings the next block.
import { level } from './model.js';
import { Play } from './play.js';
import { ICON } from '../../js/lib/campaign.js';

// The cheer: Benji's Town's "yay" (from the letter tracer).
const YAY = new URL('../benji/sounds/yay.mp3', import.meta.url).href;

const NEXT = '<svg viewBox="0 0 24 24"><path d="M8 4l9 8-9 8z" fill="currentColor"/></svg>';

export function mount(root, ctx) {
  let play = null;
  let onResize = null;
  let n = ctx.load('level', 1);
  // The surprises found so far (their emoji), shown along the top.
  let found = ctx.load('found', []);
  ctx.loadClip?.(YAY); // (ahead, so the cheer isn't late)
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  // The surprise's name, said out loud (with the sound on).
  const say = (text) => {
    if (!ctx.getSetting('sound') || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1.2;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      // (No voice: just the picture, then.)
    }
  };

  function teardown() {
    timers.forEach(clearTimeout);
    timers = [];
    if (play) play.destroy();
    play = null;
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = null;
  }

  function show() {
    teardown();
    root.innerHTML = `
      <div class="screen play-screen ch-screen">
        <header class="bar">
          <button class="icon-btn" data-act="home" aria-label="Home">${ICON.back}</button>
          <h2>The Chopping Game</h2>
          <span class="pill">${found.length}</span>
        </header>
        <div class="stage"><canvas class="board"></canvas>
          <button class="ch-next" data-act="next" aria-label="Next block" hidden>${NEXT}</button>
        </div>
      </div>`;
    ctx.track('level_start', { level: n });
    const next = root.querySelector('[data-act=next]');
    play = new Play(root.querySelector('canvas'), level(n), {
      sfx: ctx.sfx,
      haptic: ctx.haptic,
      onFree: (s) => {
        ctx.track('level_complete', { level: n, stars: 3 });
        found = [...found, s.emoji].slice(-60);
        n += 1;
        ctx.save('level', n);
        ctx.save('found', found);
        root.querySelector('.pill').textContent = String(found.length);
        // A cheer over the ice tinkling down -- yay! -- and then what it is.
        const name = () => say(`${s.name}!`);
        if (!ctx.getSetting('sound') || !ctx.loadClip) later(350, name);
        else {
          const me = play;
          ctx.loadClip(YAY).then((clip) => {
            if (play !== me) return; // (on to the next block already)
            if (!clip) return later(350, name);
            later(300, () => ctx.playClip(YAY, 1));
            later(300 + clip.duration * 1000 + 150, name);
          });
        }
        // (The button only once it does something -- and not so soon that a
        // tap still chopping presses it.)
        setTimeout(() => {
          if (play?.freedAt !== null) next.hidden = false;
        }, 1200);
      },
    }, found);
    // Handle for the end-to-end tests (test/e2e.test.mjs).
    window.__chop = play;
    onResize = () => play?.resize();
    window.addEventListener('resize', onResize);
    root.querySelector('[data-act=home]').onclick = () => ctx.back('#/');
    next.onclick = () => {
      ctx.sfx('tap');
      show();
    };
  }

  function route() {
    show();
  }

  route();
  return { route, destroy: teardown };
}
