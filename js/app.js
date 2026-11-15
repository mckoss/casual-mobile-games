import { GAMES, COMING_SOON } from './games.js';
import { unlockAudio, wakeAudio, sfx, setLoop, loopLevel, stopLoops, loadClip, playClip, startMusic, stopMusic } from './lib/audio.js';
import { getSetting, setSetting, haptic } from './lib/settings.js';
import { load, save } from './lib/storage.js';
import { canPrompt, promptInstall, isIOS, isStandalone, onInstallChange } from './lib/install.js';
import { track, trackPage, startAnalytics } from './lib/analytics.js';
import { VERSION } from './version.js';

const view = document.getElementById('view');
let current = null; // { id, instance }
let stale = false; // a newer version took over in another window

// ------------------------------------------------------------------ routing

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { id: parts[0] || '', sub: parts.slice(1).join('/') };
}

export function navigate(hash, { replace = false } = {}) {
  if (replace) history.replaceState(history.state, '', hash);
  else history.pushState({ inApp: true }, '', hash);
  route();
}

// Go "up" a level: use the browser history when we came from there so the
// system back button stays in sync, otherwise jump straight to the parent.
export function back(parent) {
  if (history.state && history.state.inApp) history.back();
  else navigate(parent, { replace: true });
}

let lastPage = null;

// Ask the service worker to keep more of the app for offline: a game when
// it's opened, everything once you're browsing the arcade (or it's
// installed). (Someone sent a link to one game downloads just that one.)
function keepOffline(games) {
  navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: 'CACHE', games })).catch(() => {});
}

async function route() {
  const { id, sub } = parse();
  if (id !== lastPage) {
    lastPage = id;
    trackPage(id);
  }
  const game = GAMES.find((g) => g.id === id);
  keepOffline(!game || isStandalone() ? 'all' : [game.id]);
  if (!game) {
    unmount();
    // Back on the home screen after another window updated: load the new version now.
    if (stale) return location.reload();
    renderHub();
    renderUpdateBar();
    return;
  }
  if (current && current.id === id) {
    current.instance.route?.(sub);
    return;
  }
  unmount();
  view.innerHTML = '<div class="loading">Loading…</div>';
  const mod = await game.load();
  if (parse().id !== id) return; // navigated away while loading
  view.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'game-host';
  view.appendChild(host);
  current = { id, instance: mod.mount(host, ctxFor(game), sub) };
  renderUpdateBar();
}

function unmount() {
  if (current) current.instance.destroy?.();
  current = null;
}

function ctxFor(game) {
  return {
    sfx,
    setLoop,
    loopLevel,
    stopLoops,
    loadClip,
    playClip,
    startMusic,
    stopMusic,
    haptic,
    toast,
    navigate,
    back,
    load: (key, fallback) => load(`${game.id}:${key}`, fallback),
    save: (key, value) => save(`${game.id}:${key}`, value),
    getSetting,
    setSetting,
    track: (name, params = {}) => track(name, { game: game.id, ...params }),
  };
}

// --------------------------------------------------------------------- hub

