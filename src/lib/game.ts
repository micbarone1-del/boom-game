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

export const FINISH_BONUS = 250;

import { supabase } from "@/integrations/supabase/client";

/**
 * Mark a player as having completed the game and compute their final score.
 * Score = sum of target_reps from their workout_logs in this room + finish bonus,
 * with an extra placement bonus for finishing earlier.
 */
export async function finishPlayer(playerId: string, roomCode: string) {
  // Already finished? Skip.
  const { data: existing } = await supabase
    .from("players")
    .select("finished_at")
    .eq("id", playerId)
    .maybeSingle();
  if (existing?.finished_at) return;

  const { data: logs } = await supabase
    .from("workout_logs")
    .select("target_reps")
    .eq("room_code", roomCode)
    .eq("player_id", playerId);
  const totalReps = (logs ?? []).reduce((s, l: any) => s + (l.target_reps ?? 0), 0);

  const { data: alreadyFinished } = await supabase
    .from("players")
    .select("id")
    .eq("room_code", roomCode)
    .not("finished_at", "is", null);
  const rank = (alreadyFinished?.length ?? 0) + 1;
  const placementBonus = Math.max(0, 100 - (rank - 1) * 25);
  const score = totalReps + FINISH_BONUS + placementBonus;

  await supabase
    .from("players")
    .update({
      finished_at: new Date().toISOString(),
      finish_rank: rank,
      score,
      current_space: BOARD_SIZE,
    })
    .eq("id", playerId);
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
