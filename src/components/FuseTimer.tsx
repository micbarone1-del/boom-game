import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";

export function FuseTimer({ startedAt, big = false, color }: { startedAt: number; big?: boolean; color?: string }) {
  const [now, setNow] = useState(Date.now());
  // Anchor: if startedAt is missing, in the future, or far in the past due to clock skew
  // between clients, fall back to the moment this timer mounts so it always counts up from 0.
  const anchor = useMemo(() => {
    const local = Date.now();
    if (!startedAt || Number.isNaN(startedAt)) return local;
    if (startedAt > local + 1000) return local; // clock skew (future)
    return startedAt;
  }, [startedAt]);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);
  const elapsed = Math.max(0, now - anchor);
  const sec = (elapsed / 1000).toFixed(1);
  return (
    <div className={`inline-flex items-center gap-2 ${big ? "text-6xl" : "text-2xl"} font-black comic-shadow`}
         style={{ color: color ?? "var(--boom-yellow)" }}>
      <Flame className="anim-fuse" fill="currentColor" size={big ? 64 : 28} />
      <span style={{ fontFamily: "'Luckiest Guy', cursive" }}>{sec}s</span>
    </div>
  );
}