const ICONS = {
  soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  buzzOn: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8M21 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  buzzOff: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2" opacity=".45"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// About box: what the app is, and every version's changes, newest first.
async function showAbout() {
  const { CHANGELOG } = await import('./changelog.js');
  const fmt = (t) => t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>');
  const box = document.createElement('div');
  box.className = 'about';
  box.innerHTML = `
    <div class="about-card" role="dialog" aria-label="About Pocket Arcade">
      <header>
        <img src="icons/icon.svg" alt="" width="40" height="40">
        <div><h3>Pocket Arcade</h3><small>Version ${VERSION} · MIT licence</small></div>
        <button class="icon-btn" data-act="close" aria-label="Close">✕</button>
      </header>
      <div class="about-body">
        <p>Casual games for your phone or tablet: no accounts, no ads, and they all work offline.
        Your progress and photos stay on this device.</p>
        <h4>What's new, version by version</h4>
        ${CHANGELOG.map((e) => `
          <section class="about-ver${e.v === VERSION ? ' current' : ''}">
            <h5>v${e.v}${e.v === VERSION ? ' <span>you have this</span>' : ''}</h5>
            <ul>${e.notes.map((n) => `<li>${fmt(n)}</li>`).join('')}</ul>
          </section>`).join('')}
      </div>
    </div>`;
  const close = () => box.remove();
  box.onclick = (e) => e.target === box && close();
  box.querySelector('[data-act=close]').onclick = close;
  document.body.appendChild(box);
}

function renderHub() {
  view.innerHTML = `
    <div class="hub">
      <header class="hub-head">
        <div class="brand">
          <img src="icons/icon.svg" alt="" width="44" height="44">
          <h1>Pocket Arcade</h1>
        </div>
        <div class="hub-tools">
          <button class="icon-btn" data-act="sound" aria-label="Sound"></button>
          <button class="icon-btn" data-act="haptics" aria-label="Vibration"></button>
        </div>
      </header>
      <div class="install-slot"></div>
      <section class="cards">
        ${GAMES.map((g) => `
          <button class="card" data-game="${g.id}" style="--accent:${g.color}">
            <canvas class="card-art" data-art="${g.id}"></canvas>
            <span class="card-body">
              <span class="card-title">${g.title}</span>
              <span class="card-blurb">${g.blurb}</span>
              ${g.credit ? `<span class="card-credit">Contributed by <span class="credit-link" role="link" tabindex="0" data-href="${g.credit.url}">${g.credit.name}</span></span>` : ''}
            </span>
            <span class="play-pill">Play</span>
          </button>`).join('')}
        ${COMING_SOON.map((c) => `
          <${c.href ? `a href="${c.href}" target="_blank" rel="noopener"` : 'div'} class="card soon">
            <span class="soon-emoji">${c.emoji}</span>
            <span class="card-body">
              <span class="card-title">${c.title}${c.href ? ' ↗' : ''}</span>
              <span class="card-blurb">${c.blurb}</span>
            </span>
          </${c.href ? 'a' : 'div'}>`).join('')}
      </section>
      <footer class="hub-foot">No accounts, no ads. Works offline.
        <button class="about-link" data-act="about">About · What's new</button>
        <button class="version" data-act="update" aria-label="Check for updates">v${VERSION} · Check for updates</button></footer>
    </div>`;

  view.querySelector('[data-act=about]').onclick = () => {
    sfx('tap');
    showAbout();
  };
  const paintTools = () => {
    view.querySelector('[data-act=sound]').innerHTML = getSetting('sound') ? ICONS.soundOn : ICONS.soundOff;
    view.querySelector('[data-act=haptics]').innerHTML = getSetting('haptics') ? ICONS.buzzOn : ICONS.buzzOff;
  };
  paintTools();
  view.querySelector('[data-act=update]').onclick = checkForUpdate;
  view.querySelector('[data-act=sound]').onclick = () => {
    setSetting('sound', !getSetting('sound'));
    paintTools();
    sfx('tap');
  };
  view.querySelector('[data-act=haptics]').onclick = () => {
    setSetting('haptics', !getSetting('haptics'));
    paintTools();
    haptic(30);
  };
  view.querySelectorAll('[data-game]').forEach((el) => {
    el.onclick = (e) => {
      // (The name of whoever contributed it: their page, not the game.)
      const credit = e.target.closest('[data-href]');
      if (credit) {
        window.open(credit.dataset.href, '_blank', 'noopener');
        return;
      }
      sfx('tap');
      navigate(`#/${el.dataset.game}`);
    };
  });
  for (const g of GAMES) {
    const canvas = view.querySelector(`[data-art="${g.id}"]`);
    g.art().then((m) => requestAnimationFrame(() => m.paint(canvas))).catch(() => {});
  }
  renderInstall();
}

function renderInstall() {
  const slot = view.querySelector('.install-slot');
  if (!slot) return;
  slot.innerHTML = '';
  if (isStandalone() || load('installDismissed', false)) return;
  let html = '';
  if (canPrompt()) {
    html = `<div class="install"><span>Install Pocket Arcade to play offline from your home screen.</span>
      <button class="btn primary" data-act="install">Install</button>
      <button class="x" data-act="dismiss" aria-label="Dismiss">×</button></div>`;
  } else if (isIOS()) {
    html = `<div class="install"><span>To play offline: tap <b>Share</b>
      <svg class="inline-ico" viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      then <b>Add to Home Screen</b>.</span>
      <button class="x" data-act="dismiss" aria-label="Dismiss">×</button></div>`;
  }
  slot.innerHTML = html;
  const inst = slot.querySelector('[data-act=install]');
  if (inst) inst.onclick = () => promptInstall().then(renderInstall);
  const dis = slot.querySelector('[data-act=dismiss]');
  if (dis) dis.onclick = () => {
    save('installDismissed', true);
    renderInstall();
  };
}
onInstallChange(() => {
  if (!current) renderInstall();
});

// ------------------------------------------------------------------- toast

let toastTimer = 0;
export function toast(msg, action) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.innerHTML = '';
  el.append(msg);
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = action.run;
    el.appendChild(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 15000 : 2600);
}

