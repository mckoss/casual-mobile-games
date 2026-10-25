// Synthesised sound effects (Web Audio), so the app ships no audio files and
// works offline. The context is created on the first user gesture, as mobile
// browsers require.
import { getSetting } from './settings.js';

let ac = null;
let master = null;
let noise = null;

export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.6;
    master.connect(ac.destination);
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
}

function tone(type, f0, f1, dur, vol, at = 0, filter = 0) {
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    o.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function thump(vol, dur, cutoff, at = 0) {
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur);
}

const SFX = {
  tap: () => tone('sine', 660, 880, 0.08, 0.15),
  // (Pitched high enough for phone speakers, which can't play deep bass.)
  vroom: () => {
    tone('sawtooth', 130, 290, 0.3, 0.09, 0, 1700);
    tone('square', 65, 145, 0.3, 0.04, 0, 900);
  },
  bump: () => {
    thump(0.7, 0.12, 2200);
    tone('square', 300, 150, 0.12, 0.07, 0, 1600);
    tone('triangle', 620, 300, 0.07, 0.08);
  },
  // Leaves: a short rustle and a soft thud.
  hedge: () => {
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3200;
    f.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t, Math.random());
    src.stop(t + 0.35);
    thump(0.4, 0.1, 1200);
  },
  // A granny's indignant "Hey!"
  granny: () => {
    tone('sawtooth', 820, 1020, 0.09, 0.06, 0.05, 2600);
    tone('sawtooth', 1020, 640, 0.22, 0.07, 0.14, 2600);
  },
  honk: () => {
    tone('square', 370, 370, 0.22, 0.06, 0, 1800);
    tone('square', 466, 466, 0.22, 0.06, 0, 1800);
    tone('square', 370, 370, 0.18, 0.06, 0.27, 1800);
    tone('square', 466, 466, 0.18, 0.06, 0.27, 1800);
  },
  pop: () => tone('sine', 500, 1100, 0.12, 0.1),
  whoosh: () => {
    thump(0.25, 0.22, 2400);
    tone('sine', 420, 980, 0.18, 0.12);
  },
  lose: () => [392, 330, 262].forEach((f, k) => tone('triangle', f, f * 0.97, 0.3, 0.18, k * 0.16)),
  // Breakout: arcade-style square-wave blips.
  wall: () => tone('square', 480, 480, 0.045, 0.07, 0, 3000),
  paddle: () => tone('square', 240, 236, 0.07, 0.1, 0, 2400),
  // Higher rows ring higher, like the 1976 original. row: 0 (bottom) and up.
  brick: (row = 0) => tone('square', 520 + row * 70, 520 + row * 70, 0.06, 0.08, 0, 3500),
  steel: () => tone('square', 900, 880, 0.03, 0.06, 0, 4000),
  miss: () => tone('sawtooth', 440, 70, 0.6, 0.12, 0, 1200),
  // Lunar Lander
  explode: () => {
    thump(0.9, 1.6, 700);
    thump(0.5, 0.5, 3000);
    tone('sine', 110, 28, 1.4, 0.5);
  },
  alarm: () => {
    tone('square', 1046, 1046, 0.09, 0.05, 0, 3000);
    tone('square', 1046, 1046, 0.09, 0.05, 0.14, 3000);
  },
  contact: () => tone('sine', 1320, 1320, 0.12, 0.08),
  // Jigsaw: a piece clicking into place.
  snap: () => {
    thump(0.25, 0.05, 2500);
    tone('triangle', 880, 1320, 0.08, 0.12);
  },
  star: () => tone('triangle', 880, 1320, 0.25, 0.2),
  win: () => [523, 659, 784, 1047].forEach((f, k) => tone('triangle', f, f, 0.3, 0.2, k * 0.11)),
  // Night Driver
  crash: () => {
    thump(1, 0.9, 1800);
    thump(0.6, 0.35, 5000);
    tone('sawtooth', 160, 40, 0.6, 0.18, 0, 900);
  },
  screech: () => {
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    f.Q.value = 6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + 0.7);
  },
  splash: () => {
    thump(0.7, 1.2, 1200);
    thump(0.3, 0.8, 6000);
  },
  // Water Lab: water glugging from one glass into another, and a glass clink.
  pour: (dur = 0.8) => {
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 3;
    // Glugs: the pitch wobbles, rising as the glass fills.
    f.frequency.setValueAtTime(500, t);
    for (let k = 0, x = t; x < t + dur; k++, x += 0.11) f.frequency.setValueAtTime(500 + 500 * ((x - t) / dur) + (k % 2) * 260, x);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.06);
    g.gain.setValueAtTime(0.5, t + Math.max(0.07, dur - 0.12));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  },
  clink: () => {
    tone('sine', 2650, 2650, 0.25, 0.06);
    tone('sine', 3980, 3980, 0.18, 0.035);
  },
  // Benji's Town: a recycling bin tipped into the truck -- cans tumbling
  // in, one after another (a tin's clatter: short, not quite in tune), and
  // the rustle of paper going in with them.
  cans: () => {
    [0, 0.07, 0.13, 0.22, 0.3, 0.41, 0.5].forEach((at, k) => {
      const f = 1350 + ((k * 437) % 900);
      tone('triangle', f, f * 0.96, 0.07, 0.05, at);
      tone('sine', f * 2.37, f * 2.3, 0.05, 0.025, at);
    });
    for (const at of [0.02, 0.18, 0.34]) thump(0.07, 0.22, 7000, at);
  },
  // ... and a bin of trash bags: a soft, heavy thud or two.
  bags: () => {
    thump(0.5, 0.22, 500);
    thump(0.3, 0.18, 380, 0.16);
  },
  // Elevator: a lift arriving (the classic two-tone chime), and someone
  // stepping out where they wanted to be.
  ding: () => {
    tone('sine', 1319, 1319, 0.5, 0.09);
    tone('sine', 1047, 1047, 0.8, 0.09, 0.18);
  },
  drop: () => tone('triangle', 660, 990, 0.09, 0.05),
  // ...and a tap it can't take: a short, low buzz.
  buzz: () => {
    tone('sawtooth', 110, 104, 0.2, 0.09, 0, 900);
    tone('square', 116, 110, 0.2, 0.05, 0, 900);
  },
  // Morse Rain: a tile landing on the board (a soft wooden knock), and one
  // cleared.
  tile: () => thump(0.18, 0.06, 900),
  pop: () => tone('triangle', 1200, 1800, 0.07, 0.07),
  checkpoint: () => [784, 988, 1175].forEach((f, k) => tone('square', f, f, 0.12, 0.06, k * 0.09, 4000)),
};

