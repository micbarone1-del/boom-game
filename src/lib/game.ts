export const BOARD_SIZE = 60;
export const HOP_MS = 220;
export const LANDING_SPLASH_MS = 3200;
export const SEQUENCE_BUFFER_MS = 900;
export const TRAP_REVEAL_MS = 1000;
export const COUNTDOWN_LEAD_MS = 3000;
/** Maximum seconds a player has to be defused before the bomb blows up. */
export const TRAP_TIMEOUT_MS = 30_000;
/** Maximum number of independent "slots" (solo player or team) on the board. */
export const MAX_TEAMS = 3;
export const TEAM_IDS = ["green", "red", "blue"] as const;
export type TeamId = (typeof TEAM_IDS)[number];

export const TEAM_COLORS: Record<TeamId, string> = {
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
};

export function teamName(teamId?: string | null): string {
  if (!teamId) return "Solo";
  return `Team ${teamId.slice(0, 1).toUpperCase()}${teamId.slice(1)}`;
}

export function teamColor(teamId?: string | null): string {
  return TEAM_COLORS[(teamId as TeamId) ?? "green"] ?? "#ec4899";
}

type TeamAssignablePlayer = {
  id: string;
  fitness_level: number;
  joined_at: string;
  team_id?: string | null;
  is_team_lead?: boolean | null;
  current_space?: number | null;
};

export function assignTeamForJoin(existingPlayers: TeamAssignablePlayer[], fitnessLevel: number) {
  const ordered = [...existingPlayers].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const teamFor = (p: TeamAssignablePlayer, idx: number) =>
    p.team_id ?? TEAM_IDS[Math.min(idx, TEAM_IDS.length - 1)];
  const used = new Set(ordered.map(teamFor));

  if (used.size < MAX_TEAMS) {
    const team_id = TEAM_IDS.find((id) => !used.has(id)) ?? TEAM_IDS[used.size];
    return { team_id, is_team_lead: true, current_space: 0 };
  }

  const teams = TEAM_IDS.map((id) => {
    const members = ordered.filter((p, idx) => teamFor(p, idx) === id);
    const avgFitness =
      members.reduce((sum, p) => sum + (p.fitness_level || 5), 0) / Math.max(1, members.length);
    const lead = members.find((p) => p.is_team_lead) ?? members[0];
    return { id, members, avgFitness, lead };
  });
  teams.sort(
    (a, b) =>
      Math.abs(a.avgFitness - fitnessLevel) - Math.abs(b.avgFitness - fitnessLevel) ||
      a.members.length - b.members.length,
  );
  const chosen = teams[0] ?? { id: TEAM_IDS[0], lead: ordered[0] };
  return {
    team_id: chosen.id,
    is_team_lead: false,
    current_space: chosen.lead?.current_space ?? 0,
  };
}

export const EXERCISES_EASY = ["Jumping Jacks", "High Knees", "Sit-ups", "Crunches"];
export const EXERCISES_MEDIUM = ["Squats", "Lunges", "Push-ups", "Mountain Climbers"];
export const EXERCISES_HARD = ["Burpees", "Plank-Ups", "Jump Squats", "Pike Push-ups"];

/** Unusual / silly combos used by CRAZY (?!) cells. */
export const EXERCISES_CRAZY = [
  "Spin & Burpee",
  "Wheel & Pushup",
  "Crab-Walk Pushups",
  "Bear-Crawl Squats",
  "Frog Jumps & Plank",
  "Side-Roll Sit-ups",
  "Donkey Kick Pushups",
  "Inchworm Burpee",
];

/** Lighter exercises used by GROUP cells (everybody together). */
export const EXERCISES_GROUP = [
  "Jumping Jacks",
  "High Knees",
  "Air Squats",
  "Wall Sit",
  "Plank Hold",
  "Marching In Place",
];

/** Hard caps so we never ask for crazy numbers like 56 burpees. */
const REP_CAP: Record<1 | 2 | 3, number> = { 1: 20, 2: 14, 3: 10 };

