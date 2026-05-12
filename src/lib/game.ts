export const BOARD_SIZE = 60;

// Spaces (1-indexed) that are traps (Detonation Zones)
export const TRAP_SPACES = new Set([6, 13, 19, 27, 34, 41, 48, 55]);
// Spaces that are boosts (Blast Wave) — blast forward 5
export const BOOST_SPACES = new Set([4, 11, 22, 31, 39, 47, 53]);

export const EXERCISES = [
  "Burpees",
  "Push-ups",
  "Squats",
  "Jumping Jacks",
  "Mountain Climbers",
  "Sit-ups",
  "Lunges",
  "High Knees",
];

export function generateRoomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "GYM-";
  for (let i = 0; i < 4; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

export function rollDice(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function pickExercise(): string {
  return EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
}

export function calcReps(fitnessLevel: number, multiplier: number): number {
  return Math.max(1, fitnessLevel * multiplier);
}

export type Trap = {
  exercise: string;
  reps: number;
  triggered_by: string; // player id
  started_at: number;   // ms epoch
  awaiting_verification?: boolean;
};

const PLAYER_KEY = "boom.player";

export function savePlayerSession(roomCode: string, playerId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PLAYER_KEY, JSON.stringify({ roomCode, playerId }));
}

export function loadPlayerSession(): { roomCode: string; playerId: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(PLAYER_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export function clearPlayerSession() {
  if (typeof window !== "undefined") localStorage.removeItem(PLAYER_KEY);
}
