import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

export function FuseTimer({ startedAt, big = false, color, hideBeforeStart = false }: { startedAt: number; big?: boolean; color?: string; hideBeforeStart?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);
  const anchor = startedAt && !Number.isNaN(startedAt) ? startedAt : now;
  const elapsed = Math.max(0, now - anchor);
  if (hideBeforeStart && now < anchor) return null;
  const sec = (elapsed / 1000).toFixed(1);
  return (
    <div className={`inline-flex items-center gap-2 ${big ? "text-6xl" : "text-2xl"} font-bold tabular-nums`}
         style={{ color: color ?? "var(--boom-yellow)" }}>
      <Flame className="anim-fuse" fill="currentColor" size={big ? 64 : 28} />
      <span style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 600 }}>{sec}s</span>
    </div>
  );
}
