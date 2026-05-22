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
  arcadeTimer: number | null;
  arcadeGain: GainNode | null;
  arcadeStep: number;
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
  arcadeTimer: null as number | null,
  arcadeGain: null as GainNode | null,
  arcadeStep: 0,
}) as BoomSfxGlobal;
// Master volume — kept low so the robotic voice (SpeechSynthesis volume is
// capped at 1.0 and OS-controlled) feels relatively maximum compared to the
// synthesized SFX. Lowering MASTER lets speech cut through.
const MASTER_VOLUME = 0.55;
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
  fallbackPlay(false);
  state.fallbackUnlocked = true;
  primeSpeech();
  const c = ac();
  if (!c) return Promise.resolve(true);
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
  fallbackPlay(false);
  state.fallbackUnlocked = true;
  primeSpeech();
  const c = ac();
  if (!c) return true;
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
        if (state.fallbackUnlocked) fallbackPlay(true);
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

// ---------------------------------------------------------------------------
// Pod-mode helpers: robotic voice + dynamic tones used by the judge UI.
// ---------------------------------------------------------------------------

let _voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  _voices = window.speechSynthesis.getVoices();
  if (_voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      _voices = window.speechSynthesis.getVoices();
    };
  }
}
if (typeof window !== "undefined") loadVoices();

/**
 * iOS/Safari requires SpeechSynthesis to be kicked off from a user gesture
 * the first time. We push a silent utterance on first unlock so subsequent
 * speak() calls (which often happen inside effects/timers) actually fire.
 */
let _speechPrimed = false;
function primeSpeech() {
  if (_speechPrimed) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.rate = 1;
    window.speechSynthesis.speak(u);
    _speechPrimed = true;
    loadVoices();
  } catch {
    /* ignore */
  }
}

function pickRoboticVoice(): SpeechSynthesisVoice | undefined {
  if (_voices.length === 0) loadVoices();
  // Prefer voices that tend to sound more synthetic/robotic.
  const prefs = [/zarvox/i, /albert/i, /fred/i, /trinoids/i, /google/i, /microsoft/i, /en-?us/i];
  for (const re of prefs) {
    const v = _voices.find((v) => re.test(v.name) || re.test(v.lang));
    if (v) return v;
  }
  return _voices[0];
}

export function speak(text: string, opts: { pitch?: number; rate?: number; volume?: number } = {}) {
  if (muted) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    sfx.unlock();
    primeSpeech();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickRoboticVoice();
    if (v) u.voice = v;
    u.pitch = opts.pitch ?? 0.7;
    u.rate = opts.rate ?? 0.9;
    u.volume = 1; // always max — caller can't make it louder
    // Cancel any pending utterance so the new line doesn't queue up behind
    // a stale phase's narration (the #1 cause of "voice comes and goes").
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    // Small delay lets Safari finish the cancel before speak fires.
    window.setTimeout(() => {
      try { window.speechSynthesis.speak(u); } catch { /* ignore */ }
    }, 60);
  } catch {
    /* ignore */
  }
}

function playArcadeLoopStep() {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const root = [110, 130.81, 146.83, 164.81][state.arcadeStep % 4];
  const melody = [2, 4, 7, 11, 14, 11, 7, 4][state.arcadeStep % 8];
  const t0 = safeStart(c);
  const stepDur = 0.18;
  let musicGain = state.arcadeGain;
  if (!musicGain || musicGain.context !== c) {
    musicGain = c.createGain();
    musicGain.gain.value = 0.1;
    musicGain.connect(out(c));
    state.arcadeGain = musicGain;
  }
  const bass = c.createOscillator();
  const lead = c.createOscillator();
  const bassGain = c.createGain();
  const leadGain = c.createGain();
  bass.type = "square";
  lead.type = "sawtooth";
  bass.frequency.setValueAtTime(root, t0);
  lead.frequency.setValueAtTime(root * Math.pow(2, melody / 12) * 2, t0);
  bassGain.gain.setValueAtTime(0.0001, t0);
  bassGain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.01);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur);
  leadGain.gain.setValueAtTime(0.0001, t0);
  leadGain.gain.exponentialRampToValueAtTime(0.07, t0 + 0.01);
  leadGain.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 0.75);
  bass.connect(bassGain).connect(musicGain);
  lead.connect(leadGain).connect(musicGain);
  bass.start(t0);
  lead.start(t0);
  bass.stop(t0 + stepDur + 0.03);
  lead.stop(t0 + stepDur + 0.03);
  state.arcadeStep += 1;
}

