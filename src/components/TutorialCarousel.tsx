import { useEffect, useState } from "react";
import { Smartphone, Bomb, Gavel, Clock } from "lucide-react";

const SLIDES = [
  {
    Icon: Smartphone,
    text: "YOUR PHONE IS THE REMOTE",
    sub: "scan or click to join the lobby",
    color: "var(--boom-yellow)",
  },
  {
    Icon: Bomb,
    text: "TRAPS = PARTY WORKOUTS",
    sub: "land on a BOOM for fun fitness challenges",
    color: "var(--boom-red)",
  },
  {
    Icon: Gavel,
    text: "DON'T CHEAT",
    sub: "Pass the phone to the next player (he will judge your form taking a video)",
    color: "var(--boom-blue)",
  },
  {
    Icon: Clock,
    text: "BEAT THE CLOCK",
    sub: "now the judge becomes the player (defuse before the time is up)",
    color: "var(--boom-green)",
  },
];

export function TutorialCarousel({ compact = false, showDots = true }: { compact?: boolean; showDots?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className={`relative ink-border rounded-3xl bg-white overflow-hidden ${compact ? "h-full min-h-0" : "h-[260px]"}`}
      aria-label="How to play"
    >
      {SLIDES.map((s, idx) => {
        const Icon = s.Icon;
        const active = idx === i;
        return (
          <div
            key={idx}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-3 transition-opacity duration-700"
            style={{ opacity: active ? 1 : 0, background: s.color }}
            aria-hidden={!active}
          >
            <Icon size={compact ? 56 : 96} strokeWidth={2.5} />
            <div
              className="font-black comic-shadow leading-tight"
              style={{
                fontFamily: "'Luckiest Guy', cursive",
                fontSize: compact ? "clamp(1.8rem, 4vw, 3rem)" : "4rem",
                color: "var(--boom-ink)",
                textShadow: "3px 3px 0 #fff",
              }}
            >
              {s.text}
            </div>
            <div className="text-sm md:text-base font-black max-w-[30rem] leading-tight text-[var(--boom-ink)]">
              {s.sub}
            </div>
          </div>
        );
      })}
      {showDots && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {SLIDES.map((_, idx) => (
            <span
              key={idx}
              className="w-2 h-2 rounded-full ink-border-sm"
              style={{ background: idx === i ? "var(--boom-ink)" : "white" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
