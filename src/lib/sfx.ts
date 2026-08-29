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
  | "win"
  | "wheelTick"
  | "wheelStop"
  | "bossHit"
  | "hopStep"
  | "trapPop"
  | "rollJingle"
  | "trapFound"
  | "winJingle"
  | "explodeJingle"
  | "switchBig"
  | "jingleEasy"
  | "jingleMedium"
  | "jingleHard"
  | "jingleBoost"
  | "jingleSetback"
  | "jingleSurprise"
  | "jingleCrazy"
  | "jingleGroup"
  | "jinglePause"
  | "jingleStart";

type BoomSfxGlobal = {
  ctx: AudioContext | null;
  masterGain: GainNode | null;
  unlocked: boolean;
  fallbackUnlocked: boolean;
  arcadeTimer: number | null;
  arcadeGain: GainNode | null;
  arcadeStep: number;
  musicWanted: boolean;
  lastMusicStepAt: number;
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
  musicWanted: false,
  lastMusicStepAt: 0,
}) as BoomSfxGlobal;
// Master volume — kept low so the robotic voice (SpeechSynthesis volume is
// capped at 1.0 and OS-controlled) feels relatively maximum compared to the
// synthesized SFX. Lowering MASTER lets speech cut through.
const MASTER_VOLUME = 0.55;
let muted = false;
// Hard freeze flag — while true NOTHING may make noise (music, SFX, voice)
// and nothing may resume the AudioContext. Set by setAudioSuspended().
let audioSuspended = false;
export function isAudioSuspended() { return audioSuspended; }
let fallbackBeep: HTMLAudioElement | null = null;
// Bumped key (v4) so any previously-stuck "muted" state from earlier
// sessions is reset to unmuted on next load.
const MUTE_KEY = "boom.sfx.muted.v4";
const VOICE_KEY = "boom.robotVoice.enabled.v1";
let robotVoiceEnabled = false;

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
  if (muted || audioSuspended) return;
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
    robotVoiceEnabled = localStorage.getItem(VOICE_KEY) === "1";
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
  if (audioSuspended) return Promise.resolve(false);
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
  if (audioSuspended) return false;
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

  // Ratchet click for wheel-of-fortune ticks
  wheelTick: () => beep({ freq: 1400, dur: 0.025, type: "square", gain: 0.14 }),

  // Wheel landing chime
  wheelStop: () => {
    beep({ freq: 880, dur: 0.1, type: "square", gain: 0.22 });
    beep({ freq: 1319, dur: 0.18, type: "triangle", gain: 0.22, delay: 0.08 });
    beep({ freq: 1760, dur: 0.22, type: "triangle", gain: 0.2, delay: 0.18 });
  },

  // Punchy hit on the boss
  bossHit: () => {
    noise({ dur: 0.18, gain: 0.5, lowpass: 2800 });
    beep({ freq: 220, endFreq: 60, dur: 0.22, type: "sawtooth", gain: 0.28 });
    beep({ freq: 1320, dur: 0.05, type: "square", gain: 0.22, delay: 0.02 });
  },

  // Springy "boing" for every hop of the token along the board
  hopStep: () => {
    beep({ freq: 380, endFreq: 900, dur: 0.09, type: "square", gain: 0.16 });
    beep({ freq: 1200, dur: 0.04, type: "triangle", gain: 0.1, delay: 0.08 });
  },

  // --- Jingles -----------------------------------------------------------
  // Rolling the dice: quick rising arcade arpeggio.
  rollJingle: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      beep({ freq: f, dur: 0.08, type: "square", gain: 0.2, delay: i * 0.06 }),
    );
    beep({ freq: 1568, dur: 0.14, type: "triangle", gain: 0.18, delay: 0.26 });
  },

  // Trap discovered: ominous stinger + wobble.
  trapFound: () => {
    beep({ freq: 330, dur: 0.12, type: "sawtooth", gain: 0.22 });
    beep({ freq: 262, dur: 0.14, type: "sawtooth", gain: 0.22, delay: 0.12 });
    beep({ freq: 196, endFreq: 140, dur: 0.35, type: "square", gain: 0.24, delay: 0.26 });
    noise({ dur: 0.2, gain: 0.16, lowpass: 1800, delay: 0.26 });
  },

  // Big win fanfare (longer than "win").
  winJingle: () => {
    const notes: [number, number][] = [
      [523, 0], [659, 0.1], [784, 0.2], [1047, 0.3],
      [880, 0.46], [1047, 0.56], [1319, 0.66], [1568, 0.8],
    ];
    notes.forEach(([f, t]) => {
      beep({ freq: f, dur: 0.16, type: "square", gain: 0.2, delay: t });
      beep({ freq: f * 2, dur: 0.12, type: "triangle", gain: 0.1, delay: t });
    });
  },

  // Explosion jingle: boom then sad descending trombone.
  explodeJingle: () => {
    noise({ dur: 0.7, gain: 0.42, lowpass: 1400 });
    beep({ freq: 120, endFreq: 35, dur: 0.7, type: "sawtooth", gain: 0.3 });
    [392, 349, 311, 262].forEach((f, i) =>
      beep({ freq: f, dur: 0.22, type: "sawtooth", gain: 0.2, delay: 0.6 + i * 0.18 }),
    );
  },

  // Loud "pass the phone" countdown blast.
  switchBig: () => {
    beep({ freq: 440, dur: 0.18, type: "square", gain: 0.32 });
    beep({ freq: 880, dur: 0.18, type: "square", gain: 0.22, delay: 0.02 });
    noise({ dur: 0.1, gain: 0.14, lowpass: 4000 });
  },

  // Cartoon "pop!" when a trap / cell mascot springs onto the screen
  trapPop: () => {
    beep({ freq: 180, endFreq: 1200, dur: 0.12, type: "sawtooth", gain: 0.22 });
    noise({ dur: 0.12, gain: 0.2, lowpass: 3200, delay: 0.02 });
    beep({ freq: 1568, dur: 0.09, type: "square", gain: 0.18, delay: 0.12 });
  },

  // --- Per-trap jingles: every cell type gets its own musical signature ---
  jingleEasy: () => {
    const shift = Math.random() < 0.5 ? 1 : 1.122;
    [523, 659, 784].forEach((f, i) =>
      beep({ freq: f * shift, dur: 0.14, type: "square", gain: 0.2, delay: i * 0.09 }),
    );
  },
  jingleMedium: () => {
    const notes = Math.random() < 0.5 ? [440, 554, 659, 880] : [440, 659, 554, 988];
    notes.forEach((f, i) =>
      beep({ freq: f, dur: 0.13, type: "sawtooth", gain: 0.18, delay: i * 0.08 }),
    );
  },
  jingleHard: () => {
    const root = Math.random() < 0.5 ? 110 : 123.47;
    [root, root, root * 4 / 3].forEach((f, i) =>
      beep({ freq: f, dur: 0.22, type: "sawtooth", gain: 0.26, delay: i * 0.13 }),
    );
    noise({ dur: 0.25, gain: 0.16, lowpass: 1400, delay: 0.26 });
  },
  jingleBoost: () => {
    const notes = Math.random() < 0.5 ? [659, 880, 1046, 1318, 1568] : [784, 988, 1175, 1568, 1976];
    notes.forEach((f, i) =>
      beep({ freq: f, dur: 0.1, type: "triangle", gain: 0.22, delay: i * 0.06 }),
    );
    beep({ freq: 1046, endFreq: 2093, dur: 0.3, type: "square", gain: 0.14, delay: 0.32 });
  },
  jingleSetback: () => {
    const notes = Math.random() < 0.5 ? [523, 440, 349, 261] : [587, 466, 392, 233];
    notes.forEach((f, i) =>
      beep({ freq: f, dur: 0.18, type: "sawtooth", gain: 0.22, delay: i * 0.11 }),
    );
    beep({ freq: 196, endFreq: 90, dur: 0.4, type: "triangle", gain: 0.2, delay: 0.46 });
  },
  jingleSurprise: () => {
    const notes = Math.random() < 0.5 ? [880, 1318, 987, 1568] : [1046, 784, 1396, 1760];
    notes.forEach((f, i) =>
      beep({ freq: f, dur: 0.09, type: "square", gain: 0.2, delay: i * 0.07 }),
    );
    beep({ freq: 660, endFreq: 1760, dur: 0.22, type: "triangle", gain: 0.16, delay: 0.3 });
  },
  jingleCrazy: () => {
    const notes = Math.random() < 0.5 ? [740, 415, 987, 554, 1244] : [831, 466, 1108, 622, 1396];
    notes.forEach((f, i) =>
      beep({ freq: f, dur: 0.08, type: "sawtooth", gain: 0.2, delay: i * 0.06 }),
    );
    noise({ dur: 0.18, gain: 0.14, lowpass: 5200, delay: 0.32 });
  },
  jingleGroup: () => {
    const chord = Math.random() < 0.5 ? [392, 494, 587] : [440, 554, 659];
    chord.forEach((f) =>
      beep({ freq: f, dur: 0.35, type: "triangle", gain: 0.16 }),
    );
    [784, 988].forEach((f, i) =>
      beep({ freq: f, dur: 0.16, type: "square", gain: 0.16, delay: 0.3 + i * 0.12 }),
    );
  },
  jinglePause: () => {
    const notes = Math.random() < 0.5 ? [587, 784, 698, 523] : [659, 880, 784, 587];
    notes.forEach((f, i) =>
      beep({ freq: f, dur: 0.2, type: "sine", gain: 0.2, delay: i * 0.14 }),
    );
  },
  jingleStart: () => {
    [392, 523, 659, 784].forEach((f, i) =>
      beep({ freq: f, dur: 0.12, type: "square", gain: 0.22, delay: i * 0.08 }),
    );
  },
};

