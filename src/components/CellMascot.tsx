import bombDefault from "@/assets/bomb-mascot.png";
import bombEasy from "@/assets/bomb-easy.png";
import bombMedium from "@/assets/bomb-medium.png";
import bombHard from "@/assets/bomb-hard.png";
import bombRest from "@/assets/bomb-rest.png";
import bombBoost from "@/assets/bomb-boost.png";
import bombSetback from "@/assets/bomb-setback.png";
import type { CellType } from "@/lib/game";

const FLAVOR: Record<CellType, { label: string; color: string; img: string; sad?: boolean }> = {
  easy:    { label: "EASY PEASY!",    color: "var(--boom-yellow)", img: bombEasy },
  medium:  { label: "GETTIN' SWEATY!", color: "var(--boom-orange)", img: bombMedium },
  hard:    { label: "BEAST MODE!",    color: "var(--boom-red)",    img: bombHard },
  rest:    { label: "COFFEE BREAK!",  color: "var(--boom-blue)",   img: bombRest },
  boost:   { label: "ULTRA BLAST!",   color: "var(--boom-green)",  img: bombBoost },
  setback: { label: "OH NOOO!",       color: "#7c3aed",            img: bombSetback, sad: true },
  start:   { label: "LET'S GO!",      color: "var(--boom-green)",  img: bombDefault },
  finish:  { label: "WINNER!",        color: "var(--boom-yellow)", img: bombDefault },
};

export function mascotForCell(type: CellType): string {
  return FLAVOR[type].img;
}

export function CellMascot({ type, username }: { type: CellType; username?: string }) {
  const f = FLAVOR[type];
  return (
    <div
      className="fixed z-[80] pointer-events-none anim-mascot-splash"
      style={{ top: "50%", left: "50%" }}
    >
      <div
        className="ink-border rounded-3xl px-6 py-5 flex flex-col items-center gap-2 relative"
        style={{ background: f.color, color: "white", minWidth: 260 }}
      >
        <img
          src={f.img}
          alt=""
          width={1024}
          height={1024}
          className={`w-40 h-40 ${f.sad ? "" : "anim-mascot-bounce"} drop-shadow-[0_0_20px_rgba(0,0,0,0.4)]`}
        />
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