// Continuous sounds that play while a control is held (engine rumble,
// thruster hiss). setLoop(name, true/false) starts/stops them.
const LOOPS = {
  engine: { type: 'lowpass', freq: 340, vol: 0.35 },
  rcs: { type: 'highpass', freq: 2600, vol: 0.05 },
  // A car engine: buzzy oscillators whose pitch follows loopLevel().
  motor: { osc: true, vol: 0.09 },
  // Night Driver's tyres: a squeal (a steady, slightly gritty screech whose
  // pitch climbs a little as the slide gets harder) and the brakes
  // chattering at their limit (a low judder, pulsing 17 times a second).
  // Their loudness follows loopLevel().
  squeal: { type: 'bandpass', freq: 2400, q: 4, vol: 0.32, level: true, tone: 1050, toneVol: 0.7 },
  chatter: { type: 'lowpass', freq: 520, vol: 0.9, level: true, pulse: 17 },
};
const playing = {};

// Set a looping sound's level, 0..1 (for the motor: revs).
export function loopLevel(name, value) {
  const cur = playing[name];
  if (!cur) return;
  const t = ac.currentTime;
  if (!cur.oscs) {
    // A noise loop: its loudness (and a squeal's pitch, rising gently).
    const spec = LOOPS[name];
    if (spec?.level) cur.g.gain.setTargetAtTime(Math.max(0.0001, spec.vol * value), t, 0.04);
    if (cur.voice) cur.voice.frequency.setTargetAtTime(spec.tone * (0.94 + 0.1 * value), t, 0.25);
    return;
  }
  const hz = 38 + value * 120;
  cur.oscs[0].frequency.setTargetAtTime(hz, t, 0.05);
  cur.oscs[1].frequency.setTargetAtTime(hz * 1.503, t, 0.05);
  cur.filter.frequency.setTargetAtTime(300 + value * 1400, t, 0.05);
}

