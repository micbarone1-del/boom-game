import { Flame } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Horizontal fuse bar. Burns left → right between startedAt and endsAt.
 * Flame sits at the burn point, charred trail to its left.
 */
export function FuseBar({
  startedAt,
  endsAt,
  paused = false,
  height = 18,
}: {
  startedAt: number | null;
  endsAt: number | null;
  paused?: boolean;
  height?: number;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    if (paused) return;
    const i = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(i);
  }, [paused]);

  if (!startedAt || !endsAt) return null;
  const total = Math.max(1, endsAt - startedAt);
  const elapsed = Math.max(0, Math.min(total, Date.now() - startedAt));
  const p = elapsed / total;
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex justify-between items-center text-xs font-black px-1" style={{ color: "var(--boom-ink)" }}>
        <span style={{ fontFamily: "'Luckiest Guy', cursive" }}>FUSE</span>
        <span style={{ fontFamily: "'Luckiest Guy', cursive", color: p > 0.8 ? "var(--boom-red)" : "var(--boom-ink)" }}>
          {mm}:{ss}
        </span>
      </div>
      <div
        className="relative w-full ink-border-sm rounded-full overflow-visible"
        style={{ height, background: "#fff8e6" }}
      >
        {/* Charred trail */}
        <div
          className="absolute inset-y-0 left-0 transition-all duration-500"
          style={{ width: `${p * 100}%`, background: "linear-gradient(90deg, #222 0%, #444 60%, #7a3a0c 100%)" }}
        />
        {/* Unburnt fuse */}
        <div
          className="absolute inset-y-0 right-0 transition-all duration-500"
          style={{
            width: `${(1 - p) * 100}%`,
            background:
              "repeating-linear-gradient(45deg, #f59e0b 0 6px, #fbbf24 6px 12px)",
          }}
        />
        {/* Flame head */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 anim-fuse"
          style={{ left: `${p * 100}%` }}
        >
          <Flame size={height + 14} fill="var(--boom-red)" color="var(--boom-yellow)" style={{ filter: "drop-shadow(0 0 6px rgba(255,80,0,.9))" }} />
        </div>
      </div>
    </div>
  );
}