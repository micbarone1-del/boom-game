import { useEffect, useMemo, useRef, useState } from "react";
import { Bomb, Flame, Skull } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Room } from "@/hooks/use-room";
import {
  pickCrazyExercise,
  pickSurpriseExercise,
  calcRepsForTier,
  TRAP_TIMEOUT_MS,
  type BoardOverrides,
} from "@/lib/game";
import {
  sfx,
  speak,
  repPop,
  startArcadeRise,
} from "@/lib/sfx";
import bossMascot from "@/assets/boss-mascot.png";

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
};

type InnerPhase =
  | { kind: "intro" }
  | { kind: "announce"; attack: Attack }
  | { kind: "judge"; attack: Attack }
  | { kind: "hit"; attack: Attack; damage: number; outcome: "success" | "fail" };

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
        <Bomb size={size * 0.6} color="white" fill="white" />
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
    // 50/50 crazy vs hard surprise pool
    const pick =
      Math.random() < 0.5 ? pickCrazyExercise() : pickSurpriseExercise(overrides);
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
    };
    setInner({ kind: "announce", attack });
  };

  const onAnnounceDone = () => {
    if (inner.kind !== "announce") return;
    setInner({ kind: "judge", attack: inner.attack });
  };

  const onJudgeDone = async (
    outcome: "success" | "fail",
    achievedReps: number,
  ) => {
    if (inner.kind !== "judge") return;
    const attack = inner.attack;
    const damage = Math.max(0, achievedReps * (attack.tier === 3 ? 3 : 2));
    if (damage > 0) {
      setHitFlash(Date.now());
      // Race-safe decrement.
      const newHp = Math.max(0, (room.boss_hp ?? 0) - damage);
      await supabase
        .from("rooms")
        .update({
          boss_hp: newHp,
          ...(newHp <= 0
            ? { phase: "victory", boss_defeated_at: new Date().toISOString() }
            : {}),
        })
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
      await supabase
        .from("players")
        .update({ current_space: Math.max(0, (cur?.current_space ?? 0) - 1) })
        .eq("id", attack.playerId);
      // Update player score.
      const cur = podPlayers.find((p) => p.id === attack.playerId);
      await supabase
        .from("players")
        .update({ score: (cur?.score ?? 0) + damage })
        .eq("id", attack.playerId);
      sfx.play("didIt");
      speak(`${player.username} hits the boss for ${damage}.`);
      setInner({ kind: "hit", attack, damage, outcome });
    } else {
      sfx.play("blowUp");
      speak(`${player.username} missed the boss.`);
      setInner({ kind: "hit", attack, damage: 0, outcome });
    }
    setTimeout(() => {
      setTurnIdx((i) => {
        const next = i + 1;
        startTurn(active[next % Math.max(1, active.length)]);
        return next;
      });
    }, 2000);
  };

  // Boss timeout → victory screen lost (game_over)
  useEffect(() => {
    if (remaining > 0) return;
    void (async () => {
      await supabase
        .from("rooms")
        .update({ phase: "victory", game_state: "game_over" })
        .eq("code", code);
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

  return (
    <main
      className="fixed inset-0 overflow-hidden flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse at top, #7a0000 0%, #1a0000 60%, #000 100%)",
      }}
    >
      {/* Top: boss HP + fuse */}
      <div className="absolute top-0 left-0 right-0 z-30 p-3 flex flex-col gap-1">
        <div className="flex items-center justify-between text-white text-xs font-black px-1">
          <span
            className="flex items-center gap-1"
            style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "1px 1px 0 #000" }}
          >
            <Skull size={14} /> BOSS HP
          </span>
          <span
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              color: remaining < 30_000 ? "var(--boom-yellow)" : "#fff",
              textShadow: "1px 1px 0 #000",
            }}
          >
            <Flame size={12} className="inline mb-1" /> {mm}:{ss}
          </span>
        </div>
        <div className="relative h-6 rounded-full ink-border-sm overflow-hidden bg-[#1a0000]">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{
              width: `${hpPct * 100}%`,
              background:
                "linear-gradient(90deg, #16a34a 0%, #facc15 60%, #ef4444 100%)",
            }}
          />
          <div
            className="absolute inset-0 flex items-center justify-center text-white text-[11px] font-black"
            style={{ textShadow: "1px 1px 0 #000" }}
          >
            {room.boss_hp ?? 0} / {room.boss_max_hp ?? 0}
          </div>
        </div>
      </div>

      {/* Boss sprite */}
      <div className="flex-1 flex items-center justify-center pt-16">
        <img
          src={bossMascot}
          alt="Boss"
          width={768}
          height={768}
          loading="lazy"
          className={`w-64 h-64 object-contain ${flashing ? "anim-explosion-flash" : "anim-mascot-bounce"}`}
          style={{
            filter: flashing
              ? "brightness(2.4) drop-shadow(0 0 24px #fff)"
              : "drop-shadow(0 12px 0 rgba(0,0,0,0.6))",
          }}
        />
      </div>

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

      {inner.kind === "announce" && (
        <BossAnnounce
          player={player}
          attack={inner.attack}
          onDone={onAnnounceDone}
        />
      )}

      {inner.kind === "judge" && (
        <BossJudge
          player={player}
          attack={inner.attack}
          onComplete={onJudgeDone}
        />
      )}

      {inner.kind === "hit" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div
            className="text-8xl font-black anim-pop"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              color: "var(--boom-yellow)",
              textShadow: "5px 5px 0 #000, 0 0 30px #ef4444",
            }}
          >
            -{inner.damage}
          </div>
        </div>
      )}

      {inner.kind === "miss" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-red-900/40 anim-explosion-flash">
          <div
            className="text-7xl font-black text-white"
            style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "4px 4px 0 #000" }}
          >
            MISSED!
          </div>
        </div>
      )}
    </main>
  );
}

