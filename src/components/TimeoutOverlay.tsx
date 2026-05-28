import { useEffect, useState } from "react";
import bombMascot from "@/assets/bomb-mascot.png";
import { sfx, speak, playTimesOut, playGameOver } from "@/lib/sfx";
import { RotateCcw } from "lucide-react";

export function TimesOutOverlay({
  continueDeadlineAt,
  onContinue,
  showContinue,
}: {
  continueDeadlineAt: number;
  onContinue?: () => void;
  showContinue: boolean;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    playTimesOut();
    const i = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(i);
  }, []);
  const remaining = Math.max(0, Math.ceil((continueDeadlineAt - Date.now()) / 1000));
  return (
    <div className="fixed inset-0 z-[140] flex flex-col items-center justify-center anim-explosion-flash">
      <div className="absolute inset-0 bg-[var(--boom-red)] opacity-80" />
      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <img src={bombMascot} alt="" className="w-40 h-40 anim-fuse drop-shadow-[0_0_40px_rgba(255,80,0,.9)]" />
        <div
          className="text-6xl md:text-8xl font-black text-white"
          style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "4px 4px 0 #000, 0 0 20px #000" }}
        >
          TIME'S OUT!
        </div>
        <div
          className="text-7xl font-black text-white tabular-nums"
          style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #000" }}
        >
          {remaining}
        </div>
        {showContinue && onContinue && (
          <button
            onClick={onContinue}
            className="btn-boom mt-2 text-3xl py-4 px-8"
            style={{ background: "var(--boom-yellow)", color: "var(--boom-ink)", fontFamily: "'Luckiest Guy', cursive" }}
          >
            CONTINUE!
          </button>
        )}
        {!showContinue && (
          <div className="text-xl font-black text-white opacity-90" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            Waiting for a pod to continue…
          </div>
        )}
      </div>
    </div>
  );
}

export function GameOverOverlay({
  onRestart,
  onLeaderboard,
}: {
  onRestart?: () => void;
  onLeaderboard?: () => void;
}) {
  useEffect(() => {
    playGameOver();
  }, []);
  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/90">
      <img src={bombMascot} alt="" className="w-32 h-32 opacity-60 mb-4" />
      <div
        className="text-7xl md:text-9xl font-black text-[var(--boom-red)]"
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