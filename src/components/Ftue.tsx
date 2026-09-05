import { useCallback, useEffect, useState } from "react";
import "@/lib/boot-defaults";
import { Expand, Share, Volume2 } from "lucide-react";
import { enterFullscreen, setupNeeds } from "@/lib/device";
import cheerPeople from "@/assets/tutorial-people/cheer.png.asset.json";
import exercisePerson from "@/assets/tutorial-people/exercise.png.asset.json";
import joinPerson from "@/assets/tutorial-people/join.png.asset.json";
import judgePerson from "@/assets/tutorial-people/judge.png.asset.json";
import passPeople from "@/assets/tutorial-people/pass.png.asset.json";
import rollPerson from "@/assets/tutorial-people/roll.png.asset.json";


/**
 * First-Time User Experience engine.
 *
 * Each tip is shown at most once per profile (per browser profile key) and
 * blocks the game with a big high-contrast modal until "GOT IT!" is tapped.
 */
export type FtueKey = "roll" | "switch" | "judge" | "defuse" | "lobby" | "podform";

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
  defuse: {
    title: "TAP TO DEFUSE!",
    body: "Judge: tap the big DEFUSE button once for every good rep — before the fuse runs out!",
    color: "var(--boom-blue)",
  },
  lobby: {
    title: "GET READY!",
    body: "Two quick phone settings so the game feels like a real app.",
    color: "var(--boom-green)",
  },
  podform: {
    title: "BUILD YOUR POD",
    body: "Tap a free slot to add players. When everybody is in, hit READY.",
    color: "var(--boom-blue)",
  },
};


/** Re-enables tips and clears every "seen" flag (used by the ? help button). */
export function replayFtue() {
  setFtueDisabled(false);
  resetFtue();
}

const FTUE_VERSION = "v5";

function storeKey(profile: string, key: FtueKey) {
  return `boom.ftue.${FTUE_VERSION}.${profile}.${key}`;
}

// Version this preference alongside the refreshed tutorial so players who
// disabled an older iteration still see the newly requested walkthrough once.
// Tutorial is ON by default; only an explicit "1" turns it off.
const DISABLED_KEY = "boom.ftue.disabled.v5";

/** Global kill-switch for all tutorial pop-ups (all profiles). */
export function ftueDisabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISABLED_KEY) === "1";
  } catch {
    // Storage blocked (iOS private browsing) — tutorial stays ON by default.
    return false;
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
    // Can't remember — better to show the tip than to silently skip it.
    return false;
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
    // Device-aware: skip the setup card entirely when this phone needs nothing
    // (already installed / no silent switch / already fullscreen).
    if (key === "lobby") {
      const n = setupNeeds();
      if (!n.needsSilentSwitch && !n.needsAddToHomeScreen && !n.canOneTapFullscreen) return;
    }
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
  // Setup card adapts to the actual device: iPhones get the ringer + Add to
  // Home Screen steps, everyone else gets one tap to fullscreen.
  const [needs] = useState(() => (tipKey === "lobby" ? setupNeeds() : null));
  const [fs, setFs] = useState(false);
  const body =
    tipKey === "lobby" && needs
      ? needs.platform === "ios"
        ? needs.needsAddToHomeScreen
          ? "Two quick iPhone settings so the game feels like a real app."
          : "One quick iPhone setting so you can hear the game."
        : "One tap and the game takes over your whole screen."
      : tip.body;
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
          {body}
        </p>
        {needs?.canOneTapFullscreen && (
          <button
            onClick={async () => setFs(await enterFullscreen())}
            className="btn-massive w-full flex items-center justify-center gap-3"
            style={{ background: fs ? "var(--boom-blue)" : "var(--boom-orange)" }}
          >
            <Expand size={30} strokeWidth={4} />
            {fs ? "FULLSCREEN ON" : "GO FULLSCREEN"}
          </button>
        )}
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
  const image = {
    roll: rollPerson,
    switch: passPeople,
    judge: judgePerson,
    defuse: exercisePerson,
    lobby: joinPerson,
    podform: cheerPeople,
  }[tipKey];

  const labels: Record<FtueKey, string> = {
    roll: "Player using the phone to roll",
    switch: "Players passing the phone",
    judge: "Judge filming the exercise",
    defuse: "Player completing the exercise",
    lobby: "Player holding the game phone",
    podform: "A pod ready to play",
  };

  return (
    <div
      className="relative h-52 w-full overflow-hidden rounded-3xl ink-border-sm"
      style={{ background: color }}
    >
      <img
        src={image.url}
        alt={labels[tipKey]}
        className="absolute inset-0 h-full w-full object-contain object-bottom anim-ui-float"
        style={{ transform: tipKey === "judge" || tipKey === "defuse" ? "scale(1.2) translateY(7%)" : "scale(1.08)" }}
      />
      {tipKey === "lobby" && <LobbySetupSteps />}
    </div>
  );
}

/** Device-aware setup steps: only what this specific phone actually needs. */
function LobbySetupSteps() {
  const [needs] = useState(() => setupNeeds());
  const steps: { icon: React.ReactNode; text: string }[] = [];
  if (needs.needsSilentSwitch) {
    steps.push({ icon: <Volume2 size={32} strokeWidth={3} />, text: "Flip the silent switch OFF for sound" });
  }
  if (needs.needsAddToHomeScreen) {
    steps.push({ icon: <Share size={32} strokeWidth={3} />, text: "Tap Share → Add to Home Screen for fullscreen" });
  }
  if (needs.canOneTapFullscreen) {
    steps.push({ icon: <Expand size={32} strokeWidth={3} />, text: "Tap GO FULLSCREEN below" });
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
      {steps.map((s, i) => (
        <div
          key={i}
          className={`flex w-full items-center gap-3 rounded-2xl bg-white p-3 ink-border-sm ${i === 0 ? "anim-ui-float" : ""}`}
        >
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-black text-white text-2xl font-black">
            {i + 1}
          </div>
          <div className="flex flex-1 items-center gap-2 text-left">
            {s.icon}
            <span className="text-base font-black leading-tight">{s.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