function BossAnnounce({
  player,
  attack,
  onDone,
}: {
  player: Player;
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
    speak(`${player.username}: attack the boss with ${attack.exercise}, ${unit}!`);
  }, [player.username, attack]);
  useEffect(() => {
    if (count <= 0) {
      onDoneRef.current();
      return;
    }
    sfx.play("countdown");
    const t = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [count]);

  const color = avatarColor(player.avatar_url);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/60 p-4">
      <div
        className="rounded-full overflow-hidden flex items-center justify-center"
        style={{
          width: 96,
          height: 96,
          background: color,
          boxShadow: `0 0 0 4px #111, 0 0 0 8px ${color}`,
        }}
      >
        <Bomb size={56} color="white" fill="white" />
      </div>
      <div
        className="text-3xl font-black text-white text-center px-4"
        style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #000" }}
      >
        {player.username} ATTACKS!
      </div>
      <div
        className="ink-border rounded-2xl bg-white px-5 py-3 text-center max-w-[92%]"
      >
        <div
          className="font-black leading-tight"
          style={{
            fontFamily: "'Luckiest Guy', cursive",
            color: "var(--boom-ink)",
            fontSize: "clamp(1.5rem, 6vw, 2.25rem)",
          }}
        >
          {attack.exercise}
        </div>
        <div className="font-bold" style={{ color: "var(--boom-ink)" }}>
          {attack.unit === "seconds" ? `Hold ${attack.reps}s` : `${attack.reps} reps`}
        </div>
      </div>
      <div
        key={`bc-${count}`}
        className="anim-pop"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          color: count > 0 ? "var(--boom-red)" : "var(--boom-green)",
          fontSize: count > 0 ? "7rem" : "4rem",
          lineHeight: 1,
          textShadow: "0 6px 0 rgba(0,0,0,0.35), 3px 3px 0 #fff",
          WebkitTextStroke: "3px #111",
        }}
      >
        {count > 0 ? count : "GO!"}
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
}: {
  player: Player;
  attack: Attack;
  onComplete: (outcome: "success" | "fail", achievedReps: number) => void;
}) {
  const [reps, setReps] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [started] = useState(Date.now());
  const [, force] = useState(0);
  const done = useRef(false);
  const arcadeStop = useRef<(() => void) | null>(null);
  const holding = useRef(false);

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
      playDefuseJingle();
      speak(`${player.username} hits the boss!`);
      onComplete("success", attack.reps);
    } else {
      sfx.play("blowUp");
      speak(`${player.username} missed the boss.`);
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
          className="absolute inset-6 rounded-full flex flex-col items-center justify-center active:scale-95 select-none"
          style={{
            background: "var(--boom-red)",
            color: "white",
            boxShadow: "0 0 0 4px #111, 0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <span className="text-2xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            ATTACK
          </span>
          <span className="text-base font-bold">
            {attack.unit === "reps"
              ? `${reps} / ${attack.reps}`
              : `${(holdMs / 1000).toFixed(1)}s / ${attack.reps}s`}
          </span>
          <span className="text-xs opacity-80">
            {attack.unit === "reps" ? "tap per rep" : "hold"}
          </span>
        </button>
      </div>
      <div className="mt-2 text-white text-xs font-bold" style={{ textShadow: "1px 1px 0 #000" }}>
        {Math.ceil(remaining / 1000)}s
      </div>
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