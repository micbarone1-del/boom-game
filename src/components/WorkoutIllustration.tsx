import { Dumbbell, Flame, Footprints, HeartPulse, PersonStanding, Zap } from "lucide-react";

function hashExercise(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function WorkoutIllustration({
  exercise,
  color = "var(--boom-red)",
  compact = false,
}: {
  exercise: string;
  color?: string;
  compact?: boolean;
}) {
  const name = exercise.toLowerCase();
  const Icon =
    name.includes("squat") || name.includes("lunge") || name.includes("jump")
      ? Footprints
      : name.includes("burpee") || name.includes("sprint") || name.includes("mountain")
        ? Zap
        : name.includes("plank") || name.includes("push") || name.includes("dip")
          ? PersonStanding
          : name.includes("kettle") || name.includes("thruster") || name.includes("deadlift")
            ? Dumbbell
            : name.includes("hold") || name.includes("sit")
              ? HeartPulse
              : Flame;
  const seed = hashExercise(exercise);
  const bubbles = [0, 1, 2, 3, 4].map((i) => ({
    left: 14 + ((seed >> (i * 3)) % 70),
    top: 12 + ((seed >> (i * 4)) % 66),
    size: 14 + ((seed >> (i * 2)) % 20),
  }));
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-3xl ink-border-sm bg-white ${compact ? "w-28 h-28" : "w-40 h-40"}`}
      aria-label={`${exercise} illustration`}
      style={{ color }}
    >
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full opacity-25"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: b.size,
            height: b.size,
            background: color,
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center anim-mascot-bounce">
        <Icon size={compact ? 64 : 96} strokeWidth={2.8} />
      </div>
      <div
        className="absolute left-2 right-2 bottom-2 rounded-xl px-2 py-1 text-center text-[10px] font-black leading-none"
        style={{ background: color, color: "white" }}
      >
        {exercise.toUpperCase()}
      </div>
    </div>
  );
}