/** Momentarily silence the music bed (used so trap jingles cut through). */
export function duckMusicFor(ms: number) {
  duckMusic(true);
  if (_duckTimer) { window.clearTimeout(_duckTimer); _duckTimer = null; }
  _duckTimer = window.setTimeout(() => duckMusic(false), ms);
}

// Anything that reads as a "jingle" should push the music right down so the
// cue is clearly audible.
const DUCKING_EFFECTS =
  /^(jingle|trapPop|explodeJingle|winJingle|rollJingle|trapFound|defuse|powerUp|vsWin|bossWin|boom|explode)/i;


export const sfx = {
  play(name: EffectName) {
    if (muted || audioSuspended) return;
    if (typeof window !== "undefined" && DUCKING_EFFECTS.test(name)) duckMusicFor(1900);
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
        // Only beep the WAV fallback the very first time, to confirm audio
        // is alive. After that the WebAudio context is running and the
        // fallback piggyback just causes random volume bumps.
        if (!state.fallbackUnlocked) fallbackPlay(true);
        state.fallbackUnlocked = true;
        void unlockAudio();
        effects[name]();
        return;
      }
      if (!state.fallbackUnlocked) fallbackPlay(true);
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

// --- Speech ducking -------------------------------------------------------
// Browsers (and iOS especially) drop the whole output level when
// SpeechSynthesis and WebAudio play at once. Rather than fight it, mute the
// music bed while the robot voice talks and bring it straight back after.
let musicDucked = false;
let _duckTimer: number | null = null;
function duckMusic(on: boolean) {
  musicDucked = on;
  const g = state.arcadeGain;
  const c = state.ctx;
  if (!g || !c) return;
  try {
    const t = c.currentTime + 0.01;
    g.gain.cancelScheduledValues(t);
    g.gain.linearRampToValueAtTime(
      on ? 0.0001 : PHASES[musicPhase].gain + musicIntensity * 0.35,
      t + (on ? 0.08 : 0.35),
    );
  } catch { /* ignore */ }
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
  if (muted || audioSuspended || !robotVoiceEnabled) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    sfx.unlock();
    primeSpeech();
    // De-duplicate identical narration fired within a short window
    // (React StrictMode double-invokes effects, and some callers also
    // re-mount on state ticks — both used to make the voice say the
    // same line twice in a row).
    const g = globalThis as any;
    const now = Date.now();
    if (g.__boomLastSpeak && g.__boomLastSpeak.text === text && now - g.__boomLastSpeak.t < 1500) {
      return;
    }
    g.__boomLastSpeak = { text, t: now };
    // TTS engines expand "reps" → "representatives". Force phonetic
    // pronunciation. Same trick for short tokens that get over-expanded.
    const normalized = text
      .replace(/\breps\b/gi, "repss")
      .replace(/\brep\b/gi, "repp");
    const u = new SpeechSynthesisUtterance(normalized);
    const v = pickRoboticVoice();
    if (v) u.voice = v;
    u.pitch = opts.pitch ?? 0.7;
    u.rate = opts.rate ?? 0.9;
    u.volume = 1; // always max — caller can't make it louder
    // Cancel any pending utterance so the new line doesn't queue up behind
    // a stale phase's narration (the #1 cause of "voice comes and goes").
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    duckMusic(true);
    if (_duckTimer) { window.clearTimeout(_duckTimer); _duckTimer = null; }
    const unduck = () => {
      if (_duckTimer) window.clearTimeout(_duckTimer);
      _duckTimer = window.setTimeout(() => duckMusic(false), 250);
    };
    u.onend = unduck;
    u.onerror = unduck;
    // Safety net: never leave the music ducked if onend never fires.
    const words = normalized.trim().split(/\s+/).length;
    _duckTimer = window.setTimeout(() => duckMusic(false), 1200 + words * 420);
    // Small delay lets Safari finish the cancel before speak fires.
    window.setTimeout(() => {
      try { window.speechSynthesis.speak(u); } catch { unduck(); }
    }, 60);
  } catch {
    /* ignore */
  }
}

