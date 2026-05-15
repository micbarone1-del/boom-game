import { useEffect, useRef, useState } from "react";
import { Flame } from "lucide-react";

export function FuseTimer({
  startedAt,
  big = false,
  color,
  hideBeforeStart = false,
  paused = false,
}: {
  startedAt: number;
  big?: boolean;
  color?: string;
  hideBeforeStart?: boolean;
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
  const anchor = startedAt && !Number.isNaN(startedAt) ? startedAt : now;
  const elapsed = Math.max(0, displayNow - anchor);
  if (hideBeforeStart && displayNow < anchor) return null;
  const sec = (elapsed / 1000).toFixed(1);
  return (
    <div
      className={`inline-flex items-center gap-2 ${big ? "text-6xl" : "text-2xl"} font-bold tabular-nums`}
      style={{ color: color ?? "var(--boom-yellow)" }}
    >
      <Flame className="anim-fuse" fill="currentColor" size={big ? 64 : 28} />
      <span style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontWeight: 600 }}>
        {sec}s
      </span>
    </div>
  );
}
