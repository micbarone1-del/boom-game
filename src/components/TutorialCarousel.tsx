import { useEffect, useState } from "react";
import { Smartphone, Dices, Bomb, Gavel } from "lucide-react";

const SLIDES = [
  { Icon: Smartphone, text: "YOUR PHONE IS THE REMOTE.", color: "var(--boom-yellow)" },
  { Icon: Dices, text: "ROLL TO SURVIVE.", color: "var(--boom-green)" },
  { Icon: Bomb, text: "BOOM = SWEAT.", color: "var(--boom-red)" },
  { Icon: Gavel, text: "DON'T CHEAT. Your friends judge you.", color: "var(--boom-blue)" },
];

export function TutorialCarousel({ compact = false }: { compact?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className={`relative ink-border rounded-3xl bg-white overflow-hidden ${compact ? "h-[180px]" : "h-[260px]"}`}
      aria-label="How to play"
    >
      {SLIDES.map((s, idx) => {
        const Icon = s.Icon;
        const active = idx === i;
        return (
          <div
            key={idx}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-4 transition-opacity duration-700"
            style={{ opacity: active ? 1 : 0, background: s.color }}
            aria-hidden={!active}
          >
            <Icon size={compact ? 64 : 96} strokeWidth={2.5} />
            <div
              className="font-black comic-shadow leading-tight"
              style={{
                fontFamily: "'Luckiest Guy', cursive",
                fontSize: compact ? "2.5rem" : "4rem",
                color: "var(--boom-ink)",
                textShadow: "3px 3px 0 #fff",
              }}
            >
              {s.text}
            </div>
          </div>
        );
      })}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, idx) => (
          <span
            key={idx}
            className="w-2 h-2 rounded-full ink-border-sm"
            style={{ background: idx === i ? "var(--boom-ink)" : "white" }}
          />
        ))}
      </div>
    </div>
  );
}