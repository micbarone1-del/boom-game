/**
 * 80s arcade-style sound effects synthesized with the Web Audio API.
 * Zero assets, zero network, zero licensing. Each effect is a short
 * oscillator/noise burst with an envelope.
 *
 * Usage:  import { sfx } from "@/lib/sfx"; sfx.play("hop");
 *         sfx.setMuted(true);
 */

type EffectName =
  | "gymSelect"
  | "playerJoin"
  | "gameStart"
  | "hop"
  | "easy"
  | "medium"
  | "hard"
  | "rest"
  | "blast"
  | "setback"
  | "countdown"
  | "timerTick"
  | "didIt"
  | "defuse"
  | "blowUp"
  | "win";

type BoomSfxGlobal = {
  ctx: AudioContext | null;
  masterGain: GainNode | null;
  unlocked: boolean;
  fallbackUnlocked: boolean;
};

// Persist across HMR module reloads — otherwise we'd create a new
// (suspended) AudioContext on every code edit and lose the user-gesture
// unlock, which silences all SFX until the next click.
const _g = (typeof globalThis !== "undefined" ? globalThis : window) as any;
const state = (_g.__boomSfx ||= {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  unlocked: false,
  fallbackUnlocked: false,
}) as BoomSfxGlobal;
// Master volume — bumped so SFX cut through background music (e.g. Spotify).
const MASTER_VOLUME = 2.6;
let muted = false;
let fallbackBeep: HTMLAudioElement | null = null;
// Bumped key (v4) so any previously-stuck "muted" state from earlier
// sessions is reset to unmuted on next load.
const MUTE_KEY = "boom.sfx.muted.v4";

function fallbackAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined" || typeof btoa === "undefined") return null;
  if (fallbackBeep) return fallbackBeep;
  const sampleRate = 8000;
  const sampleCount = Math.floor(sampleRate * 0.12);
  const bytes = new Uint8Array(44 + sampleCount * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, sampleCount * 2, true);
  for (let i = 0; i < sampleCount; i++) {
    const fade = Math.min(1, i / 80, (sampleCount - i) / 160);
    const sample = Math.sin((i / sampleRate) * Math.PI * 2 * 880) * 0.7 * fade;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  fallbackBeep = new Audio(`data:audio/wav;base64,${btoa(binary)}`);
  fallbackBeep.preload = "auto";
  fallbackBeep.volume = 0.9;
  return fallbackBeep;
}

function fallbackPlay(audible: boolean) {
  if (muted) return;
  const a = fallbackAudio();
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
    a.volume = audible ? 0.9 : 0;
    void a.play().then(() => {
      if (!audible) {
        a.pause();
        a.currentTime = 0;
        a.volume = 0.9;
      }
    }).catch(() => {
      a.volume = 0.9;
    });
  } catch {
    a.volume = 0.9;
  }
}

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {}
  // Prime audio only from real user gestures; browsers block AudioContext
  // creation/resume from timers, realtime callbacks, and effects.
  const unlock = () => { unlockAudio(); };
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("touchstart", unlock, opts);
  window.addEventListener("mousedown", unlock, opts);
  window.addEventListener("click", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (state.ctx?.state === "closed") {
    state.ctx = null;
    state.masterGain = null;
    state.unlocked = false;
  }
  if (!state.ctx) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctor) return null;
    state.ctx = new Ctor();
  }
  return state.ctx;
}

function unlockAudio(): Promise<boolean> {
  const c = ac();
  if (!c) return Promise.resolve(state.fallbackUnlocked);
  // iOS/Safari often needs a source node to be created + started directly in
  // the click/touch call stack; resume() alone can leave WebAudio silent.
  try {
    const t0 = c.currentTime + 0.005;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.setValueAtTime(0.0001, t0 + 0.02);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.025);
  } catch {}
  const mark = () => {
    state.unlocked = c.state === "running";
    if (state.unlocked) state.fallbackUnlocked = true;
    return state.unlocked || state.fallbackUnlocked;
  };
  if (c.state === "running") return Promise.resolve(mark());
  return c.resume().then(mark).catch(() => {
    state.unlocked = false;
    return false;
  });
}

function out(c: AudioContext): AudioNode {
  let mg: GainNode | null = state.masterGain;
  if (!mg || mg.context !== c) {
    mg = c.createGain();
    mg.gain.value = MASTER_VOLUME;
    mg.connect(c.destination);
    state.masterGain = mg;
  }
  return mg;
}

async function ensureReady(): Promise<boolean> {
  const c = ac();
  if (!c) return state.fallbackUnlocked;
  try {
    const t0 = c.currentTime + 0.005;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.setValueAtTime(0.0001, t0 + 0.02);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.025);
    if (c.state === "suspended") await c.resume();
    state.unlocked = c.state === "running";
    if (state.unlocked) state.fallbackUnlocked = true;
    return state.unlocked || state.fallbackUnlocked;
  } catch {
    state.unlocked = false;
    return state.fallbackUnlocked;
  }
}

/** Pick a safe scheduling start time. If the context is still warming up,
 *  push everything ~60ms into the future so the gain ramp doesn't get
 *  clipped by the resume transition (the #1 cause of "I hear nothing"). */
function safeStart(c: AudioContext, requestedDelay = 0): number {
  const pad = c.state === "running" ? 0.005 : 0.08;
  return c.currentTime + pad + requestedDelay;
}