export type CellType =
  | "start"
  | "easy"
  | "medium"
  | "hard"
  | "setback"
  | "boost"
  | "surprise"
  | "crazy"
  | "group"
  | "pause"
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
  ["start"], // 1
  ["easy"], // 2
  ["easy"], // 3
  ["boost", 3], // 4
  ["surprise"], // 5
  ["hard"], // 6
  ["easy"], // 7
  ["pause"], // 8
  ["medium"], // 9
  ["setback", -2], // 10
  ["boost", 4], // 11
  ["group"], // 12
  ["hard"], // 13
  ["medium"], // 14
  ["easy"], // 15
  ["setback", -3], // 16
  ["crazy"], // 17
  ["easy"], // 18
  ["hard"], // 19
  ["group"], // 20
  ["medium"], // 21
  ["boost", 10], // 22  ← MEGA BLAST!
  ["easy"], // 23
  ["medium"], // 24
  ["hard"], // 25
  ["surprise"], // 26
  ["setback", -2], // 27
  ["crazy"], // 28
  ["easy"], // 29
  ["boost", 3], // 30
  ["hard"], // 31
  ["pause"], // 32
  ["medium"], // 33
  ["setback", -999], // 34  ← BACK TO START
  ["group"], // 35
  ["medium"], // 36
  ["crazy"], // 37
  ["hard"], // 38
  ["boost", 4], // 39
  ["crazy"], // 40
  ["medium"], // 41
  ["setback", -3], // 42
  ["hard"], // 43
  ["pause"], // 44
  ["boost", 3], // 45
  ["medium"], // 46
  ["group"], // 47
  ["hard"], // 48
  ["setback", -2], // 49
  ["medium"], // 50
  ["crazy"], // 51
  ["boost", 5], // 52
  ["hard"], // 53
  ["medium"], // 54
  ["setback", -3], // 55
  ["group"], // 56
  ["medium"], // 57
  ["hard"], // 58
  ["boost", 2], // 59
  ["finish"], // 60
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
  if (type === "surprise" || type === "crazy" || type === "group" || type === "pause") return { space, type };
  return { space, type };
});

export function getCell(space: number): Cell {
  return BOARD[Math.max(0, Math.min(BOARD_SIZE, space) - 1)] ?? BOARD[0];
}

export type BoardOverrides = Record<
  string,
  {
    preset_id?: string;
    exercise?: string;
    reps?: number;
    min_reps?: number;
    max_reps?: number;
    unit?: "reps" | "seconds";
  }
>;

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

