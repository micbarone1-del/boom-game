import { useEffect, useState } from "react";

/**
 * Shows a big 3-2-1 countdown until `startAt` (epoch ms). Renders nothing once
 * the countdown is finished. Uses the same anchor on every client so phones
 * and the gym screen stay in sync.
 */
export function CountdownIntro({
  startAt,
  color = "var(--boom-red)",
  align = "center",
}: {
  startAt: number;
  color?: string;
  align?: "center" | "right";
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);
  const remaining = startAt - now;
  if (remaining <= 0) return null;
  const n = Math.max(1, Math.ceil(remaining / 1000));
  const positionClass =
    align === "right"
      ? "fixed top-4 right-4 z-[80] pointer-events-none"
      : "fixed top-4 left-1/2 -translate-x-1/2 z-[80] pointer-events-none";
  return (
    <div className={positionClass}>
      <div
        key={n}
        className="anim-pop comic-shadow rounded-full ink-border bg-white flex items-center justify-center"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          fontSize: "clamp(3rem, 12vmin, 6rem)",
          color,
          lineHeight: 1,
          width: "clamp(5rem, 18vmin, 9rem)",
          height: "clamp(5rem, 18vmin, 9rem)",
          textShadow: "0 4px 0 rgba(0,0,0,0.25)",
        }}
      >
        {n}
      </div>
    </div>
  );
}
