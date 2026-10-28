// Builds Crystal Cave levels off the main thread (the computer miner plays
// each one through, which takes a moment on a phone).
import { makeLevel } from './engine.js';

self.onmessage = (e) => {
  const { n } = e.data;
  self.postMessage({ n, level: makeLevel(n) });
};