export function getTrainingSelection(overrides?: BoardOverrides | null): string {
  const preset = overrides?.__preset?.preset_id;
  if (!preset) return Object.keys(overrides ?? {}).length > 0 ? "Custom" : "Default";
  return preset
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveMovementLanding(space: number, movement: "boost" | "setback"): number {
  let final = Math.max(1, Math.min(BOARD_SIZE, space));
  const blocked: CellType[] = movement === "boost" ? ["setback"] : ["boost"];
  while (final > 1 && final < BOARD_SIZE && blocked.includes(getCell(final).type)) {
    final += movement === "boost" ? 1 : -1;
  }
  return Math.max(1, Math.min(BOARD_SIZE, final));
}

/** Returns the unit (reps or seconds) for an exercise cell, defaulting to reps. */
export function getCellUnit(space: number, overrides?: BoardOverrides | null): "reps" | "seconds" {
  return overrides?.[String(space)]?.unit ?? "reps";
}

/** Pick a random exercise from the configured pool for a SURPRISE cell. */
export function pickSurpriseExercise(overrides?: BoardOverrides | null): {
  exercise: string;
  tier: 1 | 2 | 3;
} {
  const pool: Array<{ name: string; tier: 1 | 2 | 3 }> = [];
  for (const c of BOARD) {
    if (c.type === "easy" || c.type === "medium" || c.type === "hard") {
      const eff = getEffectiveCell(c.space, overrides);
      pool.push({ name: eff.exercise ?? "Workout", tier: c.tier ?? 1 });
    }
  }
  const pick = pool[Math.floor(Math.random() * pool.length)] ?? {
    name: "Squats",
    tier: 2 as 1 | 2 | 3,
  };
  return { exercise: pick.name, tier: pick.tier };
}

/** Pick a random unusual exercise for a CRAZY cell. */
export function pickCrazyExercise(): { exercise: string; tier: 3 } {
  const name = EXERCISES_CRAZY[Math.floor(Math.random() * EXERCISES_CRAZY.length)];
  return { exercise: name, tier: 3 };
}

/** Pick a lighter group exercise for a GROUP cell. */
export function pickGroupExercise(): { exercise: string; tier: 1 } {
  const name = EXERCISES_GROUP[Math.floor(Math.random() * EXERCISES_GROUP.length)];
  return { exercise: name, tier: 1 };
}

/**
 * Returns the override reps for an exercise cell, or null to fall back to the calc.
 * Supports either a fixed `reps` override OR a `min_reps`/`max_reps` range
 * (random value in that range, inclusive). If only one bound is set, the other
 * defaults to the calc value supplied via `fallback`.
 */
export function getOverrideReps(
  space: number,
  overrides?: BoardOverrides | null,
  fallback?: number,
): number | null {
  const o = overrides?.[String(space)];
  if (!o) return null;
  if (o.reps && o.reps > 0) return o.reps;
  const hasMin = o.min_reps && o.min_reps > 0;
  const hasMax = o.max_reps && o.max_reps > 0;
  if (hasMin || hasMax) {
    const lo = hasMin ? o.min_reps! : Math.max(1, fallback ?? 1);
    const hi = hasMax ? o.max_reps! : Math.max(lo, fallback ?? lo);
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    return a + Math.floor(Math.random() * (b - a + 1));
  }
  return null;
}

/** Reps for a tier given the player's fitness level + room difficulty. Capped to keep things sane. */
export function calcRepsForTier(tier: 1 | 2 | 3, fitnessLevel: number, multiplier: number): number {
  // Average of fitness (1-10) and difficulty multiplier (default 5) on a 0-1 scale.
  const intensity = (fitnessLevel + multiplier) / 20; // ~0.5 at defaults
  const base = tier === 1 ? 14 : tier === 2 ? 10 : 7;
  const reps = Math.round(base * (0.6 + intensity)); // defaults: easy 15, med 11, hard 8
  return Math.max(2, Math.min(REP_CAP[tier], reps));
}

/** Max duration (seconds) for any isometric / hold exercise. */
export const HOLD_SECONDS_CAP = 20;

/**
 * Isometric moves (plank hold, wall sit, hollow hold…) are timed, not counted.
 * They are judged in seconds — the judge holds DEFUSE for the duration.
 */
export function isIsometricExercise(name: string): boolean {
  const n = name ?? "";
  // Dynamic moves that merely contain an isometric keyword are rep-based.
  if (/plank[- ]?ups?|plank[- ]?jacks?|push[- ]?ups?|jumps?|climbers?|walks?|taps?|rows?|to[- ]?plank/i.test(n)) {
    return false;
  }
  return /\b(hold|plank|wall sit|wall-sit|hollow|superman|bridge|l-sit|dead ?hang|isometric|static)\b/i.test(
    n,
  );
}

/** Seconds to hold an isometric move, scaled by tier/fitness and capped at 20s. */
export function calcHoldSeconds(
  tier: 1 | 2 | 3,
  fitnessLevel: number,
  multiplier: number,
): number {
  const intensity = (fitnessLevel + multiplier) / 20;
  const base = tier === 1 ? 12 : tier === 2 ? 16 : 20;
  const secs = Math.round(base * (0.6 + intensity));
  return Math.max(5, Math.min(HOLD_SECONDS_CAP, secs));
}

/**
 * Target amount + unit for an exercise: reps for dynamic moves, capped
 * seconds for isometric holds.
 */
export function calcTargetFor(
  exercise: string,
  tier: 1 | 2 | 3,
  fitnessLevel: number,
  multiplier: number,
): { reps: number; unit: "reps" | "seconds" } {
  if (isIsometricExercise(exercise)) {
    return { reps: calcHoldSeconds(tier, fitnessLevel, multiplier), unit: "seconds" };
  }
  return { reps: calcRepsForTier(tier, fitnessLevel, multiplier), unit: "reps" };
}


/** Human-readable activity label for any cell — used on board + player UI. */
export function describeCell(cell: Cell): string {
  switch (cell.type) {
    case "start":
      return "🚀 Start line";
    case "finish":
      return "🏆 FINISH!";
    case "boost":
      return cell.delta && cell.delta >= 10
        ? `🚀 MEGA BLAST +${cell.delta}!`
        : `⚡ Blast forward +${cell.delta}`;
    case "setback":
      return cell.delta && cell.delta <= -50 ? `🐌 BACK TO START!` : `⬅ Setback ${cell.delta}`;
    case "easy":
      return `Easy: ${cell.exercise}`;
    case "medium":
      return `Medium: ${cell.exercise}`;
    case "hard":
      return `HARD: ${cell.exercise}`;
    case "surprise":
      return `❓ Surprise exercise!`;
    case "crazy":
      return `🤪 Crazy exercise!`;
    case "group":
      return `👥 Everybody together!`;
    case "pause":
      return `⏸️ Pause — fun break!`;
  }
}

export const CELL_LABEL: Record<CellType, string> = {
  start: "START",
  easy: "EASY",
  medium: "MED",
  hard: "HARD",
  setback: "BACK",
  boost: "BLAST",
  surprise: "?",
  crazy: "!?",
  group: "ALL",
  pause: "PAUSE",
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

/**
 * The Rotating Judge: the player who took the previous turn (the one before
 * the player who triggered the current trap). Skips finished players.
 * Returns null when only the trigger player is active (solo mode) so the gym
 * screen can still show the DEFUSED button itself.
 */
export function getJudgeId(
  players: Array<{ id: string; joined_at: string; finished_at: string | null }>,
  triggeredById: string,
): string | null {
  const order = [...players]
    .filter((p) => !p.finished_at)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  if (order.length <= 1) return null;
  const idx = order.findIndex((p) => p.id === triggeredById);
  if (idx < 0) return null;
  return order[(idx - 1 + order.length) % order.length].id;
}

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
  const totalReps = (logs ?? []).reduce(
    (s, l: { target_reps: number | null }) => s + (l.target_reps ?? 0),
    0,
  );

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
  started_at: number; // ms epoch
  awaiting_verification?: boolean;
  /** The final board space the trap is anchored on (post-boost/setback). */
  space?: number;
  /** Trap kind — defaults to a normal exercise trap. */
  kind?: "exercise" | "surprise" | "crazy" | "group" | "vs";
  /** "reps" (default) or "seconds" for time-based exercises. */
  unit?: "reps" | "seconds";
  /** For VS mode: the opponent player ids on the same space. */
  vs_opponents?: string[];
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
  } catch {
    return null;
  }
}

export function clearPlayerSession() {
  if (typeof window !== "undefined") localStorage.removeItem(PLAYER_KEY);
}

/**
 * Recompute a player's running score = sum of target_reps logged so far in
 * this room. Called after every defuse so the leaderboard updates live
 * (finishPlayer overwrites with the bonus-included final score on win).
 */
export async function recalcPlayerScore(playerId: string, roomCode: string) {
  const { data: logs } = await supabase
    .from("workout_logs")
    .select("target_reps")
    .eq("room_code", roomCode)
    .eq("player_id", playerId);
  const total = (logs ?? []).reduce(
    (s, l: { target_reps: number | null }) => s + (l.target_reps ?? 0),
    0,
  );
  await supabase.from("players").update({ score: total }).eq("id", playerId);
}