function startMotor(spec) {
  const t = ac.currentTime;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 400;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(spec.vol, t + 0.15);
  const oscs = ['sawtooth', 'square'].map((type, k) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = k ? 57 : 38;
    const og = ac.createGain();
    og.gain.value = k ? 0.4 : 1;
    o.connect(og);
    og.connect(f);
    o.start(t);
    return o;
  });
  f.connect(g);
  g.connect(master);
  return { oscs, filter: f, g, src: { stop: (at) => oscs.forEach((o) => o.stop(at)) } };
}

export function setLoop(name, on) {
  if (!ac || !getSetting('sound')) on = false;
  const cur = playing[name];
  if (on && !cur && LOOPS[name]?.osc) {
    playing[name] = startMotor(LOOPS[name]);
  } else if (on && !cur) {
    const spec = LOOPS[name];
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.loopStart = Math.random();
    const f = ac.createBiquadFilter();
    f.type = spec.type;
    f.frequency.value = spec.freq;
    if (spec.q) f.Q.value = spec.q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // Level-driven loops start silent; loopLevel() brings them up.
    if (!spec.level) g.gain.exponentialRampToValueAtTime(spec.vol, t + 0.06);
    src.connect(f);
    let out = f;
    const lfos = [];
    let voice = null;
    if (spec.tone) {
      // A screech: a buzzy tone, filtered to a bright squeak, under the noise.
      voice = ac.createOscillator();
      voice.type = 'sawtooth';
      voice.frequency.value = spec.tone;
      const vf = ac.createBiquadFilter();
      vf.type = 'bandpass';
      vf.frequency.value = spec.tone * 2;
      vf.Q.value = 2;
      const vg = ac.createGain();
      vg.gain.value = spec.toneVol;
      voice.connect(vf);
      vf.connect(vg);
      vg.connect(g);
      lfos.push(voice);
    }
    if (spec.pulse) {
      // Chatter: the sound pulses on and off.
      const am = ac.createGain();
      am.gain.value = 0.5;
      const lfo = ac.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = spec.pulse;
      const depth = ac.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth);
      depth.connect(am.gain);
      f.connect(am);
      out = am;
      lfos.push(lfo);
    }
    out.connect(g);
    g.connect(master);
    src.start(t, Math.random());
    lfos.forEach((o) => o.start(t));
    playing[name] = { src: { stop: (at) => [src, ...lfos].forEach((o) => o.stop(at)) }, g, voice };
  } else if (!on && cur) {
    const t = ac.currentTime;
    cur.g.gain.cancelScheduledValues(t);
    cur.g.gain.setValueAtTime(Math.max(0.0001, cur.g.gain.value), t);
    cur.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    cur.src.stop(t + 0.15);
    delete playing[name];
  }
}

export function stopLoops() {
  for (const name of Object.keys(playing)) setLoop(name, false);
  for (const stop of [...clipsPlaying]) stop();
  stopMusic();
}

// Recorded clips: fetched and decoded once, played through the same volume
// as everything else.
const clips = new Map(); // url -> Promise<AudioBuffer | null>
const clipsPlaying = new Set();

export function loadClip(url) {
  if (!ac) return Promise.resolve(null);
  if (!clips.has(url)) {
    clips.set(url, fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => new Promise((ok, fail) => ac.decodeAudioData(data, ok, fail)))
      .catch(() => {
        clips.delete(url);
        return null;
      }));
  }
  return clips.get(url);
}

// How many clips are playing (for the tests).
export function clipCount() {
  return clipsPlaying.size;
}

// Starts a clip (once it's loaded) and returns a function that stops it,
// with a quick fade, whenever you like.
export function playClip(url, vol = 0.9) {
  let src = null;
  let g = null;
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    clipsPlaying.delete(stop);
    if (!src) return;
    const t = ac.currentTime;
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.25);
    src.stop(t + 0.3);
  };
  if (!ac || !getSetting('sound')) return stop;
  clipsPlaying.add(stop);
  loadClip(url).then((buf) => {
    if (!buf || done) return;
    src = ac.createBufferSource();
    src.buffer = buf;
    g = ac.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(master);
    src.onended = () => {
      done = true;
      clipsPlaying.delete(stop);
    };
    src.start();
  });
  return stop;
}