// ---------------------------------------------------------- service worker

let swReg = null;

// What we know about a newer version: null, 'downloading', 'ready' or
// 'applying'. The bar showing it lives on the home screen only, so it never
// covers a game; a download that finishes mid-game waits there for you.
const update = { state: null, version: null, done: 0, total: 0, later: false, applyWhenReady: false };

function setUpdate(patch) {
  Object.assign(update, patch);
  renderUpdateBar();
}

function renderUpdateBar() {
  let bar = document.querySelector('.update-bar');
  const show = !current && update.state && !(update.later && update.state === 'ready');
  if (!show) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
  }
  const v = update.version ? ` v${update.version}` : '';
  if (bar.dataset.state !== update.state) {
    bar.dataset.state = update.state;
    if (update.state === 'downloading') {
      bar.innerHTML = `<span><b class="dl-title"></b><small class="dl-count"></small>
        <i class="progress"><i class="progress-fill"></i></i></span>`;
    } else if (update.state === 'ready') {
      bar.innerHTML = `<span><b class="dl-title"></b><small>You have v${VERSION}.</small></span>
        <button class="later">Later</button>
        <button class="install-now"></button>`;
      bar.querySelector('.later').onclick = () => setUpdate({ later: true });
      bar.querySelector('.install-now').onclick = () => applyUpdate();
    } else {
      bar.innerHTML = '<span><b class="dl-title"></b><i class="progress"><i class="progress-fill busy"></i></i></span>';
    }
  }
  const title = bar.querySelector('.dl-title');
  if (update.state === 'downloading') {
    title.textContent = `Downloading update${v}…`;
    bar.querySelector('.dl-count').textContent = `You have v${VERSION} · ${update.total ? `${update.done} of ${update.total} files` : 'starting…'}`;
    bar.querySelector('.progress-fill').style.width = update.total ? `${Math.round((100 * update.done) / update.total)}%` : '4%';
  } else if (update.state === 'ready') {
    title.textContent = `Version${v ? ` ${update.version}` : ''} is ready`;
    bar.querySelector('.install-now').textContent = `Update to${v || ' new version'}`;
  } else {
    title.textContent = `Updating v${VERSION} → ${update.version ? `v${update.version}` : 'new version'}…`;
  }
}

