import { BOARD, type BoardOverrides } from "@/lib/game";

export type TrainingPreset = {
  id: string;
  name: string;
  description: string;
  /** Pools of exercises by tier — applied to every easy/medium/hard cell. */
  pools: { easy: string[]; medium: string[]; hard: string[] };
  /** Default unit per tier (defaults to reps everywhere). */
  units?: { easy?: "reps" | "seconds"; medium?: "reps" | "seconds"; hard?: "reps" | "seconds" };
};

export const PRESETS: TrainingPreset[] = [
  {
    id: "default",
    name: "Default",
    description: "The classic BOOM! mix.",
    pools: {
      easy: ["Jumping Jacks", "High Knees", "Sit-ups", "Crunches"],
      medium: ["Squats", "Lunges", "Push-ups", "Mountain Climbers"],
      hard: ["Burpees", "Plank-Ups", "Jump Squats", "Pike Push-ups"],
    },
  },
  {
    id: "endurance",
    name: "Endurance",
    description: "Long-burn cardio. Seconds, not reps.",
    pools: {
      easy: ["Marching In Place", "Step Touch", "Shadow Boxing"],
      medium: ["Jump Rope", "High Knees", "Mountain Climbers"],
      hard: ["Burpees", "Sprint In Place", "Tuck Jumps"],
    },
    units: { easy: "seconds", medium: "seconds", hard: "seconds" },
  },
  {
    id: "legs",
    name: "Legs",
    description: "Lower body destruction.",
    pools: {
      easy: ["Calf Raises", "Glute Bridges", "Wall Sit"],
      medium: ["Squats", "Lunges", "Step-Ups"],
      hard: ["Jump Squats", "Bulgarian Split Squats", "Pistol Squats"],
    },
  },
  {
    id: "calisthenics",
    name: "Calisthenics",
    description: "Bodyweight fundamentals.",
    pools: {
      easy: ["Push-ups (knees)", "Inverted Rows", "Dead Bugs"],
      medium: ["Push-ups", "Pull-ups", "Dips"],
      hard: ["Diamond Push-ups", "Archer Push-ups", "Pistol Squats"],
    },
  },
  {
    id: "crossfit",
    name: "CrossFit",
    description: "WOD-style intensity.",
    pools: {
      easy: ["Air Squats", "Sit-ups", "Box Step-Ups"],
      medium: ["Wall Balls", "Kettlebell Swings", "Box Jumps"],
      hard: ["Burpees", "Thrusters", "Toes to Bar"],
    },
  },
  {
    id: "functional",
    name: "Functional",
    description: "Real-world movement patterns.",
    pools: {
      easy: ["Bird Dogs", "Glute Bridges", "Dead Bugs"],
      medium: ["Goblet Squats", "Single-Leg Deadlifts", "Bear Crawls"],
      hard: ["Turkish Get-Ups", "Renegade Rows", "Burpee Broad Jumps"],
    },
  },
  {
    id: "kettlebells",
    name: "Kettlebells",
    description: "Swing it!",
    pools: {
      easy: ["Kettlebell Halos", "Kettlebell Deadlifts", "Goblet Squats"],
      medium: ["Kettlebell Swings", "Kettlebell Cleans", "Kettlebell Rows"],
      hard: ["Kettlebell Snatches", "Turkish Get-Ups", "Kettlebell Thrusters"],
    },
  },
  {
    id: "extreme",
    name: "Extreme",
    description: "No mercy. You asked for it.",
    pools: {
      easy: ["Burpees", "Mountain Climbers", "Jump Squats"],
      medium: ["Burpee Broad Jumps", "Jumping Lunges", "Plank Walks"],
      hard: ["Burpee Pull-ups", "Devil Press", "Box Jump Burpees"],
    },
  },
];

/** Apply a preset on top of the default board, returning a fresh BoardOverrides. */
export function applyPreset(preset: TrainingPreset): BoardOverrides {
  const overrides: BoardOverrides = { __preset: { preset_id: preset.id } };
  let easyIdx = 0,
    mediumIdx = 0,
    hardIdx = 0;
  for (const cell of BOARD) {
    if (cell.type === "easy") {
      const ex = preset.pools.easy[easyIdx % preset.pools.easy.length];
      overrides[String(cell.space)] = {
        exercise: ex,
        ...(preset.units?.easy ? { unit: preset.units.easy } : {}),
      };
      easyIdx++;
    } else if (cell.type === "medium") {
      const ex = preset.pools.medium[mediumIdx % preset.pools.medium.length];
      overrides[String(cell.space)] = {
        exercise: ex,
        ...(preset.units?.medium ? { unit: preset.units.medium } : {}),
      };
      mediumIdx++;
    } else if (cell.type === "hard") {
      const ex = preset.pools.hard[hardIdx % preset.pools.hard.length];
      overrides[String(cell.space)] = {
        exercise: ex,
        ...(preset.units?.hard ? { unit: preset.units.hard } : {}),
      };
      hardIdx++;
    }
  }
  return overrides;
}