export function isRobotVoiceEnabled() {
  return robotVoiceEnabled;
}

export function setRobotVoiceEnabled(enabled: boolean) {
  robotVoiceEnabled = enabled;
  if (typeof window !== "undefined") {
    try { localStorage.setItem(VOICE_KEY, enabled ? "1" : "0"); } catch {}
    if (!enabled) {
      try { window.speechSynthesis?.cancel(); } catch {}
      if (_duckTimer) {
        window.clearTimeout(_duckTimer);
        _duckTimer = null;
      }
      duckMusic(false);
    }
  }
}

// ---------------------------------------------------------------------------
// BGM: heavy distorted retro-arcade rock/dance engine.
// One 16-step sequencer drives distorted power-chord stabs, a driving kick,
// snare backbeat, off-beat hats and a chip lead. The active "phase" swaps
// the riff/tempo/timbre, and intensity (fuse progress) pushes tempo + drive.
// ---------------------------------------------------------------------------

export type MusicPhase = "attract" | "lobby" | "play" | "judge" | "boss" | "victory";

type PhaseCfg = {
  bpm: number;
  roots: number[]; // one root per bar-quarter (semitone-based Hz)
  lead: number[]; // 16-step lead pattern (semitone offsets, -1 = rest)
  drive: number; // distortion amount
  gain: number;
};