// Switch to the newest downloaded version now. Always uses whichever version
// is waiting at this moment (a newer one may have replaced the one we first
// announced); if it's still downloading, it switches as soon as it's done.
function applyUpdate() {
  const w = swReg && swReg.waiting;
  if (!w) {
    setUpdate({ applyWhenReady: true, state: update.state || 'downloading' });
    return;
  }
  track('app_update', { from: VERSION, to: update.version || 'unknown' });
  setUpdate({ state: 'applying' });
  w.postMessage({ type: 'SKIP_WAITING' });
  // Normally the takeover reloads the page; if not, reload anyway.
  setTimeout(() => location.reload(), 4000);
}

// Tapping the version on the home screen checks for a new version right now.
async function checkForUpdate() {
  if (!swReg) return toast('Updates are checked when the app is installed or online.');
  if (swReg.waiting) {
    setUpdate({ later: false });
    return readyFrom(swReg.waiting);
  }
  if (!navigator.onLine) return toast("You're offline. Updates are checked when you're back online.");
  toast('Checking for updates…');
  try {
    await swReg.update();
  } catch {
    return toast("Couldn't reach the server. Try again in a moment.");
  }
  if (!swReg.installing && !swReg.waiting) toast(`You're up to date (v${VERSION}).`);
}

// Ask a waiting service worker which version it would install.
function versionOf(worker) {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1500);
    ch.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data);
    };
    worker.postMessage({ type: 'GET_VERSION', client: VERSION }, [ch.port2]);
  });
}

async function readyFrom(worker) {
  const version = await versionOf(worker);
  if (version === VERSION) return setUpdate({ state: null });
  if (update.applyWhenReady) {
    update.version = version || update.version;
    return applyUpdate();
  }
  setUpdate({ state: 'ready', version: version || update.version });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      // updateViaCache 'none': update checks always ask the server, including
      // for sw-manifest.js (GitHub Pages lets browsers cache files 10 min).
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
      swReg = reg;
      const isUpdate = () => !!navigator.serviceWorker.controller;
      // A version downloaded earlier waits for the player to tap Update on
      // the home screen: the app never switches versions by itself.
      if (reg.waiting && isUpdate()) readyFrom(reg.waiting);
      // Only updates get the bar; a first install just quietly goes offline-ready.
      const watch = (w) => {
        if (!w || !isUpdate()) return;
        if (update.state !== 'applying') setUpdate({ state: 'downloading', later: false });
        w.addEventListener('statechange', () => {
          if (w.state === 'installed') readyFrom(w);
          // Download failed (e.g. connection lost): try again on the next check.
          if (w.state === 'redundant' && update.state === 'downloading' && !reg.installing && !reg.waiting) {
            setUpdate({ state: null });
          }
        });
      };
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'UPDATE_PROGRESS' && isUpdate() && e.data.version !== VERSION && update.state !== 'applying') {
          setUpdate({ state: 'downloading', version: e.data.version, done: e.data.done, total: e.data.total });
        }
      });
      watch(reg.installing);
      reg.addEventListener('updatefound', () => watch(reg.installing));
      // Installed apps can stay open for days: look for new versions when the
      // app comes back to the foreground, and hourly while it's open.
      const check = () => navigator.onLine && reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      window.addEventListener('online', check);
      setInterval(check, 60 * 60 * 1000);
      // Reload into the new version once it takes over after Update was
      // tapped. (Not for a brand-new install's first worker. And if another
      // window did the updating, wait until this one is back on the home
      // screen rather than interrupt a game.)
      let firstControl = !navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (firstControl) {
          firstControl = false;
          return;
        }
        if (update.state === 'applying' || !current) location.reload();
        else stale = true;
      });
    } catch (err) {
      console.warn('Service worker registration failed', err);
    }
  });
}

// --------------------------------------------------------------------- boot

// Audio may only start after a user gesture on mobile. (On an iPhone the
// press itself may not count -- the lift of the finger, or the click, does:
// so all of them, each a no-op once the sound is on.)
for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, unlockAudio, { capture: true });
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wakeAudio());
window.addEventListener('popstate', route);
startAnalytics();
// Stop iOS from rubber-band scrolling / double-tap zooming the app.
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
route();
