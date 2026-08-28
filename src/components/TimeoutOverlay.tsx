import { useEffect, useRef, useState } from "react";
import bombMascot from "@/assets/bomb-mascot.png";
import { sfx, speak, playTimesOut, playGameOver, haptic } from "@/lib/sfx";
import { RotateCcw, Play, Flag } from "lucide-react";

/**
 * Fullscreen "TIME'S OUT" continue countdown. Giant number, two chunky
 * buttons. Tapping anywhere on the backdrop burns a second off the clock.
 */
export function TimesOutOverlay({
  continueDeadlineAt,
  onContinue,
  onGiveUp,
  showContinue,
}: {
  continueDeadlineAt: number;
  onContinue?: () => void;
  onGiveUp?: () => void;
  showContinue: boolean;
}) {
  const [burned, setBurned] = useState(0);
  const [, force] = useState(0);
  const expired = useRef(false);

  useEffect(() => {
    playTimesOut();
    haptic("boom");
    const i = setInterval(() => force((n) => n + 1), 150);
    return () => clearInterval(i);
  }, []);

  const remaining = Math.max(
    0,
    Math.ceil((continueDeadlineAt - burned - Date.now()) / 1000),
  );

  useEffect(() => {
    if (remaining > 0 || expired.current) return;
    expired.current = true;
    onGiveUp?.();
  }, [remaining, onGiveUp]);

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col items-center justify-center anim-explosion-flash"
      onPointerDown={() => {
        // Tapping the screen makes the fuse burn faster.
        setBurned((b) => b + 1000);
        sfx.play("tick");
        haptic("tap");
      }}
    >
      <div className="absolute inset-0 bg-[var(--boom-red)] opacity-90" />
      <div className="relative flex flex-col items-center gap-2 px-4 text-center w-full">
        <img src={bombMascot} alt="" className="w-24 h-24 anim-fuse drop-shadow-[0_0_40px_rgba(255,80,0,.9)]" />
        <div
          className="text-5xl md:text-7xl font-black text-white"
          style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "4px 4px 0 #000, 0 0 20px #000" }}
        >
          TIME'S OUT!
        </div>
        {/* Giant full-screen number */}
        <div
          className="font-black text-white tabular-nums leading-none anim-pop"
          key={remaining}
          style={{
            fontFamily: "'Luckiest Guy', cursive",
            fontSize: "clamp(8rem, 46vw, 22rem)",
            textShadow: "8px 8px 0 #000",
          }}
        >
          {remaining}
        </div>
        <div className="flex flex-col gap-3 w-full max-w-sm mt-2">
          {showContinue && onContinue && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onContinue();
              }}
              className="btn-massive"
              style={{ background: "var(--boom-yellow)", color: "var(--boom-ink)" }}
            >
              <Play size={34} fill="currentColor" /> CONTINUE
            </button>
          )}
          {onGiveUp && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                expired.current = true;
                onGiveUp();
              }}
              className="btn-massive"
              style={{ background: "#111", color: "#fff" }}
            >
              <Flag size={30} /> GIVE UP
            </button>
          )}
        </div>
        <div className="text-white/90 text-xs font-black mt-1">Tap the screen to burn the fuse faster</div>
      </div>
    </div>
  );
}

export function GameOverOverlay({
  onRestart,
  onLeaderboard,
  onHome,
}: {
  onRestart?: () => void;
  onLeaderboard?: () => void;
  onHome?: () => void;
}) {
  useEffect(() => {
    playGameOver();
    haptic("warn");
    if (!onHome) return;
    // Big GAME OVER, then back to the start screen.
    const t = window.setTimeout(() => onHome(), 5000);
    return () => window.clearTimeout(t);
  }, [onHome]);
  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/95 px-4">
      <img src={bombMascot} alt="" className="w-32 h-32 opacity-60 mb-4" />
      <div
        className="text-6xl md:text-9xl font-black text-[var(--boom-red)] text-center leading-none"
        style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "5px 5px 0 #fff, 0 0 30px #ff0000" }}
      >
        GAME OVER
      </div>
      <div className="text-white opacity-80 mt-3 text-lg font-bold">Nobody finished in time.</div>
      <div className="flex gap-3 mt-6 flex-wrap justify-center px-4">
        {onLeaderboard && (
          <button
            onClick={onLeaderboard}
            className="btn-boom text-xl py-3 px-6 flex items-center gap-2"
            style={{ background: "var(--boom-green)", color: "#fff", fontFamily: "'Luckiest Guy', cursive" }}
          >
            VIEW LEADERBOARD
          </button>
        )}
        {onRestart && (
          <button
            onClick={onRestart}
            className="btn-boom text-xl py-3 px-6 flex items-center gap-2"
            style={{ background: "var(--boom-yellow)", color: "var(--boom-ink)", fontFamily: "'Luckiest Guy', cursive" }}
          >
            <RotateCcw /> RESTART POD
          </button>
        )}
      </div>
    </div>
  );
}

void sfx;
void speak;