const PHASES: Record<MusicPhase, PhaseCfg> = {
  // Attract mode: driving retro techno — fast 4/4, hypnotic minor riff.
  attract: {
    bpm: 138,
    roots: [110, 110, 130.81, 98],
    lead: [0, 12, 7, 12, 3, 12, 7, 12, 0, 12, 10, 12, 5, 12, 7, 12],
    drive: 22,
    gain: 0.13,
  },
  lobby: {
    bpm: 118,
    roots: [98, 98, 110, 87.31],
    lead: [0, -1, 7, -1, 5, -1, 3, -1, 0, -1, 7, -1, 10, -1, 7, -1],
    drive: 12,
    gain: 0.1,
  },
  play: {
    bpm: 132,
    roots: [110, 110, 146.83, 130.81],
    lead: [0, 7, -1, 5, 3, -1, 7, 10, 0, 7, -1, 5, 12, 10, 7, 5],
    drive: 26,
    gain: 0.13,
  },
  judge: {
    bpm: 146,
    roots: [98, 98, 116.54, 130.81],
    lead: [0, 0, 7, 7, 10, 10, 12, 12, 0, 0, 7, 7, 14, 12, 10, 7],
    drive: 40,
    gain: 0.14,
  },
  boss: {
    bpm: 156,
    roots: [73.42, 73.42, 87.31, 82.41],
    lead: [0, 1, 0, -1, 7, 6, 7, -1, 0, 1, 0, -1, 10, 9, 7, 6],
    drive: 60,
    gain: 0.16,
  },
  victory: {
    bpm: 128,
    roots: [130.81, 164.81, 174.61, 196],
    lead: [0, 4, 7, 12, 7, 4, 0, 4, 7, 12, 16, 12, 7, 4, 0, -1],
    drive: 18,
    gain: 0.13,
  },
};