export function startArcadeMusic() {
  if (muted || typeof window === "undefined") return;
  void ensureReady().then(() => playArcadeLoopStep());
  if (state.arcadeTimer) return;
  state.arcadeTimer = window.setInterval(playArcadeLoopStep, 210);
}

/**
 * Ramp the arcade BGM intensity from 0..1 (calm → frantic). Increases
 * tempo (interval) and gain so the fuse timer feels more urgent.
 */
export function setBgmIntensity(progress: number) {
  if (typeof window === "undefined") return;
  const p = Math.max(0, Math.min(1, progress));
  const interval = Math.round(210 - p * 110); // 210ms → 100ms
  if (state.arcadeTimer) {
    window.clearInterval(state.arcadeTimer);
    state.arcadeTimer = window.setInterval(playArcadeLoopStep, interval);
  }
  const g = state.arcadeGain;
  const c = ac();
  if (g && c) {
    try {
      const t = c.currentTime + 0.02;
      g.gain.cancelScheduledValues(t);
      g.gain.linearRampToValueAtTime(0.1 + p * 0.5, t + 0.3);
    } catch {}
  }
}

/** Big robotic "TIME'S OUT!" with explosion. */
export function playTimesOut() {
  if (muted) return;
  effects.blowUp();
  setTimeout(() => effects.blowUp(), 200);
  speak("Time's out!", { pitch: 0.5, rate: 0.8, volume: 1 });
}

/** Arcade lose riff + robotic "Game over". */
export function playGameOver() {
  if (muted) return;
  const notes = [523, 440, 349, 262, 196, 147];
  notes.forEach((f, i) =>
    beep({ freq: f, dur: 0.22, type: "square", gain: 0.22, delay: i * 0.18 }),
  );
  setTimeout(() => speak("Game over.", { pitch: 0.5, rate: 0.75, volume: 1 }), 600);
}

export function stopArcadeMusic() {
  if (typeof window !== "undefined" && state.arcadeTimer) {
    window.clearInterval(state.arcadeTimer);
  }
  state.arcadeTimer = null;
  try {
    const c = ac();
    const g = state.arcadeGain;
    if (c && g) {
      const t = c.currentTime + 0.01;
      g.gain.cancelScheduledValues(t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.15);
      window.setTimeout(() => {
        try {
          g.disconnect();
        } catch {}
        if (state.arcadeGain === g) state.arcadeGain = null;
      }, 220);
    }
  } catch {}
}

/** Single short pop tied to rep progress — pitch climbs toward target. */
export function repPop(progress: number) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const p = Math.max(0, Math.min(1, progress));
  const freq = 440 + p * 880;
  const t0 = c.currentTime + 0.005;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  o.connect(g).connect(out(c));
  o.start(t0);
  o.stop(t0 + 0.14);
}

/** A sustained rising arcade tone — call once to start, returns a stop fn. */
export function startArcadeRise(durationMs: number): () => void {
  const c = ac();
  if (!c || muted) return () => {};
  const t0 = c.currentTime + 0.01;
  const tEnd = t0 + durationMs / 1000;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180, t0);
  o.frequency.exponentialRampToValueAtTime(900, tEnd);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.2);
  g.gain.linearRampToValueAtTime(0.12, tEnd);
  o.connect(g).connect(out(c));
  o.start(t0);
  o.stop(tEnd + 0.05);
  return () => {
    try {
      const tn = c.currentTime + 0.01;
      g.gain.cancelScheduledValues(tn);
      g.gain.exponentialRampToValueAtTime(0.0001, tn + 0.1);
      o.stop(tn + 0.12);
    } catch {
      /* ignore */
    }
  };
}