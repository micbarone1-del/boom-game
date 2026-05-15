import bombMascot from "@/assets/bomb-mascot.png";

/** Big-screen kaboom! Shown for ~1.6s when a player runs out of time. */
export function ExplosionOverlay({ username }: { username: string }) {
  return (
    <div className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-center anim-explosion-flash">
      <div className="absolute inset-0 bg-[var(--boom-red)] opacity-70 anim-explosion-fade" />
      <div className="relative flex flex-col items-center gap-4 anim-explosion-pop">
        <img
          src={bombMascot}
          alt=""
          width={256}
          height={256}
          className="w-64 h-64 drop-shadow-[0_0_40px_rgba(255,80,0,0.9)]"
          style={{ filter: "hue-rotate(0deg) saturate(2)" }}
        />
        <div
          className="text-7xl font-black comic-shadow text-white"
          style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "0 0 20px #000, 4px 4px 0 #000" }}
        >
          💥 BOOM!
        </div>
        <div
          className="text-3xl font-black text-white"
          style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "2px 2px 0 #000" }}
        >
          {username} ran out of time!
        </div>
        <div
          className="text-xl font-black text-white opacity-90"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          Back to start ⏪
        </div>
      </div>
    </div>
  );
}