let musicPhase: MusicPhase = "play";
let musicIntensity = 0;
let driveShaper: WaveShaperNode | null = null;
let driveAmountApplied = -1;

function makeCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = Math.max(1, amount);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function musicBus(c: AudioContext, cfg: PhaseCfg): AudioNode {
  let g = state.arcadeGain;
  if (!g || g.context !== c) {
    g = c.createGain();
    g.gain.value = cfg.gain;
    const shaper = c.createWaveShaper();
    shaper.curve = makeCurve(cfg.drive);
    driveShaper = shaper;
    driveAmountApplied = cfg.drive;
    const tone = c.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    g.connect(shaper).connect(tone).connect(out(c));
    state.arcadeGain = g;
  }
  const drive = cfg.drive * (1 + musicIntensity * 0.8);
  if (driveShaper && Math.abs(drive - driveAmountApplied) > 2) {
    driveShaper.curve = makeCurve(drive);
    driveAmountApplied = drive;
  }
  return g;
}

function powerChord(c: AudioContext, t0: number, root: number, dur: number, dest: AudioNode) {
  // Root + fifth + octave, slightly detuned = classic distorted power chord.
  
  const ratios = [1, 1.4983, 2];
  ratios.forEach((r, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = i === 2 ? "square" : "sawtooth";
    o.frequency.setValueAtTime(root * r * (i === 1 ? 1.004 : 1), t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.2 / (i + 1), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  });
}

function snareAt(c: AudioContext, t0: number, dest: AudioNode) {
  const len = Math.floor(c.sampleRate * 0.14);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1900;
  const g = c.createGain();
  g.gain.setValueAtTime(0.3, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
  src.connect(f).connect(g).connect(dest);
  src.start(t0);
  src.stop(t0 + 0.16);
}

function hatAt(c: AudioContext, t0: number, dest: AudioNode) {
  const len = Math.floor(c.sampleRate * 0.05);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
  src.connect(f).connect(g).connect(dest);
  src.start(t0);
  src.stop(t0 + 0.07);
}

function stepDurationMs(cfg: PhaseCfg): number {
  const bpm = cfg.bpm * (1 + musicIntensity * 0.35);
  return Math.max(70, (60000 / bpm) / 4); // 16th notes
}

function playArcadeLoopStep() {
  // NOTE: ducking is handled by the music bus gain — never bail out here or
  // a stuck duck flag would kill the soundtrack permanently.
  if (muted || audioSuspended) return;
  const c = ac();
  if (!c) return;
  if (c.state !== "running") return;
  state.lastMusicStepAt = Date.now();
  const cfg = PHASES[musicPhase];
  const bus = musicBus(c, cfg);
  const t0 = safeStart(c);
  const i = state.arcadeStep % 16;
  const root = cfg.roots[Math.floor(i / 4) % cfg.roots.length];
  const stepSec = stepDurationMs(cfg) / 1000;

  // Distorted chord stabs on the 1 and the off-beat "and" of 3.
  if (i === 0 || i === 6 || i === 10) {
    powerChord(c, t0, root, stepSec * (i === 0 ? 3 : 1.6), bus);
  }
  // Driving four-on-the-floor kick.
  if (i % 4 === 0) playKickAt(c, t0, bus);
  // Backbeat snare.
  if (i === 4 || i === 12) snareAt(c, t0, bus);
  // Off-beat hats (dance feel).
  if (i % 2 === 1) hatAt(c, t0, bus);
  // Chip lead riff.
  const semi = cfg.lead[i];
  if (semi >= 0) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(root * 4 * Math.pow(2, semi / 12), t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.075, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + stepSec * 0.9);
    o.connect(g).connect(bus);
    o.start(t0);
    o.stop(t0 + stepSec + 0.02);
  }
  state.arcadeStep += 1;
}

function rescheduleLoop() {
  if (typeof window === "undefined") return;
  if (!state.arcadeTimer) return;
  window.clearInterval(state.arcadeTimer);
  state.arcadeTimer = window.setInterval(playArcadeLoopStep, stepDurationMs(PHASES[musicPhase]));
}

export function startArcadeMusic() {
  if (muted || typeof window === "undefined") return;
  state.musicWanted = true;
  if (audioSuspended) return;
  void ensureReady().then(() => playArcadeLoopStep());
  if (state.arcadeTimer) return;
  state.arcadeTimer = window.setInterval(playArcadeLoopStep, stepDurationMs(PHASES[musicPhase]));
}

// --- Audio watchdog --------------------------------------------------------
// Browsers routinely suspend the AudioContext (tab blur, phone call, iOS
// interruptions) and the loop interval can be throttled away. Every 2s we
// re-resume the context, restore a lost music timer, and clear a stuck duck.
if (typeof window !== "undefined") {
  const globalAudio = globalThis as typeof globalThis & {
    __boomAudioWatchdog?: number;
    __boomAudioVisibilityHandler?: () => void;
  };
  if (globalAudio.__boomAudioWatchdog) window.clearInterval(globalAudio.__boomAudioWatchdog);
  if (globalAudio.__boomAudioVisibilityHandler) {
    document.removeEventListener("visibilitychange", globalAudio.__boomAudioVisibilityHandler);
  }
  globalAudio.__boomAudioWatchdog = window.setInterval(() => {
    if (muted || audioSuspended) return;
    const c = state.ctx;
    if (c && c.state === "suspended") void c.resume().catch(() => {});
    if (!window.speechSynthesis?.speaking && musicDucked) duckMusic(false);
    const loopStalled = !!state.arcadeTimer && Date.now() - state.lastMusicStepAt > 3500;
    if (loopStalled) {
      window.clearInterval(state.arcadeTimer as number);
      state.arcadeTimer = null;
    }
    if (state.musicWanted && !state.arcadeTimer) {
      state.arcadeTimer = window.setInterval(
        playArcadeLoopStep,
        stepDurationMs(PHASES[musicPhase]),
      );
    }
  }, 2000);
  globalAudio.__boomAudioVisibilityHandler = () => {
    if (document.visibilityState !== "visible" || muted || audioSuspended) return;
    const c = state.ctx;
    if (c && c.state === "suspended") void c.resume().catch(() => {});
    if (state.musicWanted && !state.arcadeTimer) startArcadeMusic();
  };
  document.addEventListener("visibilitychange", globalAudio.__boomAudioVisibilityHandler);
}

/** Swap the track to the one matching the current game phase. */
export function setMusicPhase(phase: MusicPhase) {
  if (phase === musicPhase) return;
  musicPhase = phase;
  state.arcadeStep = 0;
  const cfg = PHASES[phase];
  const g = state.arcadeGain;
  const c = ac();
  if (g && c) {
    try {
      const t = c.currentTime + 0.02;
      g.gain.cancelScheduledValues(t);
      g.gain.linearRampToValueAtTime(cfg.gain + musicIntensity * 0.35, t + 0.25);
    } catch {}
  }
  rescheduleLoop();
}

export function getMusicPhase(): MusicPhase {
  return musicPhase;
}

/**
 * Ramp the BGM intensity from 0..1 (calm → frantic): faster tempo, more
 * distortion drive and more level, so the fuse timer feels urgent.
 */
export function setBgmIntensity(progress: number) {
  if (typeof window === "undefined") return;
  const p = Math.max(0, Math.min(1, progress));
  if (Math.abs(p - musicIntensity) < 0.02) return;
  musicIntensity = p;
  rescheduleLoop();
  const g = state.arcadeGain;
  const c = ac();
  if (g && c) {
    try {
      const t = c.currentTime + 0.02;
      g.gain.cancelScheduledValues(t);
      g.gain.linearRampToValueAtTime(PHASES[musicPhase].gain + p * 0.35, t + 0.3);
    } catch {}
  }
}

/**
 * Freeze / unfreeze ALL audio (music, scheduled SFX tails, robotic voice).
 * Used by the pause overlay so a paused game is truly silent and the
 * exercise soundtrack resumes exactly where it stopped.
 */
export function setAudioSuspended(suspended: boolean) {
  if (typeof window === "undefined") return;
  audioSuspended = suspended;
  const c = state.ctx;
  if (suspended) {
    if (state.arcadeTimer) {
      window.clearInterval(state.arcadeTimer);
      state.arcadeTimer = null;
    }
    try { window.speechSynthesis?.cancel(); } catch {}
    if (c && c.state === "running") void c.suspend().catch(() => {});
  } else {
    if (c && c.state === "suspended") void c.resume().catch(() => {});
    duckMusic(false);
    // Bring the soundtrack back — the pause tore the sequencer timer down.
    if (state.musicWanted && !state.arcadeTimer) startArcadeMusic();
  }
}

/**
 * Haptic feedback. Uses the Vibration API where available (Android/Chrome);
 * silently no-ops on iOS Safari.
 */
export type HapticKind = "tap" | "light" | "hop" | "success" | "fail" | "boom" | "warn";
const HAPTICS: Record<HapticKind, number | number[]> = {
  tap: 15,
  light: 8,
  hop: [0, 12, 40, 12],
  success: [0, 25, 45, 25, 45, 60],
  fail: [0, 90, 60, 140],
  boom: [0, 200, 80, 300],
  warn: [0, 30, 60, 30],
};
export function haptic(kind: HapticKind = "tap") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(HAPTICS[kind]);
  } catch {
    /* ignore */
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
  state.musicWanted = false;
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
  // Mario-mushroom style 1-up: two-step rising chirp, loud.
  const t0 = c.currentTime + 0.005;
  const f1 = 600 + p * 600;
  const f2 = f1 * 1.5;
  const mk = (f: number, delay: number, dur: number, gain: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(f, t0 + delay);
    o.frequency.exponentialRampToValueAtTime(f * 1.12, t0 + delay + dur);
    g.gain.setValueAtTime(0.0001, t0 + delay);
    g.gain.exponentialRampToValueAtTime(gain, t0 + delay + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
    o.connect(g).connect(out(c));
    o.start(t0 + delay);
    o.stop(t0 + delay + dur + 0.02);
  };
  mk(f1, 0, 0.07, 0.32);
  mk(f2, 0.07, 0.11, 0.32);
}

/** Long victorious jingle for defuse success — loud + cheerful. */
export function playDefuseJingle() {
  if (muted) return;
  const notes = [523, 659, 784, 1047, 880, 1047, 1319, 1568];
  notes.forEach((f, i) =>
    beep({ freq: f, dur: 0.18, type: "square", gain: 0.28, delay: i * 0.11 }),
  );
  // Sparkle layer
  [1568, 2093, 2637].forEach((f, i) =>
    beep({ freq: f, dur: 0.12, type: "triangle", gain: 0.18, delay: 0.9 + i * 0.08 }),
  );
}

// ---------------------------------------------------------------------------
// Techno kick layer — 4-on-the-floor on top of arcade music.
// ---------------------------------------------------------------------------

let _technoTimer: number | null = null;
function playKick() {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + 0.005;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t0);
  o.frequency.exponentialRampToValueAtTime(40, t0 + 0.14);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  o.connect(g).connect(out(c));
  o.start(t0);
  o.stop(t0 + 0.22);
}
/**
 * Kept for API compatibility — the kick is now generated inside the arcade
 * loop so the two layers are sample-aligned. These are no-ops.
 */
