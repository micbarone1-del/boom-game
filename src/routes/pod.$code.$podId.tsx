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
import { sfx, speak, repPop, startArcadeRise, startArcadeMusic, setBgmIntensity, startTechnoLayer, playDefuseJingle } from "@/lib/sfx";
import { Bomb, Dice5, Play, Share2, Download, RotateCcw, Flame } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { mascotForCell, CELL_FLAVOR } from "@/components/CellMascot";
import { TimesOutOverlay, GameOverOverlay } from "@/components/TimeoutOverlay";

export const Route = createFileRoute("/pod/$code/$podId")({
  component: PodPage,
  head: ({ params }) => ({
    meta: [
      { title: `Pod ${params.podId.slice(0, 6)} — BOOM!` },
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
  cellType: CellType;
};

function avatarIsMascot(url: string | null) {
  return !!url && url.startsWith("mascot:");
}
function mascotColor(url: string | null) {
  return avatarIsMascot(url) ? url!.slice(7) : "#ec4899";
}

function PodPage() {
  const { code, podId } = Route.useParams();
  const { room, players, loading } = useRoom(code);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase | null>(null);
  const clipsRef = useRef<Map<string, Blob>>(new Map());
  const [, force] = useState(0);
  const tick = () => force((n) => n + 1);

  const ordered = useMemo(
    () =>
      players
        .filter((p) => p.pod_id === podId)
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at)),
    [players, podId],
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

  const startedAt = room.game_started_at ? new Date(room.game_started_at).getTime() : null;
  const endsAt = room.game_ends_at ? new Date(room.game_ends_at).getTime() : null;
  const continueAt = room.continue_deadline_at ? new Date(room.continue_deadline_at).getTime() : null;

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
      const overrideUnit = overrides[String(final)]?.unit;
      const isHold = /\bhold\b/i.test(finalCell.exercise ?? "");
      const unit: "reps" | "seconds" = overrideUnit ?? (isHold ? "seconds" : "reps");
      const trap: ActiveTrap = {
        exercise: finalCell.exercise ?? "Workout",
        reps,
        unit,
        finalSpace: final,
        cellType: finalCell.type,
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
      const isHold = /\bhold\b/i.test(pick.exercise);
      const trap: ActiveTrap = {
        exercise: pick.exercise,
        reps,
        unit: isHold ? "seconds" : "reps",
        finalSpace: final,
        cellType: finalCell.type,
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
    const startedAtNew = new Date();
    const endsAtNew = new Date(startedAtNew.getTime() + 15 * 60 * 1000);
    await supabase
      .from("players")
      .update({ current_space: 0, score: 0, finished_at: null, finish_rank: null })
      .eq("pod_id", podId);
    await supabase
      .from("pods")
      .update({ status: "playing", current_space: 0, score: 0, current_turn_player_id: null })
      .eq("id", podId);
    // Restart the room fuse so everyone gets a fresh 15 minutes.
    await supabase
      .from("rooms")
      .update({
        status: "playing",
        game_started_at: startedAtNew.toISOString(),
        game_ends_at: endsAtNew.toISOString(),
        game_state: "playing",
        continue_deadline_at: null,
      })
      .eq("code", code);
    clipsRef.current.clear();
    setPhase({ kind: "player", playerId: ordered[0].id });
  };

  const onContinue = async () => {
    const newEnds = new Date(Date.now() + 5 * 60 * 1000);
    await supabase
      .from("rooms")
      .update({
        game_state: "playing",
        game_ends_at: newEnds.toISOString(),
        continue_deadline_at: null,
      })
      .eq("code", code);
  };

  // Render the timeout / game-over overlays on top of whatever phase is active.
  const overlay = (() => {
    if (room.game_state === "timeout_continue" && continueAt) {
      return <TimesOutOverlay continueDeadlineAt={continueAt} onContinue={onContinue} showContinue />;
    }
    if (room.game_state === "game_over") {
      return <GameOverOverlay onRestart={restart} />;
    }
    return null;
  })();

  // --- Render the active phase ---

  if (phase.kind === "done") {
    return (
      <>
        <WrapUp
          players={ordered}
          winnerId={phase.winnerId}
          clips={clipsRef.current}
          onRestart={restart}
        />
        {overlay}
      </>
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
          onRestart={restart}
          startedAt={startedAt}
          endsAt={endsAt}
        />
        {overlay}
      </>
    );
  }

  if (phase.kind === "switch") {
    const p = ordered.find((x) => x.id === phase.playerId)!;
    const j = ordered.find((x) => x.id === phase.judgeId)!;
    return (
      <>
        <SwitchPhase
          player={p}
          judge={j}
          trap={phase.trap}
          onDone={() =>
            setPhase({ kind: "judge", playerId: phase.playerId, judgeId: phase.judgeId, trap: phase.trap })
          }
        />
        {overlay}
      </>
    );
  }

  if (phase.kind === "judge") {
    const p = ordered.find((x) => x.id === phase.playerId)!;
    return (
      <>
        <JudgePhase
          player={p}
          trap={phase.trap}
          onComplete={onJudgeResult}
        />
        {overlay}
      </>
    );
  }

  // resolve
  const p = ordered.find((x) => x.id === phase.playerId)!;
  return (
    <>
      <ResolveSplash player={p} outcome={phase.outcome} />
      {overlay}
    </>
  );
}

// ---------------------------------------------------------------------------
// Global fuse bar — always-visible top strip so players see time burning
// regardless of which phase they are in.
// ---------------------------------------------------------------------------
function ProgressBar({
  players,
  activeId,
  startedAt,
  endsAt,
}: {
  players: Player[];
  activeId: string;
  startedAt?: number | null;
  endsAt?: number | null;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!startedAt || !endsAt) return;
    const i = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(i);
  }, [startedAt, endsAt]);
  const fuseP =
    startedAt && endsAt
      ? Math.max(0, Math.min(1, (Date.now() - startedAt) / (endsAt - startedAt)))
      : 0;
  const remaining =
    startedAt && endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0;
  const mm = String(Math.floor(remaining / 60));
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <div className="absolute left-0 right-0 bottom-0 p-3 pointer-events-none z-30">
      {startedAt && endsAt && (
        <div className="flex justify-between items-center text-[11px] font-black px-1 mb-1" style={{ color: "var(--boom-ink)" }}>
          <span style={{ fontFamily: "'Luckiest Guy', cursive" }}>FUSE · PROGRESS</span>
          <span
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              color: fuseP > 0.8 ? "var(--boom-red)" : "var(--boom-ink)",
            }}
          >
            {mm}:{ss}
          </span>
        </div>
      )}
      <div
        className="relative h-10 rounded-full ink-border-sm overflow-hidden"
        style={{
          background:
            "repeating-linear-gradient(45deg, #f59e0b 0 8px, #fbbf24 8px 16px)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,.25)",
        }}
      >
        {/* Fuse burn underlay (charred trail left of the flame) */}
        {startedAt && endsAt && (
          <>
            <div
              className="absolute inset-y-0 left-0 transition-all duration-500"
              style={{
                width: `${fuseP * 100}%`,
                background:
                  "linear-gradient(90deg, #111 0%, #2a2a2a 55%, #5a2a08 90%, #b45309 100%)",
              }}
            />
            {/* Flame at the burn head */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500 z-10"
              style={{ left: `${fuseP * 100}%` }}
              aria-hidden
            >
              <Flame
                size={26}
                fill="var(--boom-red)"
                color="var(--boom-yellow)"
                className="anim-fuse"
                style={{ filter: "drop-shadow(0 0 8px rgba(255,90,0,.95))" }}
              />
            </div>
          </>
        )}
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
  onRestart,
  startedAt,
  endsAt,
}: {
  player: Player;
  players: Player[];
  onRoll: (dice: number) => void;
  code: string;
  onRestart: () => void;
  startedAt: number | null;
  endsAt: number | null;
}) {
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const [hopping, setHopping] = useState<{ from: number; to: number; step: number } | null>(null);

  // Drive arcade BGM intensity from fuse progress.
  useEffect(() => {
    if (!startedAt || !endsAt) return;
    const i = setInterval(() => {
      const p = Math.max(0, Math.min(1, (Date.now() - startedAt) / (endsAt - startedAt)));
      setBgmIntensity(p);
    }, 1000);
    return () => clearInterval(i);
  }, [startedAt, endsAt]);

  const handleRoll = async () => {
    if (rolling) return;
    void sfx.unlock();
    startArcadeMusic();
    startTechnoLayer();
    speak(`${player.username}, roll the dice.`, { volume: 1, rate: 0.8, pitch: 0.8 });
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
    await new Promise((r) => setTimeout(r, 500));
    // Hopping animation — token jumps cell-by-cell from current space to target.
    const from = player.current_space;
    const to = Math.min(BOARD_SIZE, from + final);
    setHopping({ from, to, step: 0 });
    for (let i = 1; i <= final; i++) {
      await new Promise((r) => setTimeout(r, 220));
      setHopping({ from, to, step: i });
      sfx.play("hop");
    }
    await new Promise((r) => setTimeout(r, 350));
    setHopping(null);
    setRolling(false);
    onRoll(final);
    void start;
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center p-6 gap-6 bg-[var(--background)]">
      {hopping && (
        <HopOverlay player={player} from={hopping.from} to={hopping.to} step={hopping.step} />
      )}
      <button
        onClick={() => {
          if (confirm("Leave this pod and go back to Home?")) {
            window.location.href = "/";
          }
        }}
        className="absolute top-3 right-3 z-30 rounded-full ink-border-sm bg-white px-3 py-2 flex items-center gap-1 text-xs font-black active:scale-95"
        aria-label="Back to Home"
      >
        <RotateCcw size={14} /> Home
      </button>
      <div className="text-xs font-bold opacity-60 uppercase tracking-wider">Your turn</div>
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

      <ProgressBar
        players={players}
        activeId={player.id}
        startedAt={startedAt}
        endsAt={endsAt}
      />
      <div className="absolute left-0 right-0 bottom-16 z-30 pointer-events-none text-center text-[10px] opacity-70 font-bold">
        Room {code} · share to add more pods
      </div>
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
  const mascotImg = mascotForCell(trap.cellType);
  const flavor = CELL_FLAVOR[trap.cellType];

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
    <main
      className="fixed inset-0 flex flex-col items-center justify-between p-4 gap-3"
      style={{ background: flavor.color, transition: "background 250ms" }}
    >
      {/* Cell mascot + label banner */}
      <div className="flex flex-col items-center gap-2 mt-2 w-full">
        <img
          src={mascotImg}
          alt=""
          key={`cellmascot-${trap.cellType}`}
          className="w-28 h-28 anim-mascot-bounce drop-shadow-[0_6px_0_rgba(0,0,0,0.25)]"
        />
        <div
          className="ink-border rounded-2xl px-4 py-1 bg-white"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          <span
            className="text-2xl font-black"
            style={{ color: flavor.color === "#7c3aed" ? "#7c3aed" : "var(--boom-ink)" }}
          >
            {flavor.label}
          </span>
        </div>
        <div className="text-center ink-border rounded-2xl bg-white px-4 py-2 max-w-[92%]">
          <div
            className="font-black leading-tight"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              color: "var(--boom-ink)",
              fontSize: "clamp(1.6rem, 6vw, 2.25rem)",
            }}
          >
            {trap.exercise}
          </div>
          <div
            className="font-bold"
            style={{
              color: "var(--boom-ink)",
              fontSize: "clamp(1rem, 4vw, 1.25rem)",
            }}
          >
            {trap.unit === "seconds" ? `Hold ${trap.reps}s` : `${trap.reps} reps`}
          </div>
        </div>
      </div>

      {/* Player → Judge handoff */}
      <div className="flex items-center justify-around w-full max-w-md">
        <div className="flex flex-col items-center gap-1 anim-fade-in">
          <Avatar player={player} size={72} />
          <div className="text-xs font-black uppercase" style={{ color: "var(--boom-red)" }}>
            Player
          </div>
          <div className="text-sm font-bold">{player.username}</div>
        </div>
        <div className="text-4xl">➡️</div>
        <div className="flex flex-col items-center gap-1 anim-fade-in">
          <Avatar player={judge} size={72} />
          <div className="text-xs font-black uppercase" style={{ color: "var(--boom-yellow)" }}>
            Judge
          </div>
          <div className="text-sm font-bold">{judge.username}</div>
        </div>
      </div>

      {/* Countdown — standalone, no mascot underneath */}
      <div
        key={`count-${count}`}
        className="anim-pop"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          color: count > 0 ? "var(--boom-red)" : "var(--boom-green)",
          fontSize: count > 0 ? "8rem" : "4.5rem",
          lineHeight: 1,
          textShadow: "0 6px 0 rgba(0,0,0,0.35), 3px 3px 0 #fff",
          WebkitTextStroke: "3px #111",
        }}
      >
        {count > 0 ? count : "GO!"}
      </div>

      <div className="text-base font-bold opacity-80 text-center px-6 pb-2">
        Pass the phone to {judge.username}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Post-roll hop overlay — zoomed-in token hopping along the path
