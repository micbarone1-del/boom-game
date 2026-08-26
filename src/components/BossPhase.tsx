import { useEffect, useMemo, useRef, useState } from "react";
import { Bomb, Flame, Skull } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CountdownNumber } from "@/components/CountdownNumber";
import { BombAvatar } from "@/components/BombAvatar";

import type { Player, Room } from "@/hooks/use-room";
import {
  pickCrazyExercise,
  pickSurpriseExercise,
  pickGroupExercise,
  calcRepsForTier,
  TRAP_TIMEOUT_MS,
  type BoardOverrides,
} from "@/lib/game";
import { haptic,
  sfx,
  speak,
  repPop,
  startArcadeRise,
} from "@/lib/sfx";
import bossMascot from "@/assets/boss-mascot.png";
import bombEasy from "@/assets/bomb-easy.png";
import bombMedium from "@/assets/bomb-medium.png";
import bombHard from "@/assets/bomb-hard.png";
import bombBoost from "@/assets/bomb-boost.png";
import bombSetback from "@/assets/bomb-setback.png";
import bombSpecial from "@/assets/bomb-special.png";
import bombSuper from "@/assets/bomb-super.png";
import bombMascotImg from "@/assets/bomb-mascot.png";

/** Wheel-of-fortune wedge definitions for the boss roll. */
type BossWedge = {
  id: string;
  label: string;
  /** Per-rep damage multiplier. */
  multiplier: number;
  /** True = whole pod hits, damage summed across all members. */
  podWide?: boolean;
  /** Visual fill color for the wedge. */
  color: string;
  /** Exercise pool tier when picked. */
  tier: 1 | 2 | 3;
  /** Which exercise picker to use. */
  pick: "easy" | "medium" | "hard" | "surprise" | "crazy" | "group";
  /** Mascot art shown when the wedge wins. */
  mascot: string;
};

const BOSS_WEDGES: BossWedge[] = [
  { id: "easy", label: "EASY", multiplier: 1, color: "#facc15", tier: 1, pick: "easy", mascot: bombEasy },
  { id: "medium", label: "MEDIUM", multiplier: 1, color: "#22c55e", tier: 2, pick: "medium", mascot: bombMedium },
  { id: "hard", label: "HARD", multiplier: 2, color: "#ef4444", tier: 3, pick: "hard", mascot: bombHard },
  { id: "surprise", label: "SURPRISE", multiplier: 2, color: "#ec4899", tier: 2, pick: "surprise", mascot: bombMascotImg },
  { id: "crazy", label: "CRAZY", multiplier: 2, color: "#22d3ee", tier: 3, pick: "crazy", mascot: bombSetback },
  { id: "group", label: "GROUP", multiplier: 1, podWide: true, color: "#3b82f6", tier: 2, pick: "group", mascot: bombBoost },
  { id: "special", label: "SPECIAL", multiplier: 2, color: "#a855f7", tier: 3, pick: "hard", mascot: bombSpecial },
  { id: "super", label: "SUPER", multiplier: 3, podWide: true, color: "#f97316", tier: 3, pick: "crazy", mascot: bombSuper },
];

function pickForWedge(wedge: BossWedge, overrides: BoardOverrides): { exercise: string; tier: 1 | 2 | 3 } {
  switch (wedge.pick) {
    case "surprise":
      return pickSurpriseExercise(overrides);
    case "crazy":
      return pickCrazyExercise();
    case "group":
      return pickGroupExercise();
    case "easy":
      return { exercise: "Jumping Jacks", tier: 1 };
    case "medium":
      return { exercise: "Squats", tier: 2 };
    case "hard":
      return { exercise: "Burpees", tier: 3 };
  }
}

/** Total HP per player joining the boss (shared HP pool). */
const HP_PER_PLAYER = 220;
/** Total seconds the pod has before the boss wins. */
const BOSS_DURATION_MS = 5 * 60 * 1000;

type Attack = {
  playerId: string;
  exercise: string;
  reps: number;
  unit: "reps" | "seconds";
  tier: 1 | 2 | 3;
  /** Damage multiplier per rep, set by the wheel wedge. Default 2. */
  multiplier?: number;
  /** When true the whole pod performs the move and damage = sum across all members. */
  podWide?: boolean;
  /** Display label for the wedge (e.g. "SPECIAL MOVE"). */
  wedgeLabel?: string;
  /** Mascot art for the wedge, shown on the switch screen. */
  mascot?: string;
};

type InnerPhase =
  | { kind: "intro" }
  | { kind: "roll"; turnPlayer: Player }
  | { kind: "switch"; attack: Attack }
  | { kind: "judge"; attack: Attack }
  | { kind: "hit"; attack: Attack; damage: number; outcome: "success" | "fail" }
  | { kind: "death" };

function avatarColor(url: string | null) {
  return url && url.startsWith("mascot:") ? url.slice(7) : "#ec4899";
}