export function startTechnoLayer() {
  /* no-op: kick is now scheduled inside playArcadeLoopStep */
}
export function stopTechnoLayer() {
  if (typeof window !== "undefined" && _technoTimer) {
    window.clearInterval(_technoTimer);
    _technoTimer = null;
  }
}

/** Sample-accurate kick — scheduled on the same audio clock as the arcade loop. */
function playKickAt(c: AudioContext, t0: number, dest: AudioNode) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t0);
  o.frequency.exponentialRampToValueAtTime(40, t0 + 0.14);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + 0.22);
}

/** A fat, increasingly urgent arcade countdown — returns a stop function. */
export function startArcadeRise(durationMs: number): () => void {
  const c = ac();
  if (!c || muted || audioSuspended) return () => {};
  // Three-layer countdown: deep sub-bass thump + square body + saw bite.
  // Grows louder, higher and closer together as the fuse burns down.
  const total = durationMs / 1000;
  const started = c.currentTime + 0.05;
  const nodes: OscillatorNode[] = [];
  const hapticTimers: number[] = [];
  let t = 0;
  while (t < total - 0.1) {
    const p = t / total; // 0 → 1 across the trap window
    const t0 = started + t;
    const freq = 110 + p * 240;
    const sub = c.createOscillator();
    const o = c.createOscillator();
    const upper = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900 + p * 1800, t0);
    sub.type = "sine";
    sub.frequency.setValueAtTime(freq * 0.5, t0);
    sub.frequency.exponentialRampToValueAtTime(Math.max(35, freq * 0.3), t0 + 0.18);
    o.type = "square";
    upper.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(55, freq * 0.55), t0 + 0.16);
    upper.frequency.setValueAtTime(freq * 2, t0);
    upper.detune.setValueAtTime(9, t0);
    const dur = 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.34 + p * 0.5, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    sub.connect(g);
    o.connect(lp);
    upper.connect(lp);
    lp.connect(g);
    g.connect(out(c));
    [sub, o, upper].forEach((n) => {
      n.start(t0);
      n.stop(t0 + dur + 0.03);
      nodes.push(n);
    });
    // Haptic pulse in lockstep with each audio hit, intensity ramping up.
    if (typeof window !== "undefined") {
      const delay = Math.max(0, (t0 - c.currentTime) * 1000);
      const strength = Math.round(12 + p * 90);
      const pattern = p > 0.75 ? [strength, 40, strength] : strength;
      hapticTimers.push(
        window.setTimeout(() => {
          try { navigator.vibrate?.(pattern as number | number[]); } catch { /* ignore */ }
        }, delay),
      );
    }
    // Interval shrinks from a heavy 0.9s pulse to a frantic 0.16s pulse.
    t += 0.9 - p * 0.74;
  }
  return () => {
    hapticTimers.forEach((id) => window.clearTimeout(id));
    try { navigator.vibrate?.(0); } catch { /* ignore */ }
    nodes.forEach((o) => {
      try {
        o.stop(c.currentTime);
      } catch {
        /* already stopped */
      }
    });
  };
}


