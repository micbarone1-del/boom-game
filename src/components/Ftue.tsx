import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Camera, Dice5, Dumbbell, Smartphone } from "lucide-react";
import { BombAvatar } from "@/components/BombAvatar";

/**
 * First-Time User Experience engine.
 *
 * Each tip is shown at most once per profile (per browser profile key) and
 * blocks the game with a big high-contrast modal until "GOT IT!" is tapped.
 */
export type FtueKey = "roll" | "switch" | "judge";

const TIPS: Record<FtueKey, { title: string; body: string; color: string }> = {
  roll: {
    title: "HOW IT WORKS",
    body: "Roll, hop, see your exercise.",
    color: "var(--boom-yellow)",
  },
  switch: {
    title: "PASS THE PHONE",
    body: "Give the phone to the next player — they are the judge.",
    color: "var(--boom-orange)",
  },
  judge: {
    title: "SWEAT!",
    body: "Do the exercise while the judge films you.",
    color: "var(--boom-red)",
  },
};

function storeKey(profile: string, key: FtueKey) {
  return `boom.ftue.${profile}.${key}`;
}

const DISABLED_KEY = "boom.ftue.disabled";

/** Global kill-switch for all tutorial pop-ups (all profiles). */
export function ftueDisabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISABLED_KEY) === "1";
  } catch {
    return true;
  }
}

export function setFtueDisabled(off: boolean) {
  try {
    window.localStorage.setItem(DISABLED_KEY, off ? "1" : "0");
  } catch {
    /* private mode */
  }
}

/** Clears every "seen" flag so tips show again from the next screen on. */
export function resetFtue() {
  try {
    const del: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("boom.ftue.") && k !== DISABLED_KEY) del.push(k);
    }
    del.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* private mode */
  }
}

function seen(profile: string, key: FtueKey) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(storeKey(profile, key)) === "1";
  } catch {
    return true;
  }
}

/**
 * Returns `showing` (true while the tip modal is up) plus the modal element.
 * Callers gate their own game logic on `showing`.
 */
export function useFtue(profile: string | null | undefined, key: FtueKey) {
  const id = profile ?? "guest";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    if (ftueDisabled()) return;
    if (seen(id, key)) return;
    setOpen(true);
  }, [profile, id, key]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(storeKey(id, key), "1");
    } catch {
      /* private mode — just close */
    }
    setOpen(false);
  }, [id, key]);

  const modal = open ? <FtueModal tipKey={key} onDismiss={dismiss} /> : null;
  return { showing: open, modal, dismiss };
}

export function FtueModal({ tipKey, onDismiss }: { tipKey: FtueKey; onDismiss: () => void }) {
  const tip = TIPS[tipKey];
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/80">
      <div
        className="arcade-card arcade-vs-in w-full max-w-md bg-white p-6 flex flex-col items-center gap-5 text-center"
        style={{ boxShadow: "8px 8px 0 0 #000" }}
      >
        <TutorialIllustration tipKey={tipKey} color={tip.color} />
        <h2
          className="arcade-heading"
          style={{ color: tip.color, fontSize: "clamp(2rem, 9vw, 3rem)", lineHeight: 1 }}
        >
          {tip.title}
        </h2>
        <p
          className="font-black"
          style={{ color: "var(--boom-ink)", fontSize: "clamp(1.15rem, 5vw, 1.5rem)", lineHeight: 1.2 }}
        >
          {tip.body}
        </p>
        <button onClick={onDismiss} className="btn-massive w-full" style={{ background: "var(--boom-green)" }}>
          GOT IT!
        </button>
        <button
          onClick={() => {
            setFtueDisabled(true);
            onDismiss();
          }}
          className="ink-border-sm rounded-xl bg-white px-4 py-2 text-base font-black uppercase active:scale-95"
          style={{ color: "var(--boom-ink)" }}
        >
          Turn tips off
        </button>
      </div>
    </div>
  );
}

function TutorialIllustration({ tipKey, color }: { tipKey: FtueKey; color: string }) {
  return (
    <div
      className="relative h-44 w-full overflow-hidden rounded-3xl ink-border-sm"
      style={{ background: color }}
      aria-label={tipKey === "judge" ? "A judge filming another player exercising" : undefined}
    >
      {tipKey === "roll" && (
        <div className="absolute inset-0 flex items-center justify-center gap-4">
          <div className="anim-ui-float rounded-2xl bg-white p-3 ink-border-sm">
            <Dice5 size={62} strokeWidth={3} />
          </div>
          <ArrowRight size={42} strokeWidth={4} />
          <div className="grid grid-cols-2 gap-1 rotate-3">
            {["1", "2", "3", "4"].map((n) => (
              <span key={n} className="grid h-12 w-12 place-items-center rounded-lg bg-white text-2xl font-black ink-border-sm">{n}</span>
            ))}
          </div>
        </div>
      )}
      {tipKey === "switch" && (
        <div className="absolute inset-0 flex items-center justify-around px-3">
          <BombAvatar color="#ec4899" size={74} />
          <div className="anim-ui-float rounded-2xl bg-white p-3 ink-border-sm">
            <Smartphone size={58} strokeWidth={3} />
          </div>
          <ArrowRight size={42} strokeWidth={4} />
          <BombAvatar color="#22d3ee" size={74} />
        </div>
      )}
      {tipKey === "judge" && (
        <div className="absolute inset-0 flex items-end justify-between px-5 pb-3">
          <div className="relative flex flex-col items-center">
            <div className="relative z-10 -mb-3 rounded-xl bg-white p-2 ink-border-sm anim-ui-float">
              <Smartphone size={42} strokeWidth={3} />
              <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[var(--boom-red)] ring-2 ring-white" />
            </div>
            <BombAvatar color="#22d3ee" size={78} />
            <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-black ink-border-sm">JUDGE</span>
          </div>
          <Camera className="mb-14" size={38} strokeWidth={3} />
          <div className="flex flex-col items-center">
            <Dumbbell className="anim-ui-float" size={48} strokeWidth={3} />
            <BombAvatar color="#ec4899" size={92} persona="wild" />
            <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-black ink-border-sm">PLAYER</span>
          </div>
        </div>
      )}
    </div>
  );
}