// ---------------------------------------------------------------------------

function HopOverlay({
  player,
  from,
  to,
  step,
}: {
  player: Player;
  from: number;
  to: number;
  step: number;
}) {
  const cur = Math.min(to, from + step);
  const totalSteps = Math.max(1, to - from);
  const progress = step / totalSteps;
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 anim-fade-in">
      <div className="text-white text-sm font-bold opacity-80 mb-2 uppercase tracking-wider">
        Hopping…
      </div>
      <div
        className="text-white text-5xl font-black mb-4"
        style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #111" }}
      >
        Cell {cur}
      </div>
      <div
        key={`hop-${step}`}
        className="anim-hop"
      >
        <Avatar player={player} size={140} />
      </div>
      <div className="mt-6 w-3/4 max-w-sm h-3 rounded-full bg-white/20 overflow-hidden ink-border-sm">
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${progress * 100}%`, background: "var(--boom-yellow)" }}
        />
      </div>
    </div>
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
  const [pointPops, setPointPops] = useState<Array<{ id: number; n: number }>>([]);
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
          video: { facingMode: { ideal: "environment" } },
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
      playDefuseJingle();
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
      const pid = Date.now() + Math.random();
      setPointPops((arr) => [...arr, { id: pid, n: next }]);
      setTimeout(() => setPointPops((arr) => arr.filter((p) => p.id !== pid)), 900);
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
      />
      {/* Floating per-rep point popups */}
      <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
        {pointPops.map((p) => (
          <div
            key={p.id}
            className="absolute anim-pop"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              fontSize: "3.5rem",
              color: "var(--boom-yellow)",
              textShadow: "3px 3px 0 #000, -2px -2px 0 #000, 0 0 12px rgba(255,200,0,.8)",
              top: `${30 + Math.random() * 20}%`,
              left: `${20 + Math.random() * 60}%`,
            }}
          >
            +{p.n}
          </div>
        ))}
      </div>

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
      {/* Big readable exercise banner */}
      <div className="absolute top-16 left-0 right-0 z-20 flex justify-center px-4 pointer-events-none">
        <div
          className="rounded-2xl ink-border px-5 py-2 text-center max-w-[92%]"
          style={{ background: "var(--boom-yellow)" }}
        >
          <div
            className="font-black leading-tight"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              color: "var(--boom-ink)",
              fontSize: "clamp(1.75rem, 6.5vw, 2.5rem)",
            }}
          >
            {trap.exercise}
          </div>
          <div
            className="font-bold"
            style={{
              color: "var(--boom-ink)",
              fontSize: "clamp(1rem, 4vw, 1.25rem)",
            }}
          >
            {trap.unit === "seconds" ? `Hold ${trap.reps}s` : `${trap.reps} reps`}
          </div>
        </div>
      </div>
      <div className="absolute bottom-3 left-3 z-20 text-white text-xs font-bold opacity-90" style={{ textShadow: "1px 1px 0 #000" }}>
        boomworkout.fun
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