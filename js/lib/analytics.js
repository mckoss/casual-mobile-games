// Umami analytics (stats.mckoss.com) that copes with being offline.
//
// index.html includes the shared mckoss.com loader (https://mckoss.com/js/mk.js),
// which loads the Umami tracker for known hostnames and defines window.umami.
// Events are written to a small queue in localStorage first, and sent through
// window.umami whenever it's there; events recorded while offline go out on
// the next connection, tagged with how long ago they happened
// (queued_minutes). Nothing is sent from localhost (dev and tests), and the
// loader itself ignores hosts it doesn't know.
import { load, save } from './storage.js';

const LOADER = 'https://mckoss.com/js/mk.js';
const QUEUE_KEY = 'analytics-queue';
const MAX_QUEUE = 300;

// Off in development; the tests switch it on with a storage flag.
const enabled = (!/^(localhost|127\.|\[::1\])/.test(location.hostname) && location.protocol === 'https:') ||
  load('analytics-test', false);
let waiting = null;
let firstPage = true;

const umami = () => (typeof window.umami?.track === 'function' ? window.umami : null);

// The tracker loads (deferred) after the app starts: check for it for a while.
function whenReady() {
  if (waiting || !enabled) return;
  let tries = 0;
  waiting = setInterval(() => {
    if (umami() || ++tries > 60) {
      clearInterval(waiting);
      waiting = null;
      flush();
    }
  }, 500);
}

// Opened offline, the loader in index.html couldn't load: try again once
// there's a connection.
function reload() {
  if (!enabled || umami() || !navigator.onLine) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = LOADER;
  s.onerror = () => s.remove();
  document.head.appendChild(s);
  whenReady();
}

function flush() {
  const tracker = umami();
  if (!tracker || !navigator.onLine) return;
  const queue = load(QUEUE_KEY, []);
  if (!queue.length) return;
  save(QUEUE_KEY, []);
  const now = Date.now();
  for (const { name, params, t } of queue) {
    const minutes = Math.round((now - t) / 60000);
    if (name === 'page_view') {
      tracker.track((props) => ({ ...props, url: params.url, title: params.title }));
    } else {
      tracker.track(name, { ...params, ...(minutes > 1 ? { queued_minutes: minutes } : {}) });
    }
  }
}

export function track(name, params = {}) {
  if (!enabled) return;
  const queue = load(QUEUE_KEY, []);
  queue.push({ name, params, t: Date.now() });
  save(QUEUE_KEY, queue.slice(-MAX_QUEUE));
  if (umami()) flush();
  else whenReady();
}

// Hash routes (#/car-jam/12) become page paths (/car-jam). The page the app
// opens on is counted by Umami itself when it loads online, so only later
// pages (and every page while offline) are sent from here.
export function trackPage(id) {
  const first = firstPage;
  firstPage = false;
  if (first && navigator.onLine) return;
  const base = location.pathname.replace(/index\.html$/, '');
  track('page_view', {
    title: id ? `Pocket Arcade: ${id}` : 'Pocket Arcade',
    url: `${location.origin}${base}${id || ''}`,
  });
}

export function startAnalytics() {
  if (!enabled) return;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  track('app_open', { display_mode: standalone ? 'installed' : 'browser', online: navigator.onLine });
  window.addEventListener('online', () => (umami() ? flush() : reload()));
  window.addEventListener('appinstalled', () => track('app_installed'));
}
