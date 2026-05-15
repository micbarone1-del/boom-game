import { useEffect, useRef, useState } from "react";

/**
 * Shows a big 3-2-1 countdown until `startAt` (epoch ms). Renders nothing once
 * the countdown is finished. Uses the same anchor on every client so phones
 * and the gym screen stay in sync.
 */
export function CountdownIntro({
  startAt,
  color = "var(--boom-red)",
  align = "center",
  inline = false,
  paused = false,
}: {
  startAt: number;
  color?: string;
  align?: "center" | "right";
  inline?: boolean;
  paused?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  const frozenNowRef = useRef<number | null>(null);
  useEffect(() => {
    if (paused) {
      frozenNowRef.current = Date.now();
      setNow(frozenNowRef.current);
      return;
    }
    frozenNowRef.current = null;
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, [paused]);
  const displayNow = paused && frozenNowRef.current ? frozenNowRef.current : now;
  const remaining = startAt - displayNow;
  if (remaining <= 0) return null;
  // Only show the 3-2-1 numbers in the final 3.5s before start, regardless of
  // how far in the future the anchor is. This lets the host pad the anchor
  // with extra lead time (for hop + landing animations) without showing big
  // numbers like "5" or "6" first.
  if (remaining > 3500) return null;
  const n = Math.min(3, Math.max(1, Math.ceil(remaining / 1000)));
  if (inline) {
    return (
      <span
        key={n}
        className="anim-pop inline-flex items-center justify-center tabular-nums"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          fontSize: "clamp(3rem, 10vmin, 5rem)",
          color: "var(--boom-red)",
          lineHeight: 1,
          textShadow: "0 4px 0 rgba(0,0,0,0.25)",
        }}
      >
        {n}
      </span>
    );
  }
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
