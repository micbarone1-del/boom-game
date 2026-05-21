import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom, type Player } from "@/hooks/use-room";
import {
  rollDice,
  calcRepsForTier,
  getCell,
  getEffectiveCell,
  BOARD_SIZE,
  TRAP_TIMEOUT_MS,
  resolveMovementLanding,
  pickSurpriseExercise,
  pickCrazyExercise,
  pickGroupExercise,
  finishPlayer,
  recalcPlayerScore,
  describeCell,
  type BoardOverrides,
  type CellType,
} from "@/lib/game";
import { sfx, speak, repPop, startArcadeRise } from "@/lib/sfx";
import { Bomb, Dice5, Play, Share2, Download, RotateCcw } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { WorkoutIllustration } from "@/components/WorkoutIllustration";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";

export const Route = createFileRoute("/pod/$code")({
  component: PodPage,
  head: ({ params }) => ({
    meta: [
      { title: `Pod ${params.code} — BOOM!` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Phase =
  | { kind: "player"; playerId: string }
  | { kind: "switch"; playerId: string; judgeId: string; trap: ActiveTrap }
  | { kind: "judge"; playerId: string; judgeId: string; trap: ActiveTrap }
  | { kind: "resolve"; playerId: string; outcome: "success" | "fail"; trap: ActiveTrap }
  | { kind: "done"; winnerId: string };

type ActiveTrap = {
  exercise: string;
  reps: number; // target reps OR seconds
  unit: "reps" | "seconds";
  finalSpace: number;
};

function avatarIsMascot(url: string | null) {
  return !!url && url.startsWith("mascot:");
}
function mascotColor(url: string | null) {
  return avatarIsMascot(url) ? url!.slice(7) : "#ec4899";
}

function PodPage() {
  const { code } = Route.useParams();
  const { room, players, loading } = useRoom(code);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase | null>(null);
  const clipsRef = useRef<Map<string, Blob>>(new Map());
  const [, force] = useState(0);
  const tick = () => force((n) => n + 1);

  const ordered = useMemo(
    () => [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at)),
    [players],
  );

  // Initialize phase once players are loaded.
  useEffect(() => {
    if (loading || ordered.length === 0 || phase) return;
    const winner = ordered.find((p) => p.current_space >= BOARD_SIZE);
    if (winner) {
      setPhase({ kind: "done", winnerId: winner.id });
      return;
    }
    setPhase({ kind: "player", playerId: ordered[0].id });
  }, [loading, ordered, phase]);

  if (loading || !room || ordered.length === 0 || !phase) {
    return <div className="min-h-screen flex items-center justify-center text-2xl">Loading pod…</div>;
  }

  const overrides = (room.board_overrides ?? {}) as BoardOverrides;

  const nextPlayerId = (fromId: string): string => {
    const active = ordered.filter((p) => !p.finished_at);
    if (active.length === 0) return ordered[0].id;
    const idx = active.findIndex((p) => p.id === fromId);
    return active[(idx + 1) % active.length].id;
  };

  // --- Handlers between phases ---

  const onRollComplete = async (player: Player, dice: number) => {
    const target = Math.min(BOARD_SIZE, player.current_space + dice);
    const cell = getEffectiveCell(target, overrides);
    let final = target;
    if (cell.type === "boost") {
      final = resolveMovementLanding(Math.min(BOARD_SIZE, target + (cell.delta ?? 0)), "boost");
    } else if (cell.type === "setback") {
      final = resolveMovementLanding(Math.max(1, target + (cell.delta ?? 0)), "setback");
    } else if (cell.type === "finish") {
      final = BOARD_SIZE;
    }
    const finalCell = getEffectiveCell(final, overrides);

    await supabase.from("players").update({ current_space: final }).eq("id", player.id);

    // Decide phase: if exercise cell -> switch. Otherwise resolve / pass.
    if (
      finalCell.type === "easy" ||
      finalCell.type === "medium" ||
      finalCell.type === "hard"
    ) {
      const tier = finalCell.tier ?? 1;
      const reps = calcRepsForTier(tier, player.fitness_level, room.difficulty_multiplier);
      const trap: ActiveTrap = {
        exercise: finalCell.exercise ?? "Workout",
        reps,
        unit: overrides[String(final)]?.unit ?? "reps",
        finalSpace: final,
      };
      setPhase({ kind: "switch", playerId: player.id, judgeId: nextPlayerId(player.id), trap });
      return;
    }
    if (finalCell.type === "surprise" || finalCell.type === "crazy" || finalCell.type === "group") {
      const pick =
        finalCell.type === "surprise"
          ? pickSurpriseExercise(overrides)
          : finalCell.type === "crazy"
            ? pickCrazyExercise()
            : pickGroupExercise();
      const reps = calcRepsForTier(pick.tier, player.fitness_level, room.difficulty_multiplier);
      const trap: ActiveTrap = {
        exercise: pick.exercise,
        reps,
        unit: "reps",
        finalSpace: final,
      };
      setPhase({ kind: "switch", playerId: player.id, judgeId: nextPlayerId(player.id), trap });
      return;
    }
    // No exercise: finish?
    if (final >= BOARD_SIZE) {
      await finishPlayer(player.id, code);
      setPhase({ kind: "done", winnerId: player.id });
      return;
    }
    // Pass turn
    setPhase({ kind: "player", playerId: nextPlayerId(player.id) });
  };

  const onJudgeResult = async (outcome: "success" | "fail", clipBlob: Blob | null) => {
    if (phase.kind !== "judge") return;
    const { playerId, trap } = phase;
    const player = ordered.find((p) => p.id === playerId)!;
    if (clipBlob) clipsRef.current.set(`${playerId}-${Date.now()}`, clipBlob);

    if (outcome === "success") {
      await supabase.from("workout_logs").insert({
        room_code: code,
        player_id: playerId,
        exercise_name: trap.exercise,
        target_reps: trap.reps,
        unit: trap.unit,
        time_taken_ms: 0,
        verified_by_judge: true,
      });
      await recalcPlayerScore(playerId, code);
      if (trap.finalSpace >= BOARD_SIZE) {
        await finishPlayer(playerId, code);
        setPhase({ kind: "done", winnerId: playerId });
        return;
      }
      setPhase({ kind: "resolve", playerId, outcome, trap });
    } else {
      // Boom! Back to start.
      await supabase.from("players").update({ current_space: 0 }).eq("id", playerId);
      setPhase({ kind: "resolve", playerId, outcome, trap });
    }
    // Auto-advance after a beat.
    setTimeout(() => {
      setPhase({ kind: "player", playerId: nextPlayerId(player.id) });
    }, 2800);
  };

  const restart = async () => {
    await supabase
      .from("players")
      .update({ current_space: 0, score: 0, finished_at: null, finish_rank: null })
      .eq("room_code", code);
    await supabase
      .from("rooms")
      .update({ status: "lobby", trap: null, locked: false, current_turn_player_id: null })
      .eq("code", code);
    clipsRef.current.clear();
    navigate({ to: "/gym/$code", params: { code } });
  };

  // --- Render the active phase ---

  if (phase.kind === "done") {
    return (
      <WrapUp
        players={ordered}
        winnerId={phase.winnerId}
        clips={clipsRef.current}
        onRestart={restart}
      />
    );
  }

  if (phase.kind === "player") {
    const player = ordered.find((p) => p.id === phase.playerId)!;
    return (
      <>
        <PlayerPhase
          player={player}
          players={ordered}
          onRoll={(d) => onRollComplete(player, d)}
          code={code}
        />
      </>
    );
  }

  if (phase.kind === "switch") {
    const p = ordered.find((x) => x.id === phase.playerId)!;
    const j = ordered.find((x) => x.id === phase.judgeId)!;
    return (
      <SwitchPhase
        player={p}
        judge={j}
        trap={phase.trap}
        onDone={() =>
          setPhase({ kind: "judge", playerId: phase.playerId, judgeId: phase.judgeId, trap: phase.trap })
        }
      />
    );
  }

  if (phase.kind === "judge") {
    const p = ordered.find((x) => x.id === phase.playerId)!;
    return (
      <JudgePhase
        player={p}
        trap={phase.trap}
        onComplete={onJudgeResult}
      />
    );
  }

  // resolve
  const p = ordered.find((x) => x.id === phase.playerId)!;
  return <ResolveSplash player={p} outcome={phase.outcome} />;
}

// ---------------------------------------------------------------------------
// Progress bar (3 player tokens positioned along cells 1..60)
// ---------------------------------------------------------------------------

function ProgressBar({ players, activeId }: { players: Player[]; activeId: string }) {
  return (
    <div className="absolute left-0 right-0 bottom-0 p-3 pointer-events-none z-30">
      <div className="relative h-10 rounded-full bg-white/90 ink-border-sm">
        {/* finish flag */}
        <div
          className="absolute -top-2 -right-2 text-xl"
          aria-hidden
          style={{ filter: "drop-shadow(0 1px 0 #111)" }}
        >
          🏁
        </div>
        {players.map((p) => {
          const pos = Math.max(0, Math.min(1, (p.current_space - 1) / (BOARD_SIZE - 1)));
          const color = mascotColor(p.avatar_url);
          const isActive = p.id === activeId;
          return (
            <div
              key={p.id}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all"
              style={{ left: `${pos * 100}%` }}
              title={p.username}
            >
              <div
                className="rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  width: isActive ? 38 : 28,
                  height: isActive ? 38 : 28,
                  background: color,
                  boxShadow: `0 0 0 2px #111${isActive ? ", 0 0 0 4px white, 0 0 0 6px " + color : ""}`,
                }}
              >
                {avatarIsMascot(p.avatar_url) ? (
                  <Bomb size={isActive ? 22 : 16} color="white" fill="white" />
                ) : (
                  <img src={p.avatar_url!} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Avatar({ player, size = 120 }: { player: Player; size?: number }) {
  const color = mascotColor(player.avatar_url);
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
      {avatarIsMascot(player.avatar_url) ? (
        <Bomb size={size * 0.6} color="white" fill="white" />
      ) : (
        <img src={player.avatar_url!} alt="" className="w-full h-full object-cover" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase: PLAYER (roll dice)
// ---------------------------------------------------------------------------

function PlayerPhase({
  player,
  players,
  onRoll,
  code,
}: {
  player: Player;
  players: Player[];
  onRoll: (dice: number) => void;
  code: string;
}) {
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);

  const handleRoll = async () => {
    if (rolling) return;
    setRolling(true);
    setFace(null);
    sfx.play("hop");
    // dice shake
    const start = Date.now();
    const interval = setInterval(() => {
      setFace(1 + Math.floor(Math.random() * 6));
    }, 80);
    await new Promise((r) => setTimeout(r, 800));
    clearInterval(interval);
    const final = rollDice();
    setFace(final);
    sfx.play("didIt");
    await new Promise((r) => setTimeout(r, 700));
    setRolling(false);
    onRoll(final);
    void start;
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center p-6 gap-6 bg-[var(--background)]">
      <div className="absolute top-2 left-2 right-2 z-20">
        <SpotifyEmbed code={code} />
      </div>
      <div className="text-xs font-bold opacity-60 uppercase tracking-wider mt-32">Your turn</div>
      <Avatar player={player} size={140} />
      <div
        className="text-4xl font-black"
        style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-ink)" }}
      >
        {player.username}
      </div>

      <button
        onClick={handleRoll}
        disabled={rolling}
        className="w-44 h-44 rounded-3xl ink-border flex items-center justify-center active:scale-95 transition-transform"
        style={{ background: "var(--boom-yellow)" }}
        aria-label="Roll the dice"
      >
        {face === null ? (
          <Dice5 size={120} style={{ color: "var(--boom-ink)" }} />
        ) : (
          <span
            className="text-8xl font-black"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-ink)" }}
          >
            {face}
          </span>
        )}
      </button>
      <div className="text-sm opacity-60">Tap to roll</div>

      <ProgressBar players={players} activeId={player.id} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Phase: SWITCH (announce player → judge handoff)
// ---------------------------------------------------------------------------

function SwitchPhase({
  player,
  judge,
  trap,
  onDone,
}: {
  player: Player;
  judge: Player;
  trap: ActiveTrap;
  onDone: () => void;
}) {
  const [count, setCount] = useState(3);
  const spokeRef = useRef(false);

  useEffect(() => {
    if (spokeRef.current) return;
    spokeRef.current = true;
    const unit = trap.unit === "seconds" ? `${trap.reps} seconds` : `${trap.reps} reps`;
    speak(`Player ${player.username}. ${trap.exercise}, ${unit}. Judge: ${judge.username}.`);
  }, [player.username, judge.username, trap]);

  useEffect(() => {
    if (count <= 0) {
      onDone();
      return;
    }
    sfx.play("countdown");
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onDone]);

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center p-4 gap-6 bg-[var(--background)]">
      <div className="flex items-center justify-around w-full max-w-md">
        <div className="flex flex-col items-center gap-2 anim-fade-in">
          <Avatar player={player} size={100} />
          <div className="text-sm font-black uppercase" style={{ color: "var(--boom-red)" }}>
            Player
          </div>
          <div className="text-base font-bold">{player.username}</div>
        </div>
        <div className="text-5xl">➡️</div>
        <div className="flex flex-col items-center gap-2 anim-fade-in">
          <Avatar player={judge} size={100} />
          <div className="text-sm font-black uppercase" style={{ color: "var(--boom-yellow)" }}>
            Judge
          </div>
          <div className="text-base font-bold">{judge.username}</div>
        </div>
      </div>

      <WorkoutIllustration exercise={trap.exercise} />
      <div className="text-center">
        <div
          className="text-3xl font-black"
          style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-ink)" }}
        >
          {trap.exercise}
        </div>
        <div className="text-xl font-bold">
          {trap.unit === "seconds" ? `Hold ${trap.reps}s` : `${trap.reps} reps`}
        </div>
      </div>

      <div
        className="text-9xl font-black anim-fade-in"
        style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
      >
        {count > 0 ? count : "GO!"}
      </div>

      <div className="text-sm font-bold opacity-70 text-center px-6">
        Pass the phone to {judge.username}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Phase: JUDGE (camera + defuse ring + tap/hold)
// ---------------------------------------------------------------------------

function JudgePhase({
  player,
  trap,
  onComplete,
}: {
  player: Player;
  trap: ActiveTrap;
  onComplete: (outcome: "success" | "fail", clip: Blob | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [camError, setCamError] = useState<string | null>(null);
  const [reps, setReps] = useState(0);
  const [holdMs, setHoldMs] = useState(0); // for seconds mode
  const [started] = useState(Date.now());
  const [, force] = useState(0);
  const completedRef = useRef(false);
  const arcadeStopRef = useRef<(() => void) | null>(null);
  const holdingRef = useRef(false);
  const holdStartRef = useRef(0);

  // Acquire camera + start recording
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: true,
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
        try {
          const rec = new MediaRecorder(stream);
          recorderRef.current = rec;
          rec.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };
          rec.start();
        } catch {
          /* MediaRecorder unsupported on some browsers */
        }
      } catch (e) {
        setCamError(e instanceof Error ? e.message : "Camera denied");
      }
    })();
    arcadeStopRef.current = startArcadeRise(TRAP_TIMEOUT_MS);
    return () => {
      cancelled = true;
      arcadeStopRef.current?.();
      arcadeStopRef.current = null;
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
    };
  }, []);

  // Tick to redraw the ring + accumulate hold time
  useEffect(() => {
    const i = setInterval(() => {
      if (holdingRef.current && trap.unit === "seconds") {
        setHoldMs((m) => m + 50);
      }
      force((n) => n + 1);
    }, 50);
    return () => clearInterval(i);
  }, [trap.unit]);

  const elapsed = Date.now() - started;
  const remaining = Math.max(0, TRAP_TIMEOUT_MS - elapsed);
  const ringProgress = remaining / TRAP_TIMEOUT_MS;

  // Timeout = fail
  useEffect(() => {
    if (completedRef.current) return;
    if (remaining <= 0) finish("fail");
  }, [remaining]);

  const finish = (outcome: "success" | "fail") => {
    if (completedRef.current) return;
    completedRef.current = true;
    arcadeStopRef.current?.();
    arcadeStopRef.current = null;
    if (outcome === "success") {
      sfx.play("win");
      speak(`Well done ${player.username}! ${trap.reps} points!`);
    } else {
      sfx.play("blowUp");
      speak(`${player.username} exploded! Back to start.`);
    }
    // Stop recorder & collect blob
    const rec = recorderRef.current;
    const done = (blob: Blob | null) => onComplete(outcome, blob);
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: chunksRef.current[0].type || "video/webm" })
          : null;
        done(blob);
      };
      try {
        rec.stop();
      } catch {
        done(null);
      }
    } else {
      done(null);
    }
  };

  // Rep mode: tap per rep
  const tap = () => {
    if (completedRef.current) return;
    if (trap.unit !== "reps") return;
    setReps((r) => {
      const next = r + 1;
      repPop(next / trap.reps);
      if (next >= trap.reps) {
        setTimeout(() => finish("success"), 50);
      }
      return next;
    });
  };

  // Hold mode: pointer down/up
  const onHoldStart = () => {
    if (completedRef.current || trap.unit !== "seconds") return;
    holdingRef.current = true;
    holdStartRef.current = Date.now();
  };
  const onHoldEnd = () => {
    if (trap.unit !== "seconds") return;
    holdingRef.current = false;
  };

  useEffect(() => {
    if (trap.unit !== "seconds") return;
    if (holdMs >= trap.reps * 1000 && !completedRef.current) {
      finish("success");
    }
    // Rising pitch while holding
    if (holdingRef.current) repPop(Math.min(1, holdMs / (trap.reps * 1000)));
  }, [holdMs, trap]);

  const ringSize = 220;
  const stroke = 14;
  const r = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - ringProgress);
  const holdFill = trap.unit === "seconds" ? Math.min(1, holdMs / (trap.reps * 1000)) : reps / trap.reps;

  if (camError) {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center p-6 gap-4 text-center bg-black text-white">
        <div className="text-2xl font-black">📷 Camera blocked</div>
        <p className="opacity-80 text-sm">{camError}</p>
        <p className="opacity-80 text-sm">You can still play without recording.</p>
        <button
          onClick={() => {
            setCamError(null);
            // continue without camera; treat as if recording just isn't running
          }}
          className="btn-boom"
          style={{ background: "var(--boom-yellow)", fontFamily: "'Luckiest Guy', cursive" }}
        >
          Continue anyway
        </button>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 bg-black overflow-hidden">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Corner overlays */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
        <img src={bombMascot} alt="" className="w-10 h-10 anim-fuse" />
        <span
          className="text-xl font-black text-white"
          style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "2px 2px 0 #000" }}
        >
          BOOM!
        </span>
      </div>
      <div className="absolute top-3 right-3 z-20 text-right">
        <div className="text-white text-xs font-bold opacity-80" style={{ textShadow: "1px 1px 0 #000" }}>
          Player
        </div>
        <div className="text-white text-xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "2px 2px 0 #000" }}>
          {player.username}
        </div>
      </div>
      <div className="absolute bottom-3 left-3 z-20 text-white text-xs font-bold opacity-90" style={{ textShadow: "1px 1px 0 #000" }}>
        boomworkout.fun
      </div>
      <div className="absolute bottom-3 right-3 z-20 text-white text-xs font-bold opacity-90" style={{ textShadow: "1px 1px 0 #000" }}>
        {trap.exercise}
      </div>

      {/* Center: ring + defuse */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-32 z-10">
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
              stroke="var(--boom-green)"
              strokeWidth={6}
              fill="none"
              strokeDasharray={2 * Math.PI * (r - stroke)}
              strokeDashoffset={2 * Math.PI * (r - stroke) * (1 - holdFill)}
              strokeLinecap="round"
              opacity={0.9}
            />
          </svg>
          <button
            onPointerDown={trap.unit === "seconds" ? onHoldStart : tap}
            onPointerUp={trap.unit === "seconds" ? onHoldEnd : undefined}
            onPointerCancel={trap.unit === "seconds" ? onHoldEnd : undefined}
            onPointerLeave={trap.unit === "seconds" ? onHoldEnd : undefined}
            className="absolute inset-6 rounded-full flex flex-col items-center justify-center active:scale-95 select-none"
            style={{
              background: "var(--boom-red)",
              color: "white",
              boxShadow: "0 0 0 4px #111, 0 8px 24px rgba(0,0,0,0.5)",
            }}
          >
            <span className="text-3xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
              DEFUSE
            </span>
            <span className="text-base font-bold">
              {trap.unit === "reps"
                ? `${reps} / ${trap.reps}`
                : `${(holdMs / 1000).toFixed(1)}s / ${trap.reps}s`}
            </span>
            <span className="text-xs opacity-80">
              {trap.unit === "reps" ? "tap per rep" : "hold"}
            </span>
          </button>
        </div>
        <div className="mt-3 text-white text-sm font-bold" style={{ textShadow: "1px 1px 0 #000" }}>
          {Math.ceil(remaining / 1000)}s to defuse
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Phase: RESOLVE (brief splash before next player)
// ---------------------------------------------------------------------------

function ResolveSplash({ player, outcome }: { player: Player; outcome: "success" | "fail" }) {
  return (
    <main
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 anim-explosion-flash"
      style={{ background: outcome === "success" ? "var(--boom-green)" : "var(--boom-red)" }}
    >
      <Avatar player={player} size={140} />
      <div
        className="text-5xl font-black text-white text-center px-6"
        style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #111" }}
      >
        {outcome === "success" ? `${player.username}\nDEFUSED!` : `${player.username}\nBOOM! 💥`}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Phase: WRAP UP
// ---------------------------------------------------------------------------

function WrapUp({
  players,
  winnerId,
  clips,
  onRestart,
}: {
  players: Player[];
  winnerId: string;
  clips: Map<string, Blob>;
  onRestart: () => void;
}) {
  const winner = players.find((p) => p.id === winnerId)!;
  const ranked = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const clipList = Array.from(clips.entries());
  const [spoken, setSpoken] = useState(false);

  useEffect(() => {
    if (spoken) return;
    setSpoken(true);
    sfx.play("win");
    speak(`${winner.username} wins!`);
  }, [spoken, winner.username]);

  const downloadClip = (blob: Blob, idx: number) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boom-clip-${idx + 1}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shareClip = async (blob: Blob, idx: number) => {
    const file = new File([blob], `boom-clip-${idx + 1}.webm`, { type: blob.type });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "BOOM! workout clip" });
        return;
      } catch {
        /* fall through to download */
      }
    }
    downloadClip(blob, idx);
  };

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col gap-4">
      {/* Winner explosion banner */}
      <div className="relative ink-border rounded-3xl p-6 flex flex-col items-center gap-3 anim-explosion-flash" style={{ background: "var(--boom-yellow)" }}>
        <div className="text-sm font-black opacity-70 uppercase">Champion</div>
        <Avatar player={winner} size={120} />
        <div className="text-4xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}>
          {winner.username} WINS!
        </div>
      </div>

      {/* Ranking */}
      <div className="ink-border rounded-2xl p-4 bg-white flex flex-col gap-2">
        <div className="text-lg font-black mb-1">Final Ranking</div>
        {ranked.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 py-2">
            <div className="text-2xl font-black w-8" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
              {i + 1}
            </div>
            <Avatar player={p} size={44} />
            <div className="flex-1 font-bold">{p.username}</div>
            <div className="font-black" style={{ color: "var(--boom-red)" }}>
              {p.score ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* Clips */}
      <div className="ink-border rounded-2xl p-4 bg-white flex flex-col gap-2">
        <div className="text-lg font-black mb-1">Game Highlights</div>
        {clipList.length === 0 ? (
          <div className="text-sm opacity-60">No clips captured this round.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {clipList.map(([key, blob], idx) => (
              <div key={key} className="ink-border-sm rounded-xl p-2 flex flex-col gap-1">
                <video
                  src={URL.createObjectURL(blob)}
                  controls
                  playsInline
                  className="w-full rounded-lg bg-black"
                />
                <div className="flex gap-1">
                  <button
                    onClick={() => shareClip(blob, idx)}
                    className="flex-1 ink-border-sm rounded-lg py-1 text-xs font-bold flex items-center justify-center gap-1"
                    style={{ background: "var(--boom-yellow)" }}
                  >
                    <Share2 size={12} /> Share
                  </button>
                  <button
                    onClick={() => downloadClip(blob, idx)}
                    className="ink-border-sm rounded-lg py-1 px-2 text-xs font-bold"
                  >
                    <Download size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="text-xs opacity-50 italic mt-2">Summary edit — coming soon</div>
      </div>

      <button
        onClick={onRestart}
        className="btn-boom mt-2 text-2xl py-4"
        style={{ background: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}
      >
        <RotateCcw className="inline mr-2" /> Play Again
      </button>
      <Link to="/" className="text-center text-xs opacity-60 underline">
        Back to home
      </Link>
    </main>
  );
}

// Suppress unused-import lint for icons consumed conditionally.
void Play;
void describeCell;
void getCell;