function BossAvatar({ player, size = 72 }: { player: Player; size?: number }) {
  const color = avatarColor(player.avatar_url);
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 0 4px #111, 0 0 0 8px ${color}, 0 0 0 10px #111`,
      }}
    >
      {player.avatar_url && !player.avatar_url.startsWith("mascot:") ? (
        <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <BombAvatar color={color} size={size} />
      )}
    </div>
  );
}

/**
 * Shared boss fight. All pods chip at the same `rooms.boss_hp`.
 * This component cycles through the pod's active players, handing each one
 * an attack (exercise) → judge ring → damage on success. When the room HP
 * drops to 0, the host flips `rooms.phase` to `victory`.
 */
export function BossPhase({
  room,
  podPlayers,
  overrides,
  code,
}: {
  room: Room;
  podPlayers: Player[];
  overrides: BoardOverrides;
  code: string;
}) {
  const active = useMemo(
    () => podPlayers.filter((p) => p.status !== "out"),
    [podPlayers],
  );
  const [turnIdx, setTurnIdx] = useState(0);
  const [inner, setInner] = useState<InnerPhase>({ kind: "intro" });
  const [hitFlash, setHitFlash] = useState(0);
  const [burst, setBurst] = useState<{ id: number; dmg: number } | null>(null);

  // Boss fuse — derived from room.boss_started_at.
  const bossStartedAt = room.boss_started_at
    ? new Date(room.boss_started_at).getTime()
    : Date.now();
  const bossEndsAt = bossStartedAt + BOSS_DURATION_MS;
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(i);
  }, []);
  const remaining = Math.max(0, bossEndsAt - Date.now());

  const player = active[turnIdx % Math.max(1, active.length)];
  const judge = active[(turnIdx + 1) % Math.max(1, active.length)] ?? player;

  // Intro → first announce
  useEffect(() => {
    if (inner.kind !== "intro") return;
    speak("Boss fight! Defeat the bomb tyrant!", { rate: 0.85, pitch: 0.7 });
    sfx.play("countdown");
    const t = setTimeout(() => startTurn(), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTurn = (turnPlayer = player) => {
    if (!turnPlayer) return;
    // Player now spins the wheel of fortune to pick the move.
    setInner({ kind: "roll", turnPlayer });
  };

  const onWheelResult = (wedge: BossWedge) => {
    const turnPlayer = inner.kind === "roll" ? inner.turnPlayer : player;
    if (!turnPlayer) return;
    const pick = pickForWedge(wedge, overrides);
    const reps = calcRepsForTier(
      pick.tier,
      turnPlayer.fitness_level,
      room.difficulty_multiplier,
    );
    const isHold = /\bhold\b/i.test(pick.exercise);
    const attack: Attack = {
      playerId: turnPlayer.id,
      exercise: pick.exercise,
      reps,
      unit: isHold ? "seconds" : "reps",
      tier: pick.tier,
      multiplier: wedge.multiplier,
      podWide: wedge.podWide,
      wedgeLabel: wedge.label,
      mascot: wedge.mascot,
    };
    setInner({ kind: "switch", attack });
  };

  const onSwitchDone = () => {
    if (inner.kind !== "switch") return;
    setInner({ kind: "judge", attack: inner.attack });
  };

  const onJudgeDone = async (
    outcome: "success" | "fail",
    achievedReps: number,
  ) => {
    if (inner.kind !== "judge") return;
    const attack = inner.attack;
    const baseMul = attack.multiplier ?? (attack.tier === 3 ? 3 : 2);
    const podMul = attack.podWide ? Math.max(1, active.length) : 1;
    const damage = Math.max(0, achievedReps * baseMul * podMul);
    if (damage > 0) {
      setHitFlash(Date.now());
      setBurst({ id: Date.now(), dmg: damage });
      setTimeout(() => setBurst(null), 900);
      sfx.play("bossHit");
      sfx.play("blowUp");
      haptic("boom");
      // Race-safe decrement.
      const newHp = Math.max(0, (room.boss_hp ?? 0) - damage);
      await supabase
        .from("rooms")
        .update({ boss_hp: newHp })
        .eq("code", code);
      await supabase.from("workout_logs").insert({
        room_code: code,
        player_id: attack.playerId,
        exercise_name: `BOSS: ${attack.exercise}`,
        target_reps: achievedReps,
        unit: attack.unit,
        time_taken_ms: 0,
        verified_by_judge: true,
      });
      // Update player score.
      const cur = podPlayers.find((p) => p.id === attack.playerId);
      await supabase
        .from("players")
        .update({ score: (cur?.score ?? 0) + damage })
        .eq("id", attack.playerId);
      speak(`${player.username} hits the boss for ${damage}.`);
      setInner({ kind: "hit", attack, damage, outcome });

      // Boss dies: play local death sequence, then flip room phase.
      if (newHp <= 0) {
        setTimeout(() => {
          setInner({ kind: "death" });
          // Hand off to BossDeathOverlay which owns the multi-stage spectacle.
          setTimeout(() => {
            void supabase
              .from("rooms")
              .update({
                phase: "victory",
                boss_defeated_at: new Date().toISOString(),
              })
              .eq("code", code);
          }, 5800);
        }, 1400);
        return;
      }
    } else {
      sfx.play("blowUp");
      speak(`${player.username} missed the boss.`);
      setInner({ kind: "hit", attack, damage: 0, outcome });
    }
    // Wait long enough for the points narration ("X hits the boss for N") to
    // finish — speak() cancels any pending utterance, so the next turn's
    // announcement was clipping this one. ~3.4s clears most lines.
    setTimeout(() => {
      const next = turnIdx + 1;
      setTurnIdx(next);
      startTurn(active[next % Math.max(1, active.length)]);
    }, 3400);
  };

  // Boss timeout → continue countdown (never straight to the leaderboard).
  useEffect(() => {
    if (remaining > 0) return;
    void (async () => {
      await supabase
        .from("rooms")
        .update({
          game_state: "timeout_continue",
          continue_deadline_at: new Date(Date.now() + 20_000).toISOString(),
        })
        .eq("code", code)
        .eq("game_state", "playing");
    })();
  }, [remaining, code]);

  if (!player) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-black text-white p-6 text-center">
        Waiting for players…
      </main>
    );
  }

  const hpPct =
    room.boss_max_hp && room.boss_max_hp > 0
      ? Math.max(0, Math.min(1, (room.boss_hp ?? 0) / room.boss_max_hp))
      : 0;
  const mm = String(Math.floor(remaining / 60000));
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  const flashing = Date.now() - hitFlash < 350;
  const shaking = Date.now() - hitFlash < 600;

  return (
    <main className="fixed inset-0 overflow-hidden flex flex-col boss-arena">
      {/* Boss sprite — sways side to side + bobs, hides while judging (it overlays the camera instead) */}
      {inner.kind !== "judge" && inner.kind !== "death" && (
        <div className="absolute inset-0 flex items-center justify-center pb-32 pt-6 pointer-events-none">
          <div className={`boss-sway ${shaking ? "anim-boss-hit" : ""}`}>
            <img
              src={bossMascot}
              alt="Boss"
              width={768}
              height={768}
              loading="lazy"
              className={`w-64 h-64 object-contain ${shaking ? "" : "anim-mascot-bounce"}`}
              style={{
                filter: flashing
                  ? "brightness(2.4) drop-shadow(0 0 24px #fff)"
                  : "drop-shadow(0 12px 0 rgba(0,0,0,0.6))",
              }}
            />
            {burst && (
              <div key={burst.id} className="absolute inset-0 pointer-events-none" aria-hidden>
                {/* Impact explosion right at the point of contact */}
                <div
                  className="absolute left-1/2 top-1/2 text-7xl anim-impact"
                  style={{ filter: "drop-shadow(0 0 22px #ffd60a)" }}
                >
                  💥
                </div>
                <div
                  className="absolute left-[62%] top-[38%] text-4xl anim-impact"
                  style={{ animationDelay: "0.1s", filter: "drop-shadow(0 0 14px #fff)" }}
                >
                  ✨
                </div>
                {/* Damage number bursting out of the boss centre */}
                {burst.dmg > 0 && (
                  <div
                    className="absolute left-1/2 top-1/2 whitespace-nowrap arcade-heading arcade-heading-xl text-6xl anim-dmg-pop"
                    style={{ color: "var(--boom-yellow)" }}
                  >
                    -{burst.dmg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes boss-sway-kf {
          0%, 100% { transform: translateX(-14px); }
          50% { transform: translateX(14px); }
        }
        .boss-sway { animation: boss-sway-kf 3.4s ease-in-out infinite; position: relative; }
      `}</style>

      {/* Inner phase UI */}
      {inner.kind === "intro" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
          <div
            className="text-6xl font-black text-white anim-pop text-center px-6"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              textShadow: "4px 4px 0 #000, 0 0 24px #ef4444",
            }}
          >
            BOSS FIGHT!
          </div>
        </div>
      )}

      {inner.kind === "switch" && (
        <BossSwitch
          player={player}
          judge={judge}
          attack={inner.attack}
          onDone={onSwitchDone}
        />
      )}

      {inner.kind === "roll" && (
        <BossRoll
          player={inner.turnPlayer}
          onResult={onWheelResult}
        />
      )}

      {inner.kind === "judge" && (
        <BossJudge
          player={player}
          attack={inner.attack}
          onComplete={onJudgeDone}
          burst={burst}
          flashing={flashing}
          shaking={shaking}
        />
      )}

      {inner.kind === "hit" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div
            className="text-8xl font-black anim-pop text-center"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              color: inner.damage > 0 ? "var(--boom-yellow)" : "var(--boom-red)",
              textShadow: "5px 5px 0 #000, 0 0 30px #ef4444",
            }}
          >
            {inner.damage > 0 ? `-${inner.damage}` : "MISS!"}
          </div>
        </div>
      )}

      {inner.kind === "death" && <BossDeathOverlay />}

      {inner.kind !== "death" && (
      <div className="absolute left-0 right-0 bottom-0 z-40 p-3 pointer-events-none">
        {/* Big boss countdown clock */}
        <div className="flex justify-center mb-2">
          <div
            className={`ink-border rounded-2xl px-5 py-2 flex items-center gap-2 anim-ui-float ${remaining < 30_000 ? "arcade-low-time" : ""}`}
            style={{
              background: remaining < 30_000 ? "var(--boom-red)" : "var(--boom-yellow)",
              color: remaining < 30_000 ? "#fff" : "var(--boom-ink)",
            }}
          >
            <Flame size={28} />
            <span
              className="tabular-nums font-black leading-none"
              style={{ fontFamily: "'Luckiest Guy', cursive", fontSize: "clamp(2rem, 11vw, 3.2rem)" }}
            >
              {mm}:{ss}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-white text-sm font-black px-1 mb-1">
          <span className="flex items-center gap-1" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "1px 1px 0 #000" }}>
            <Skull size={18} /> BOSS HP
          </span>
        </div>
        <div className="relative h-10 rounded-full ink-border-sm overflow-hidden bg-[#1a0000]">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{
              width: `${hpPct * 100}%`,
              background: "linear-gradient(90deg, #16a34a 0%, #facc15 60%, #ef4444 100%)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm font-black" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "2px 2px 0 #000" }}>
            {room.boss_hp ?? 0} / {room.boss_max_hp ?? 0}
          </div>
        </div>
      </div>
      )}

    </main>
  );
}

function BossSwitch({
  player,
  judge,
  attack,
  onDone,
}: {
  player: Player;
  judge: Player;
  attack: Attack;
  onDone: () => void;
}) {
  const [count, setCount] = useState(3);
  const spoke = useRef(false);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (spoke.current) return;
    spoke.current = true;
    const unit = attack.unit === "seconds" ? `${attack.reps} seconds` : `${attack.reps} reps`;
    speak(`Player ${player.username}. ${attack.exercise}, ${unit}. Judge: ${judge.username}.`);
  }, [player.username, judge.username, attack]);
  useEffect(() => {
    if (count <= 0) {
      onDoneRef.current();
      return;
    }
    sfx.play("countdown");
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-between gap-2 p-4 pb-16 overflow-hidden" style={{ background: "#ffffff" }}>
      <div aria-hidden className="pointer-events-none absolute inset-2 rounded-[2rem]" style={{ border: "8px solid #111" }} />

      {/* Wedge mascot + banner */}
      <div className="flex flex-col items-center gap-2 w-full relative z-10">
        {attack.mascot && (
          <img
            src={attack.mascot}
            alt=""
            className="w-60 h-60 max-w-[62vw] max-h-[62vw] object-contain -mt-8 -mb-2 relative z-10 anim-mascot-bounce arcade-slam-in drop-shadow-[0_10px_0_rgba(0,0,0,0.3)]"
          />
        )}
        <div
          className="ink-border rounded-2xl px-4 py-1 bg-white arcade-tilt-l-sm arcade-slam-in anim-ui-float"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          <span className="text-2xl font-black" style={{ color: "var(--boom-red)" }}>
            {attack.wedgeLabel ? `BOSS · ${attack.wedgeLabel}` : "BOSS ATTACK"}
          </span>
        </div>
        <div className="ink-border rounded-2xl bg-white px-5 py-2 text-center max-w-[92%] arcade-slam-in anim-ui-float">
          <div
            className="font-black leading-tight"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              color: "var(--boom-ink)",
              fontSize: "clamp(1.6rem, 6vw, 2.25rem)",
            }}
          >
            {attack.exercise}
          </div>
          <div
            className="font-bold"
            style={{ color: "var(--boom-ink)", fontSize: "clamp(1rem, 4vw, 1.25rem)" }}
          >
            {attack.unit === "seconds" ? `Hold ${attack.reps}s` : `${attack.reps} reps`}
          </div>
          {attack.podWide && (
            <div className="text-sm font-black mt-1" style={{ color: "var(--boom-red)" }}>
              POD-WIDE · everyone hits together!
            </div>
          )}
        </div>
      </div>

      {/* Player → Judge handoff */}
      <div className="flex items-center justify-between gap-2 w-full max-w-md relative z-10">
        <div className="flex-1 min-w-0 flex flex-col items-center gap-2 anim-fade-in">
          <BossAvatar player={player} size={112} />
          <div className="text-base font-black uppercase tracking-wide" style={{ color: "var(--boom-ink)" }}>
            Player
          </div>
          <div
            className="w-full text-center font-black leading-tight truncate"
            style={{ color: "var(--boom-ink)", fontSize: "clamp(1.1rem, 5vw, 1.6rem)" }}
          >
            {player.username}
          </div>
        </div>
        <div className="text-5xl shrink-0">➡️</div>
        <div className="flex-1 min-w-0 flex flex-col items-center gap-2 anim-fade-in">
          <BossAvatar player={judge} size={112} />
          <div className="text-base font-black uppercase tracking-wide" style={{ color: "var(--boom-ink)" }}>
            Judge
          </div>
          <div
            className="w-full text-center font-black leading-tight truncate"
            style={{ color: "var(--boom-ink)", fontSize: "clamp(1.1rem, 5vw, 1.6rem)" }}
          >
            {judge.username}
          </div>
        </div>
      </div>

      <CountdownNumber value={count} />
      <div className="text-base font-black text-center px-6 relative z-10" style={{ color: "var(--boom-ink)" }}>
        Pass the phone to {judge.username}
      </div>
    </div>
  );
}

/**
 * Lightweight inline judge UI — tap-per-rep or hold-for-seconds. No camera
 * recording (kept simple for boss flow). On finish reports back actual reps
 * achieved so damage = reps * tier multiplier.
 */
function BossJudge({
  player,
  attack,
  onComplete,
  burst,
  flashing,
  shaking,
}: {
  player: Player;
  attack: Attack;
  onComplete: (outcome: "success" | "fail", achievedReps: number) => void;
  burst: { id: number; dmg: number } | null;
  flashing: boolean;
  shaking: boolean;
}) {
  const [reps, setReps] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [started] = useState(Date.now());
  const [, force] = useState(0);
  const done = useRef(false);
  const arcadeStop = useRef<(() => void) | null>(null);
  const holding = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        /* no camera — fall back to dark background */
      }
    })();
    return () => {
      cancelled = true;
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    arcadeStop.current = startArcadeRise(TRAP_TIMEOUT_MS);
    const i = setInterval(() => {
      if (holding.current && attack.unit === "seconds") setHoldMs((m) => m + 50);
      force((n) => n + 1);
    }, 50);
    return () => {
      arcadeStop.current?.();
      clearInterval(i);
    };
  }, [attack.unit]);

  const elapsed = Date.now() - started;
  const remaining = Math.max(0, TRAP_TIMEOUT_MS - elapsed);

  const finish = (outcome: "success" | "fail") => {
    if (done.current) return;
    done.current = true;
    arcadeStop.current?.();
    if (outcome === "success") {
      onComplete("success", attack.reps);
    } else {
      const achieved = attack.unit === "seconds"
        ? Math.floor(holdMs / 1000)
        : reps;
      // Partial damage on partial completion (half rate)
      onComplete("fail", Math.floor(achieved / 2));
    }
  };

  useEffect(() => {
    if (remaining <= 0) finish("fail");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  useEffect(() => {
    if (attack.unit !== "seconds") return;
    if (holdMs >= attack.reps * 1000 && !done.current) finish("success");
    if (holding.current) repPop(Math.min(1, holdMs / (attack.reps * 1000)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdMs]);

  const tap = () => {
    if (done.current || attack.unit !== "reps") return;
    setReps((r) => {
      const next = r + 1;
      repPop(next / attack.reps);
      if (next >= attack.reps) setTimeout(() => finish("success"), 30);
      return next;
    });
  };

  const ringSize = 200;
  const stroke = 14;
  const r = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const ringProgress = remaining / TRAP_TIMEOUT_MS;
  const dashOffset = circ * (1 - ringProgress);
  const holdFill =
    attack.unit === "seconds"
      ? Math.min(1, holdMs / (attack.reps * 1000))
      : reps / attack.reps;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-10 pointer-events-auto">
      {/* Camera background */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover -z-10"
      />
      <div className="absolute inset-0 bg-black/40 -z-10" />

      {/* Smaller moving boss overlay */}
      <div className="absolute top-3 right-3 pointer-events-none">
        <div className="boss-sway relative">
          <img
            src={bossMascot}
            alt=""
            className={`w-24 h-24 object-contain ${shaking ? "anim-shake" : "anim-mascot-bounce"}`}
            style={{
              filter: flashing
                ? "brightness(2.4) drop-shadow(0 0 18px #fff)"
                : "drop-shadow(0 4px 0 rgba(0,0,0,0.6))",
            }}
          />
          {burst && (
            <div
              key={burst.id}
              className="absolute inset-0 flex items-center justify-center anim-pop"
              aria-hidden
            >
              <div className="text-4xl" style={{ filter: "drop-shadow(0 0 12px #fff)" }}>💥</div>
            </div>
          )}
        </div>
      </div>

      {/* Player name tag */}
      <div className="absolute top-3 left-3 text-white">
        <div className="text-xs font-bold opacity-80" style={{ textShadow: "1px 1px 0 #000" }}>Player</div>
        <div className="text-lg font-black" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "2px 2px 0 #000" }}>
          {player.username}
        </div>
      </div>

      <div
        className="ink-border rounded-2xl px-4 py-2 mb-3 bg-white text-center"
        style={{ fontFamily: "'Luckiest Guy', cursive" }}
      >
        <div className="text-xl font-black" style={{ color: "var(--boom-ink)" }}>
          {attack.exercise}
        </div>
        <div className="text-sm font-bold" style={{ color: "var(--boom-ink)" }}>
          {attack.unit === "seconds" ? `Hold ${attack.reps}s` : `${attack.reps} reps`}
        </div>
      </div>
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        <svg width={ringSize} height={ringSize} className="absolute inset-0 -rotate-90">
          <circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke="rgba(255,255,255,0.25)" strokeWidth={stroke} fill="none" />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={r}
            stroke="var(--boom-red)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={r - stroke}
            stroke="var(--boom-yellow)"
            strokeWidth={6}
            fill="none"
            strokeDasharray={2 * Math.PI * (r - stroke)}
            strokeDashoffset={2 * Math.PI * (r - stroke) * (1 - holdFill)}
            strokeLinecap="round"
            opacity={0.9}
          />
        </svg>
        <button
          onPointerDown={
            attack.unit === "seconds"
              ? () => {
                  holding.current = true;
                }
              : tap
          }
          onPointerUp={
            attack.unit === "seconds"
              ? () => {
                  holding.current = false;
                }
              : undefined
          }
          onPointerCancel={
            attack.unit === "seconds"
              ? () => {
                  holding.current = false;
                }
              : undefined
          }
          onPointerLeave={
            attack.unit === "seconds"
              ? () => {
                  holding.current = false;
                }
              : undefined
          }
          className="absolute inset-5 rounded-full flex flex-col items-center justify-center gap-1 select-none arcade-press"
          style={{
            background: "var(--boom-red)",
            color: "white",
            border: "4px solid #000",
            boxShadow: "6px 6px 0 0 #000, 0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <span
            className="font-black anim-ui-wiggle"
            style={{ fontFamily: "'Luckiest Guy', cursive", fontSize: "clamp(2rem, 9vw, 3rem)", lineHeight: 1, textShadow: "3px 3px 0 #000" }}
          >
            ATTACK
          </span>
          <span className="text-xl font-black tabular-nums" style={{ textShadow: "2px 2px 0 #000" }}>
            {attack.unit === "reps"
              ? `${reps} / ${attack.reps}`
              : `${(holdMs / 1000).toFixed(1)}s / ${attack.reps}s`}
          </span>
          <span className="text-sm font-bold opacity-90">
            {attack.unit === "reps" ? "tap per rep" : "hold"}
          </span>
        </button>
      </div>
      <div
        className="mt-3 ink-border rounded-2xl px-4 py-2 text-xl font-black anim-ui-float"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          background: remaining <= 5000 ? "var(--boom-red)" : "var(--boom-yellow)",
          color: remaining <= 5000 ? "#fff" : "var(--boom-ink)",
        }}
      >
        {Math.ceil(remaining / 1000)}s to attack
      </div>
    </div>
  );
}

/**
 * Boss death sequence — long shake, big explosion flash, fullscreen mascot
 * with "YOU WIN!" before the parent route flips to the leaderboard.
 */
function BossDeathOverlay() {
  const [stage, setStage] = useState<"shake" | "boom" | "win">("shake");
  // Spam many small explosion bursts during the shake phase.
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number; s: number }>>([]);
  useEffect(() => {
    let id = 0;
    const spawn = window.setInterval(() => {
      setBursts((b) => [
        ...b.slice(-18),
        {
          id: id++,
          x: 10 + Math.random() * 80,
          y: 15 + Math.random() * 70,
          s: 0.6 + Math.random() * 1.1,
        },
      ]);
    }, 110);
    // Layered explosion sounds during the shake.
    const sfxTimers: number[] = [];
    for (let i = 0; i < 14; i++) {
      sfxTimers.push(window.setTimeout(() => sfx.play("blowUp"), 80 + i * 220));
    }
    // Big finale: loud explosion, then robot voice, then "YOU WIN!".
    const t1 = window.setTimeout(() => {
      setStage("boom");
      sfx.play("blowUp");
      window.setTimeout(() => sfx.play("blowUp"), 180);
      window.setTimeout(() => sfx.play("blowUp"), 360);
    }, 3400);
    const t2 = window.setTimeout(() => {
      setStage("win");
      speak("Boss defeated. Victory!", { pitch: 1.1, rate: 0.85 });
      haptic("success");
      sfx.play("winJingle");
    }, 4200);
    return () => {
      window.clearInterval(spawn);
      sfxTimers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);
  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center overflow-hidden ${
        stage === "win" ? "boss-arena-win anim-win-quake" : "boss-arena anim-shake"
      }`}
      style={{ transition: "background 400ms" }}
    >
      {/* Boss heavily shaking during the spam phase */}
      {stage === "shake" && (
        <img
          src={bossMascot}
          alt=""
          className="w-72 h-72 object-contain anim-shake"
          style={{ filter: "brightness(1.6) drop-shadow(0 0 30px #ef4444)" }}
        />
      )}
      {/* Scattered small explosion bursts */}
      {stage === "shake" && bursts.map((b) => (
        <div
          key={b.id}
          className="absolute anim-chain-boom pointer-events-none"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            filter: "drop-shadow(0 0 18px #fff)",
            fontSize: `${3.5 * b.s}rem`,
          }}
        >
          💥
        </div>
      ))}
      {/* One huge fullscreen explosion */}
      {stage === "boom" && (
        <div
          className="text-[22rem] anim-pop"
          style={{ filter: "drop-shadow(0 0 80px #fff) drop-shadow(0 0 200px #fbbf24)" }}
        >
          💥
        </div>
      )}
      {/* Victory card */}
      {stage === "win" && (
        <>
          {[
            { x: 14, y: 22, d: 0 },
            { x: 82, y: 28, d: 0.15 },
            { x: 26, y: 74, d: 0.3 },
            { x: 74, y: 80, d: 0.45 },
            { x: 50, y: 12, d: 0.6 },
          ].map((b) => (
            <div
              key={`${b.x}-${b.y}`}
              className="absolute anim-chain-boom pointer-events-none text-7xl"
              style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: `${b.d}s` }}
            >
              💥
            </div>
          ))}
        <div className="flex flex-col items-center gap-4 anim-pop">
          <img
            src={bossMascot}
            alt=""
            className="w-80 h-80 object-contain"
            style={{ filter: "grayscale(1) brightness(0.5) drop-shadow(0 0 20px #000)" }}
          />
          <div className="arcade-heading arcade-heading-xl text-[4.5rem] leading-none text-white text-center">
            YOU WIN!
          </div>
        </div>
        </>
      )}
    </div>
  );
}

/**
 * Victory screen — shown when room.phase === 'victory'.
 */
export function BossVictory({
  room,
  players,
  onRestart,
}: {
  room: Room;
  players: Player[];
  onRestart: () => void;
}) {
  const won = (room.boss_hp ?? 0) <= 0;
  const ranked = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  useEffect(() => {
    sfx.play(won ? "win" : "blowUp");
    speak(won ? "Boss defeated! Victory!" : "The boss wins. Train harder.", {
      pitch: won ? 1.1 : 0.6,
    });
  }, [won]);
  return (
    <main
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 p-6"
      style={{
        background: won
          ? "radial-gradient(ellipse at center, #fde047 0%, #ea580c 60%, #7c2d12 100%)"
          : "radial-gradient(ellipse at center, #7f1d1d 0%, #000 100%)",
      }}
    >
      <img
        src={bossMascot}
        alt=""
        width={768}
        height={768}
        loading="lazy"
        className="w-48 h-48 object-contain anim-explosion-flash"
        style={{ filter: won ? "grayscale(1) brightness(0.4)" : "drop-shadow(0 0 30px #ef4444)" }}
      />
      <div
        className="text-6xl font-black text-white text-center"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          textShadow: "5px 5px 0 #000",
        }}
      >
        {won ? "BOSS DEFEATED!" : "BOSS WINS"}
      </div>
      <div className="ink-border rounded-2xl bg-white p-3 w-full max-w-sm flex flex-col gap-1">
        <div className="text-sm font-black opacity-70 mb-1">Final scores</div>
        {ranked.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between">
            <span className="font-bold">
              {i + 1}. {p.username}
            </span>
            <span className="font-black" style={{ color: "var(--boom-red)" }}>
              {p.score ?? 0}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onRestart}
        className="btn-boom text-2xl py-3 px-6"
        style={{ background: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}
      >
        Play Again
      </button>
    </main>
  );
}

/**
 * Wheel-of-fortune roll screen. Player taps SPIN, the wheel decelerates
 * onto a random wedge, then we hand the chosen wedge back to the boss flow.
 */
function BossRoll({
  player,
  onResult,
}: {
  player: Player;
  onResult: (wedge: BossWedge) => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState<BossWedge | null>(null);
  const wedgeAngle = 360 / BOSS_WEDGES.length;

  const spin = () => {
    if (spinning || done) return;
    setSpinning(true);
    sfx.play("wheelTick");
    speak(`${player.username}, spin the wheel!`, { rate: 0.9 });
    const target = Math.floor(Math.random() * BOSS_WEDGES.length);
    const wedge = BOSS_WEDGES[target];
    // Pointer is at the top (12 o'clock). Each wedge i is centered at
    // angle (i * wedgeAngle + wedgeAngle/2) measured clockwise from 0°.
    // Rotate the wheel so that the chosen wedge ends up under the pointer.
    const finalDeg =
      360 * 6 - (target * wedgeAngle + wedgeAngle / 2);
    setRotation(finalDeg);
    // Ratchet ticks during the spin — slow down to mimic deceleration.
    const tickTimes = [60, 140, 230, 330, 440, 560, 700, 860, 1040, 1240, 1460, 1700];
    const timers = tickTimes.map((t) => window.setTimeout(() => sfx.play("wheelTick"), t));
    setTimeout(() => {
      timers.forEach((id) => clearTimeout(id));
      setDone(wedge);
      sfx.play("wheelStop");
      speak(wedge.label.replace("×", " times "));
      setTimeout(() => onResult(wedge), 900);
    }, 1900);
  };

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-between p-4 pb-20"
      style={{ background: "radial-gradient(ellipse at center, #2a0000 0%, #0a0000 80%)" }}
    >
      <div className="text-center mt-4 anim-pop">
        <div className="text-xs font-black uppercase tracking-widest text-white/80">
          Your turn
        </div>
        <div
          className="text-4xl font-black text-white"
          style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #000" }}
        >
          {player.username}
        </div>
        <div
          className="text-2xl font-black mt-1"
          style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-yellow)", textShadow: "2px 2px 0 #000" }}
        >
          SPIN THE WHEEL!
        </div>
      </div>

      <div className="relative flex items-center justify-center" style={{ width: "min(80vw, 320px)", height: "min(80vw, 320px)" }}>
        {/* Pointer */}
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-20"
          style={{
            width: 0,
            height: 0,
            borderLeft: "18px solid transparent",
            borderRight: "18px solid transparent",
            borderTop: "28px solid #fff",
            filter: "drop-shadow(0 2px 0 #111)",
          }}
        />
        <svg
          viewBox="-110 -110 220 220"
          className="w-full h-full"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? "transform 1.8s cubic-bezier(0.17, 0.67, 0.21, 0.99)" : "none",
            filter: "drop-shadow(0 6px 0 rgba(0,0,0,0.6))",
          }}
        >
          <circle cx={0} cy={0} r={105} fill="#111" />
          {BOSS_WEDGES.map((w, i) => {
            const start = (i * wedgeAngle - 90) * (Math.PI / 180);
            const end = ((i + 1) * wedgeAngle - 90) * (Math.PI / 180);
            const r = 100;
            const x1 = Math.cos(start) * r;
            const y1 = Math.sin(start) * r;
            const x2 = Math.cos(end) * r;
            const y2 = Math.sin(end) * r;
            const large = wedgeAngle > 180 ? 1 : 0;
            const midAngle = (i * wedgeAngle + wedgeAngle / 2 - 90) * (Math.PI / 180);
            const labelR = 62;
            const lx = Math.cos(midAngle) * labelR;
            const ly = Math.sin(midAngle) * labelR;
            const rot = i * wedgeAngle + wedgeAngle / 2;
            return (
              <g key={w.id}>
                <path
                  d={`M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                  fill={w.color}
                  stroke="#111"
                  strokeWidth={2}
                />
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rot} ${lx} ${ly})`}
                  style={{
                    fontFamily: "'Luckiest Guy', cursive",
                    fontSize: 9.5,
                    letterSpacing: -0.3,
                    fill: "#111",
                    fontWeight: 900,
                  }}
                >
                  {w.label}
                </text>
              </g>
            );
          })}
          <circle cx={0} cy={0} r={18} fill="#fff" stroke="#111" strokeWidth={3} />
        </svg>
      </div>

      {!done ? (
        <button
          onClick={spin}
          disabled={spinning}
          className="btn-massive w-[80vw] max-w-md"
          style={{
            background: "var(--boom-yellow)",
            color: "var(--boom-ink)",
            textShadow: "2px 2px 0 rgba(0,0,0,0.25)",
          }}
        >
          {spinning ? "SPINNING…" : "SPIN!"}
        </button>
      ) : (
        <div
          className="ink-border rounded-2xl px-6 py-3 text-2xl font-black anim-pop text-center flex flex-col items-center gap-2"
          style={{
            background: done.color,
            color: "#111",
            fontFamily: "'Luckiest Guy', cursive",
          }}
        >
          <img
            src={done.mascot}
            alt=""
            width={1024}
            height={1024}
            className="w-28 h-28 anim-mascot-bounce drop-shadow-[0_0_14px_rgba(0,0,0,0.4)]"
          />
          {done.label}
          {done.podWide && (
            <div className="text-xs font-black mt-1">POD-WIDE STRIKE!</div>
          )}
        </div>
      )}
    </div>
  );
}