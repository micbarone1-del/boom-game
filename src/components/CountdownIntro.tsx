import { useEffect, useState } from "react";

/**
 * Shows a big 3-2-1 countdown until `startAt` (epoch ms). Renders nothing once
 * the countdown is finished. Uses the same anchor on every client so phones
 * and the gym screen stay in sync.
 */
export function CountdownIntro({ startAt, color = "white" }: { startAt: number; color?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);
  const remaining = startAt - now;
  if (remaining <= 0) return null;
  const n = Math.max(1, Math.ceil(remaining / 1000));
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
      <div
        key={n}
        className="anim-pop comic-shadow"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          fontSize: "clamp(12rem, 50vmin, 28rem)",
          color,
          lineHeight: 1,
          textShadow: "0 8px 0 rgba(0,0,0,0.35)",
        }}
      >
        {n}
      </div>
    </div>
  );
}
