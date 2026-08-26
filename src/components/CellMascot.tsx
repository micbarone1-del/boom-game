import bombDefault from "@/assets/bomb-mascot.png";
import bombEasy from "@/assets/bomb-easy.png";
import bombMedium from "@/assets/bomb-medium.png";
import bombHard from "@/assets/bomb-hard.png";
import bombBoost from "@/assets/bomb-boost.png";
import bombSetback from "@/assets/bomb-setback.png";
import { useEffect } from "react";
import type { CellType } from "@/lib/game";
import { sfx, haptic } from "@/lib/sfx";

export const CELL_FLAVOR: Record<CellType, { label: string; color: string; img: string; sad?: boolean }> = {
  easy:    { label: "EASY PEASY!",    color: "var(--boom-yellow)", img: bombEasy },
  medium:  { label: "GETTIN' SWEATY!", color: "var(--boom-orange)", img: bombMedium },
  hard:    { label: "BEAST MODE!",    color: "var(--boom-red)",    img: bombHard },
  boost:   { label: "ULTRA BLAST!",   color: "var(--boom-green)",  img: bombBoost },
  setback: { label: "OH NOOO!",       color: "#7c3aed",            img: bombSetback, sad: true },
  surprise:{ label: "SURPRISE!",      color: "#ec4899",            img: bombDefault },
  crazy:   { label: "GO CRAZY!",      color: "#f97316",            img: bombHard },
  group:   { label: "ALL TOGETHER!",  color: "var(--boom-blue)",   img: bombDefault },
  pause:   { label: "PAUSE PARTY!",   color: "#22d3ee",            img: bombDefault },
  start:   { label: "LET'S GO!",      color: "var(--boom-green)",  img: bombDefault },
  finish:  { label: "WINNER!",        color: "var(--boom-yellow)", img: bombDefault },
};

export function mascotForCell(type: CellType): string {
  return CELL_FLAVOR[type].img;
}

const TRAP_JINGLE: Record<CellType, Parameters<typeof sfx.play>[0]> = {
  easy: "jingleEasy",
  medium: "jingleMedium",
  hard: "jingleHard",
  boost: "jingleBoost",
  setback: "jingleSetback",
  surprise: "jingleSurprise",
  crazy: "jingleCrazy",
  group: "jingleGroup",
  pause: "jinglePause",
  start: "jingleStart",
  finish: "winJingle",
};

const MASCOT_ENTRANCE: Record<CellType, string> = {
  easy: "mascot-enter-spring",
  medium: "mascot-enter-left",
  hard: "mascot-enter-slam",
  boost: "mascot-enter-rocket",
  setback: "mascot-enter-drop",
  surprise: "mascot-enter-spin",
  crazy: "mascot-enter-zigzag",
  group: "mascot-enter-wide",
  pause: "mascot-enter-float",
  start: "mascot-enter-spring",
  finish: "mascot-enter-slam",
};

export function CellMascot({ type, username }: { type: CellType; username?: string }) {
  // Cartoon "pop!" + a trap-specific jingle whenever the mascot springs on screen.
  useEffect(() => {
    if (type === "finish") return;
    sfx.play("trapPop");
    window.setTimeout(() => sfx.play(TRAP_JINGLE[type]), 130);
    haptic(type === "setback" ? "fail" : "success");
  }, [type]);
  // Finish has its own dedicated explosion overlay — skip the cell splash.
  if (type === "finish") return null;
  const f = CELL_FLAVOR[type];
  return (
    <div
      className="fixed z-[80] pointer-events-none anim-mascot-splash"
      style={{ top: "50%", left: "50%" }}
    >
      <div
        className="ink-border rounded-3xl px-6 pb-5 pt-28 flex flex-col items-center gap-2 relative"
        style={{ background: f.color, color: "white", minWidth: 260, overflow: "visible" }}
      >
        {/* Mascot bursts way out of the top of the frame instead of being clipped */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-36 w-64 h-64 max-w-[70vw] max-h-[70vw] pointer-events-none z-10"
        >
          <div className={`w-full h-full ${MASCOT_ENTRANCE[type]}`}>
            <img
              src={f.img}
              alt=""
              width={1024}
              height={1024}
              className={`w-full h-full object-contain ${f.sad ? "anim-mascot-sad-idle" : "anim-mascot-bounce"} drop-shadow-[0_10px_0_rgba(0,0,0,0.35)] drop-shadow-[0_0_24px_rgba(0,0,0,0.55)]`}
            />
          </div>
        </div>

        <div
          className="text-3xl font-black comic-shadow"
          style={{ fontFamily: "'Luckiest Guy', cursive", lineHeight: 1 }}
        >
          {f.label}
        </div>
        {username && (
          <div className="text-sm font-black opacity-95">{username}</div>
        )}
      </div>
    </div>
  );
}