// Morse code: a pure tone keyed on and off (with a few milliseconds' rise
// and fall, so it doesn't click), starting `at` seconds from now; unit is
// the length of a dit. Returns false if there's no sound to be had.
export function playMorse(code, { at = 0, unit = 0.06, freq = 600, vol = 0.45 } = {}) {
  if (!getSetting('sound') || !ac) return false;
  try {
    const t0 = ac.currentTime + 0.02 + at;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    let t = t0;
    for (const s of code) {
      const d = (s === '.' ? 1 : 3) * unit;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.005);
      g.gain.setValueAtTime(vol, t + d - 0.005);
      g.gain.linearRampToValueAtTime(0, t + d);
      t += d + unit;
    }
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t + 0.05);
    return true;
  } catch {
    return false;
  }
}

// A sidetone: the tone of your own key, on while you hold it down.
let side = null;
export function sidetone(on, { freq = 600, vol = 0.4 } = {}) {
  if (!ac || (on && !getSetting('sound'))) return;
  try {
    if (!side) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = 0;
      o.connect(g);
      g.connect(master);
      o.start();
      side = { o, g };
    }
    const t = ac.currentTime;
    side.g.gain.cancelScheduledValues(t);
    side.g.gain.setValueAtTime(side.g.gain.value, t);
    side.g.gain.linearRampToValueAtTime(on ? vol : 0, t + 0.005);
  } catch {
    // Never let audio problems break the game.
  }
}

export function sfx(name, arg) {
  if (!getSetting('sound') || !ac || !SFX[name]) return;
  try {
    SFX[name](arg);
  } catch {
    // Never let audio problems break the game.
  }
}

// ------------------------------------------------------------------ music
// Background music, synthesised like everything else. So far one tune:
// "muzak", lift music -- a gentle bossa nova in C: electric piano chords,
// a walking bass, a vibraphone melody and a soft shaker, round and round.

const MUZAK = {
  bpm: 104,
  // Eight bars of chords (MIDI notes, voiced close), two per bar.
  chords: [
    [[53, 57, 60, 64], [53, 57, 60, 64]], // Fmaj7
    [[52, 55, 59, 62], [57, 61, 64, 67]], // Em7, A7
    [[50, 53, 57, 60], [50, 53, 57, 60]], // Dm7
    [[55, 59, 62, 65], [55, 59, 62, 65]], // G7
    [[48, 52, 55, 59], [48, 52, 55, 59]], // Cmaj7
    [[57, 60, 64, 67], [57, 60, 64, 67]], // Am7
    [[50, 53, 57, 60], [55, 59, 62, 65]], // Dm7, G7
    [[48, 52, 55, 59], [55, 59, 62, 65]], // Cmaj7, G7
  ],
  bass: [41, 40, 38, 43, 36, 45, 38, 36], // roots, bar by bar (an octave down)
  bass2: [null, 45, null, null, null, null, 43, 43], // the chord change mid-bar
  // The tune: [beat (from the top, in eighths), MIDI note, length in eighths].
  melody: [
    [0, 76, 3], [3, 77, 1], [4, 76, 2], [6, 72, 2],
    [8, 74, 4], [12, 73, 2], [14, 74, 2],
    [16, 77, 3], [19, 76, 1], [20, 74, 2], [22, 72, 2],
    [24, 71, 4], [28, 74, 4],
    [32, 79, 3], [35, 77, 1], [36, 76, 2], [38, 74, 2],
    [40, 76, 4], [44, 72, 4],
    [48, 74, 3], [51, 76, 1], [52, 77, 2], [54, 71, 2],
    [56, 72, 6],
  ],
};

let music = null;

const hz = (m) => 440 * 2 ** ((m - 69) / 12);