// ---------------------------------------------------------------------------
// Pause-cell jingle — bouncy major-scale chirp + handclap shaker, ~3 seconds.
// Returns a stop function so callers can cancel if the user advances early.
// ---------------------------------------------------------------------------
export function playPauseMusic(): () => void {
  if (muted || audioSuspended) return () => {};
  const c = ac();
  if (!c) return () => {};
  const stops: Array<() => void> = [];
  const start = c.currentTime + 0.05;
  // Cheerful C-major arpeggio looped twice over ~3s.
  const seq = [523, 659, 784, 1047, 1319, 1047, 784, 659];
  const stepDur = 0.18;
  for (let loop = 0; loop < 2; loop++) {
    seq.forEach((f, i) => {
      const t0 = start + (loop * seq.length + i) * stepDur;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 0.9);
      o.connect(g).connect(out(c));
      o.start(t0);
      o.stop(t0 + stepDur);
      stops.push(() => { try { o.stop(c.currentTime); } catch {} });
    });
  }
  // Light hand-clap on every other step.
  for (let i = 0; i < 16; i++) {
    if (i % 2 !== 1) continue;
    const t0 = start + i * stepDur;
    const len = Math.floor(c.sampleRate * 0.06);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < len; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0.18, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    src.connect(f).connect(g).connect(out(c));
    src.start(t0);
    src.stop(t0 + 0.08);
    stops.push(() => { try { src.stop(c.currentTime); } catch {} });
  }
  return () => stops.forEach((s) => s());
}