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

let ctx: AudioContext | null = null;
let muted = false;
let unlocked = false;
const MUTE_KEY = "boom.sfx.muted";

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {}
  // Unlock the AudioContext on EVERY user gesture (cheap; self-guards).
  // Browsers (and sandboxed preview iframes) block audio until a gesture
  // occurs, and ctx.resume() must be called synchronously inside that
  // gesture. We re-run on every gesture so an unlock that gets blocked
  // because of an early call (before the context existed) still recovers.
  const unlock = () => {
    try {
      const c = ac();
      if (!c) return;
      if (c.state === "suspended") void c.resume().then(() => { unlocked = true; }).catch(() => {});
      // Play a near-silent buffer to fully unlock on iOS/Safari.
      const buf = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start(0);
      if (c.state === "running") unlocked = true;
    } catch {}
  };
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("touchstart", unlock, opts);
  window.addEventListener("mousedown", unlock, opts);
  window.addEventListener("click", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume().then(() => { unlocked = true; }).catch(() => {});
  return ctx;
}

/** Pick a safe scheduling start time. If the context is still warming up,
 *  push everything ~60ms into the future so the gain ramp doesn't get
 *  clipped by the resume transition (the #1 cause of "I hear nothing"). */
function safeStart(c: AudioContext, requestedDelay = 0): number {
  const pad = c.state === "running" ? 0.005 : 0.06;
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
  osc.connect(g).connect(c.destination);
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
    src.connect(f).connect(g).connect(c.destination);
  } else {
    src.connect(g).connect(c.destination);
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
      if (c && c.state !== "running") {
        // Try to resume; if blocked, log once so debugging is obvious.
        void c.resume().catch(() => {});
        if (c.state === "suspended" && !unlocked) {
          // No user gesture has unlocked audio yet. Schedule anyway —
          // safeStart() pads start time so the sound plays once unlocked.
          if (!(window as any).__sfxWarned) {
            (window as any).__sfxWarned = true;
            console.warn("[sfx] AudioContext suspended — click anywhere to enable sound.");
          }
        }
      }
      effects[name]();
    } catch {
      // Audio context might be blocked before first user interaction — ignore.
    }
  },
  isMuted() {
    return muted;
  },
  setMuted(v: boolean) {
    muted = v;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(MUTE_KEY, v ? "1" : "0");
      } catch {}
    }
  },
  toggleMuted() {
    this.setMuted(!muted);
    return muted;
  },
};