function musicVoice(out, type, freq, at, dur, vol, { attack = 0.01, release = 0.4, cutoff = 0, trem = 0 } = {}) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + attack);
  g.gain.setTargetAtTime(vol * 0.5, at + attack, dur * 0.6);
  g.gain.setTargetAtTime(0.0001, at + dur, release / 3);
  let node = o;
  if (cutoff) {
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    o.connect(f);
    node = f;
  }
  if (trem) {
    // A vibraphone's motor: the loudness wobbles.
    const t = ac.createGain();
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = trem;
    depth.gain.value = 0.35;
    t.gain.value = 0.65;
    lfo.connect(depth);
    depth.connect(t.gain);
    node.connect(t);
    node = t;
    lfo.start(at);
    lfo.stop(at + dur + release + 0.1);
  }
  node.connect(g);
  g.connect(out);
  o.start(at);
  o.stop(at + dur + release + 0.1);
}

function musicNoise(out, at, dur, vol, freq, type = 'highpass') {
  const src = ac.createBufferSource();
  src.buffer = noise;
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f);
  f.connect(g);
  g.connect(out);
  src.start(at, Math.random());
  src.stop(at + dur + 0.02);
}

// One eighth-note step of the tune, starting at time `at`.
function muzakStep(out, step, at, e) {
  const bar = Math.floor(step / 8) % 8;
  const inBar = step % 8;
  const half = inBar < 4 ? 0 : 1;
  // Electric piano: the bossa rhythm, on the "and"s.
  if ([0, 3, 6].includes(inBar)) {
    const chord = MUZAK.chords[bar][half];
    chord.forEach((m, k) => {
      musicVoice(out, 'sine', hz(m), at + k * 0.008, e * 1.6, 0.05, { attack: 0.006, release: 0.5 });
      musicVoice(out, 'triangle', hz(m) * 2, at + k * 0.008, e * 0.7, 0.012, { attack: 0.004, release: 0.2, cutoff: 2500 });
    });
  }
  // Bass: root on the one, fifth on the three (or the next chord's root).
  if (inBar === 0) musicVoice(out, 'triangle', hz(MUZAK.bass[bar]), at, e * 2.6, 0.22, { attack: 0.01, release: 0.2, cutoff: 600 });
  if (inBar === 3) musicVoice(out, 'triangle', hz(MUZAK.bass[bar] + 7), at, e * 0.9, 0.14, { release: 0.1, cutoff: 600 });
  if (inBar === 4) {
    const m = MUZAK.bass2[bar] ?? MUZAK.bass[bar] + 7;
    musicVoice(out, 'triangle', hz(m), at, e * 2.6, 0.2, { attack: 0.01, release: 0.2, cutoff: 600 });
  }
  // Vibes: the tune.
  for (const [b, m, len] of MUZAK.melody) {
    if (b === step % 64) musicVoice(out, 'sine', hz(m), at, e * len, 0.07, { attack: 0.005, release: 0.9, trem: 5.5 });
  }
  // Shaker on every eighth (accented on the beat), rim on the clave.
  musicNoise(out, at, 0.06, inBar % 2 ? 0.02 : 0.035, 6000);
  if ([0, 3, 6].includes(inBar) && bar % 2 === 0) musicNoise(out, at, 0.04, 0.05, 1800, 'bandpass');
}

export function startMusic(name = 'muzak', vol = 0.5) {
  if (!ac || !getSetting('sound') || music) return;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, ac.currentTime);
  out.gain.linearRampToValueAtTime(vol, ac.currentTime + 1.5);
  out.connect(master);
  const e = 60 / MUZAK.bpm / 2; // an eighth note, s
  const swing = e * 0.12; // the off-beats lean back a little
  let step = 0;
  let next = ac.currentTime + 0.1;
  const tick = () => {
    while (next < ac.currentTime + 0.4) {
      muzakStep(out, step, next + (step % 2 ? swing : 0), e);
      step++;
      next += e;
    }
  };
  tick();
  music = { name, out, timer: setInterval(tick, 100) };
}

export function stopMusic() {
  if (!music) return;
  const { out, timer } = music;
  clearInterval(timer);
  const t = ac.currentTime;
  out.gain.cancelScheduledValues(t);
  out.gain.setValueAtTime(out.gain.value, t);
  out.gain.linearRampToValueAtTime(0, t + 0.4);
  setTimeout(() => out.disconnect(), 3000);
  music = null;
}
