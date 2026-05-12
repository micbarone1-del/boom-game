export const BOARD_SIZE = 60;

export const EXERCISES_EASY = ["Jumping Jacks", "High Knees", "Sit-ups", "Crunches"];
export const EXERCISES_MEDIUM = ["Squats", "Lunges", "Push-ups", "Mountain Climbers"];
export const EXERCISES_HARD = ["Burpees", "Plank-Ups", "Jump Squats", "Pike Push-ups"];

/** Hard caps so we never ask for crazy numbers like 56 burpees. */
const REP_CAP: Record<1 | 2 | 3, number> = { 1: 20, 2: 14, 3: 10 };

export type CellType =
  | "start"
  | "easy"
  | "medium"
  | "hard"
  | "rest"
  | "setback"
  | "boost"
  | "finish";

export type Cell = {
  space: number;
  type: CellType;
  /** Movement delta for setback/boost (negative for setback). */
  delta?: number;
  /** Reps multiplier for exercise tiers. */
  tier?: 1 | 2 | 3;
  /** Pre-assigned exercise name for exercise cells. */
  exercise?: string;
};

/**
 * Hand-tuned 60-space board.
 * Distribution: 1 start, 1 finish, 3 rest, 7 setback, 8 boost,
 * 41 exercise spaces split across easy/medium/hard tiers.
 */
const RAW_BOARD: Array<[CellType, number?]> = [
  ["start"],         // 1
  ["easy"],          // 2
  ["easy"],          // 3
  ["boost", 3],      // 4
  ["medium"],        // 5
  ["hard"],          // 6
  ["easy"],          // 7
  ["rest"],          // 8
  ["medium"],        // 9
  ["setback", -2],   // 10
  ["boost", 4],      // 11
  ["easy"],          // 12
  ["hard"],          // 13
  ["medium"],        // 14
  ["easy"],          // 15
  ["setback", -3],   // 16
  ["medium"],        // 17
  ["easy"],          // 18
  ["hard"],          // 19
  ["rest"],          // 20
  ["medium"],        // 21
  ["boost", 5],      // 22
  ["easy"],          // 23
  ["medium"],        // 24
  ["hard"],          // 25
  ["easy"],          // 26
  ["setback", -2],   // 27
  ["medium"],        // 28
  ["easy"],          // 29
  ["boost", 3],      // 30
  ["hard"],          // 31
  ["easy"],          // 32
  ["medium"],        // 33
  ["setback", -4],   // 34
  ["easy"],          // 35
  ["medium"],        // 36
  ["rest"],          // 37
  ["hard"],          // 38
  ["boost", 4],      // 39
  ["easy"],          // 40
  ["medium"],        // 41
  ["setback", -3],   // 42
  ["hard"],          // 43
  ["easy"],          // 44
  ["boost", 3],      // 45
  ["medium"],        // 46
  ["easy"],          // 47
  ["hard"],          // 48
  ["setback", -2],   // 49
  ["medium"],        // 50
  ["easy"],          // 51
  ["boost", 5],      // 52
  ["hard"],          // 53
  ["medium"],        // 54
  ["setback", -3],   // 55
  ["easy"],          // 56
  ["medium"],        // 57
  ["hard"],          // 58
  ["boost", 2],      // 59
  ["finish"],        // 60
];

export const BOARD: Cell[] = RAW_BOARD.map(([type, n], i) => {
  const space = i + 1;
  if (type === "easy")
    return { space, type, tier: 1, exercise: EXERCISES_EASY[i % EXERCISES_EASY.length] };
  if (type === "medium")
    return { space, type, tier: 2, exercise: EXERCISES_MEDIUM[i % EXERCISES_MEDIUM.length] };
  if (type === "hard")
    return { space, type, tier: 3, exercise: EXERCISES_HARD[i % EXERCISES_HARD.length] };
  if (type === "boost" || type === "setback") return { space, type, delta: n };
  return { space, type };
});

export function getCell(space: number): Cell {
  return BOARD[Math.max(0, Math.min(BOARD_SIZE, space) - 1)] ?? BOARD[0];
}

export type BoardOverrides = Record<string, { exercise?: string; reps?: number }>;

/** Returns the cell with any host overrides applied (custom exercise name). */
export function getEffectiveCell(space: number, overrides?: BoardOverrides | null): Cell {
  const base = getCell(space);
  const o = overrides?.[String(space)];
  if (!o) return base;
  if (base.type === "easy" || base.type === "medium" || base.type === "hard") {
    return { ...base, exercise: o.exercise ?? base.exercise };
  }
  return base;
}

/** Returns the override reps for an exercise cell, or null to fall back to calc. */
export function getOverrideReps(space: number, overrides?: BoardOverrides | null): number | null {
  const o = overrides?.[String(space)];
  return o?.reps && o.reps > 0 ? o.reps : null;
}

/** Reps for a tier given the player's fitness level + room difficulty. Capped to keep things sane. */
export function calcRepsForTier(
  tier: 1 | 2 | 3,
  fitnessLevel: number,
  multiplier: number,
): number {
  // Average of fitness (1-10) and difficulty multiplier (default 5) on a 0-1 scale.
  const intensity = (fitnessLevel + multiplier) / 20; // ~0.5 at defaults
  const base = tier === 1 ? 14 : tier === 2 ? 10 : 7;
  const reps = Math.round(base * (0.6 + intensity)); // defaults: easy 15, med 11, hard 8
  return Math.max(2, Math.min(REP_CAP[tier], reps));
}

/** Human-readable activity label for any cell — used on board + player UI. */
export function describeCell(cell: Cell): string {
  switch (cell.type) {
    case "start":
      return "🚀 Start line";
    case "finish":
      return "🏆 FINISH!";
    case "rest":
      return "☕ Rest — skip your turn";
    case "boost":
      return `⚡ Blast forward +${cell.delta}`;
    case "setback":
      return `⬅ Setback ${cell.delta}`;
    case "easy":
      return `Easy: ${cell.exercise}`;
    case "medium":
      return `Medium: ${cell.exercise}`;
    case "hard":
      return `HARD: ${cell.exercise}`;
  }
}

export const CELL_LABEL: Record<CellType, string> = {
  start: "START",
  easy: "EASY",
  medium: "MED",
  hard: "HARD",
  rest: "REST",
  setback: "BACK",
  boost: "BLAST",
  finish: "FINISH",
};

export function generateRoomCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "GYM-";
  for (let i = 0; i < 4; i++) s += letters[Math.floor(Math.random() * letters.length)];
  return s;
}

export function rollDice(): number {
  return 1 + Math.floor(Math.random() * 6);
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
