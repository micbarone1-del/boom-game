import { useCallback, useEffect, useState } from "react";
import { Dice5, Hand, Video } from "lucide-react";

/**
 * First-Time User Experience engine.
 *
 * Each tip is shown at most once per profile (per browser profile key) and
 * blocks the game with a big high-contrast modal until "GOT IT!" is tapped.
 */
export type FtueKey = "roll" | "switch" | "judge";

const TIPS: Record<FtueKey, { title: string; body: string; icon: typeof Dice5; color: string }> = {
  roll: {
    title: "HOW IT WORKS",
    body: "Roll, hop, see your exercise.",
    icon: Dice5,
    color: "var(--boom-yellow)",
  },
  switch: {
    title: "PASS THE PHONE",
    body: "Give the phone to the next player — they are the judge.",
    icon: Hand,
    color: "var(--boom-orange)",
  },
  judge: {
    title: "SWEAT!",
    body: "Do the exercise while the judge films you.",
    icon: Video,
    color: "var(--boom-red)",
  },
};

function storeKey(profile: string, key: FtueKey) {
  return `boom.ftue.${profile}.${key}`;
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
  const Icon = tip.icon;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/80">
      <div
        className="arcade-card arcade-vs-in w-full max-w-md bg-white p-6 flex flex-col items-center gap-5 text-center"
        style={{ boxShadow: "8px 8px 0 0 #000" }}
      >
        <div
          className="rounded-3xl p-5"
          style={{ background: tip.color, border: "5px solid #111", boxShadow: "6px 6px 0 #111" }}
        >
          <Icon size={72} strokeWidth={2.8} style={{ color: "var(--boom-ink)" }} />
        </div>
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
      </div>
    </div>
  );
}