/** Single oscillator beep with optional pitch sweep. */
function beep(opts: {
  freq: number;
  endFreq?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}) {
  const c = ac();
  if (!c) return;
  const t0 = safeStart(c, opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(opts.freq, t0);
  if (opts.endFreq) osc.frequency.exponentialRampToValueAtTime(opts.endFreq, t0 + opts.dur);
  const peak = (opts.gain ?? 0.18);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(g).connect(out(c));
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

/** White-noise burst (for explosions / hits). */
function noise(opts: { dur: number; gain?: number; delay?: number; lowpass?: number }) {
  const c = ac();
  if (!c) return;
  const t0 = safeStart(c, opts.delay ?? 0);
  const len = Math.floor(c.sampleRate * opts.dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const peak = opts.gain ?? 0.25;
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  if (opts.lowpass) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = opts.lowpass;
    src.connect(f).connect(g).connect(out(c));
  } else {
    src.connect(g).connect(out(c));
  }
  src.start(t0);
  src.stop(t0 + opts.dur + 0.02);
}

const effects: Record<EffectName, () => void> = {
  // Short selection blip
  gymSelect: () => beep({ freq: 880, endFreq: 1320, dur: 0.07, type: "square", gain: 0.15 }),

  // Friendly two-tone "ping"
  playerJoin: () => {
    beep({ freq: 660, dur: 0.09, type: "triangle", gain: 0.18 });
    beep({ freq: 990, dur: 0.12, type: "triangle", gain: 0.18, delay: 0.09 });
  },

  // Triumphant rising fanfare
  gameStart: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      beep({ freq: f, dur: 0.12, type: "square", gain: 0.18, delay: i * 0.09 }),
    );
  },

  // Quick "boop" per hop
  hop: () => beep({ freq: 520, endFreq: 720, dur: 0.05, type: "square", gain: 0.12 }),

  // Bright cheery
  easy: () => {
    beep({ freq: 784, dur: 0.1, type: "triangle", gain: 0.18 });
    beep({ freq: 988, dur: 0.12, type: "triangle", gain: 0.18, delay: 0.08 });
  },

  // Mid intensity
  medium: () => {
    beep({ freq: 523, dur: 0.1, type: "square", gain: 0.18 });
    beep({ freq: 698, dur: 0.14, type: "square", gain: 0.18, delay: 0.09 });
  },

  // Heavy / ominous
  hard: () => {
    beep({ freq: 196, dur: 0.18, type: "sawtooth", gain: 0.2 });
    beep({ freq: 147, dur: 0.22, type: "sawtooth", gain: 0.2, delay: 0.12 });
  },

  // Soft chill
  rest: () => {
    beep({ freq: 880, dur: 0.18, type: "sine", gain: 0.16 });
    beep({ freq: 660, dur: 0.22, type: "sine", gain: 0.14, delay: 0.12 });
  },

  // Power-up sweep
  blast: () => beep({ freq: 220, endFreq: 1760, dur: 0.35, type: "sawtooth", gain: 0.2 }),

  // Descending defeat
  setback: () => beep({ freq: 880, endFreq: 110, dur: 0.45, type: "sawtooth", gain: 0.2 }),

  // 3-2-1 beep (single tick — caller fires 3x)
  countdown: () => beep({ freq: 660, dur: 0.12, type: "square", gain: 0.2 }),

  // Subtle tick (call sparingly)
  timerTick: () => beep({ freq: 1200, dur: 0.03, type: "square", gain: 0.08 }),

  // Coin-style success
  didIt: () => {
    beep({ freq: 988, dur: 0.08, type: "square", gain: 0.2 });
    beep({ freq: 1319, dur: 0.18, type: "square", gain: 0.2, delay: 0.08 });
  },

  // Cheerful confirmation
  defuse: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      beep({ freq: f, dur: 0.09, type: "triangle", gain: 0.18, delay: i * 0.07 }),
    );
  },

  // Big explosion: noise burst + low boom
  blowUp: () => {
    noise({ dur: 0.6, gain: 0.4, lowpass: 1500 });
    beep({ freq: 110, endFreq: 40, dur: 0.6, type: "sawtooth", gain: 0.3 });
  },

  // Victory fanfare
  win: () => {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) =>
      beep({ freq: f, dur: 0.16, type: "square", gain: 0.2, delay: i * 0.12 }),
    );
  },
};

export const sfx = {
  play(name: EffectName) {
    if (muted) return;
    try {
      const c = ac();
      if (!c) {
        fallbackPlay(true);
        state.fallbackUnlocked = true;
        return;
      }
      if (c.state === "running") {
        state.unlocked = true;
        effects[name]();
        return;
      }
      const inUserGesture = !!navigator.userActivation?.isActive;
      if (inUserGesture) {
        fallbackPlay(true);
        state.fallbackUnlocked = true;
        void unlockAudio();
        effects[name]();
        return;
      }
      if (state.fallbackUnlocked) fallbackPlay(true);
      void unlockAudio().then((ready) => {
        if (!muted && ready) effects[name]();
      });
    } catch {
      // Audio context might be blocked before first user interaction — ignore.
    }
  },
  isMuted() {
    return muted;
  },
  isUnlocked() {
    const c = state.ctx;
    return (!!c && c.state === "running" && !!state.unlocked) || state.fallbackUnlocked;
  },
  setMuted(v: boolean) {
    muted = v;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(MUTE_KEY, v ? "1" : "0");
      } catch {}
    }
  },
  unlock() {
    if (muted) muted = false;
    return ensureReady();
  },
  toggleMuted() {
    this.setMuted(!muted);
    return muted;
  },
};