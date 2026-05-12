import bombMascot from "@/assets/bomb-mascot.png";
import type { CellType } from "@/lib/game";

const FLAVOR: Record<CellType, { label: string; color: string; emoji: string; fx?: "sweat" | "heavy-sweat" | "steam" | "zoom" | "tears" }> = {
  easy:    { label: "EASY PEASY!",   color: "var(--boom-yellow)", emoji: "😄", fx: undefined },
  medium:  { label: "GETTIN' SWEATY!", color: "var(--boom-orange)", emoji: "😅", fx: "sweat" },
  hard:    { label: "BEAST MODE!",   color: "var(--boom-red)",    emoji: "🥵🔥", fx: "heavy-sweat" },
  rest:    { label: "COFFEE BREAK!", color: "var(--boom-blue)",   emoji: "☕😌", fx: "steam" },
  boost:   { label: "ULTRA BLAST!",  color: "var(--boom-green)",  emoji: "⚡⚡⚡", fx: "zoom" },
  setback: { label: "OH NOOO!",      color: "#7c3aed",            emoji: "😭", fx: "tears" },
  start:   { label: "LET'S GO!",     color: "var(--boom-green)",  emoji: "🚀" },
  finish:  { label: "WINNER!",       color: "var(--boom-yellow)", emoji: "🏆" },
};

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
        <div className="relative" style={{ width: 140, height: 140 }}>
          <img
            src={bombMascot}
            alt=""
            width={1024}
            height={1024}
            className={`w-full h-full ${type === "setback" ? "" : "anim-mascot-bounce"}`}
            style={{
              filter:
                type === "hard"
                  ? "hue-rotate(-15deg) brightness(1.1) drop-shadow(0 0 20px #ff5)"
                  : type === "setback"
                    ? "grayscale(0.6) brightness(0.85)"
                    : type === "boost"
                      ? "drop-shadow(0 0 25px #ff0)"
                      : "drop-shadow(0 0 10px rgba(0,0,0,0.4))",
              transform: type === "setback" ? "rotate(8deg)" : undefined,
            }}
          />
          {/* Big emoji over the bomb's face */}
          <div
            className="absolute inset-0 flex items-center justify-center text-5xl"
            style={{ textShadow: "0 2px 6px rgba(0,0,0,0.45)" }}
          >
            {f.emoji}
          </div>
          {/* FX layers */}
          {f.fx === "sweat" && (
            <span className="absolute -right-1 top-6 text-2xl anim-sweat" style={{ animationDelay: "0s" }}>💧</span>
          )}
          {f.fx === "heavy-sweat" && (
            <>
              <span className="absolute -right-2 top-4 text-3xl anim-sweat">💦</span>
              <span className="absolute -left-2 top-8 text-2xl anim-sweat" style={{ animationDelay: "0.3s" }}>💧</span>
              <span className="absolute right-6 -top-1 text-2xl anim-sweat" style={{ animationDelay: "0.6s" }}>💧</span>
            </>
          )}
          {f.fx === "steam" && (
            <>
              <span className="absolute left-1/2 -top-2 -translate-x-1/2 text-3xl anim-steam">☁️</span>
              <span className="absolute left-1/3 -top-1 text-2xl anim-steam" style={{ animationDelay: "0.5s" }}>☁️</span>
              <span className="absolute right-1/3 -top-1 text-2xl anim-steam" style={{ animationDelay: "1s" }}>☁️</span>
            </>
          )}
          {f.fx === "zoom" && (
            <>
              <span className="absolute right-0 top-4 text-3xl anim-zoom">💨</span>
              <span className="absolute right-0 top-12 text-2xl anim-zoom" style={{ animationDelay: "0.15s" }}>💨</span>
              <span className="absolute right-0 top-20 text-3xl anim-zoom" style={{ animationDelay: "0.3s" }}>💨</span>
            </>
          )}
          {f.fx === "tears" && (
            <>
              <span className="absolute left-6 top-12 text-2xl anim-sweat" style={{ animationDelay: "0s" }}>💧</span>
              <span className="absolute right-6 top-12 text-2xl anim-sweat" style={{ animationDelay: "0.4s" }}>💧</span>
            </>
          )}
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
