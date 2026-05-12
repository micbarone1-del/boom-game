import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

export function FuseTimer({ startedAt, big = false }: { startedAt: number; big?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);
  const elapsed = Math.max(0, now - startedAt);
  const sec = (elapsed / 1000).toFixed(1);
  return (
    <div className={`inline-flex items-center gap-2 ${big ? "text-6xl" : "text-2xl"} font-black comic-shadow`}
         style={{ color: "var(--boom-yellow)" }}>
      <Flame className="anim-fuse" fill="currentColor" size={big ? 64 : 28} />
      <span style={{ fontFamily: "'Luckiest Guy', cursive" }}>{sec}s</span>
    </div>
  );
}
