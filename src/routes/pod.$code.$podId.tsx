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
import { sfx, speak, repPop, startArcadeRise, startArcadeMusic, setBgmIntensity, startTechnoLayer, playDefuseJingle, playPauseMusic, setMusicPhase, setAudioSuspended, haptic } from "@/lib/sfx";
import { Bomb, Dice5, Play, Share2, Download, RotateCcw } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { useAuth } from "@/hooks/use-auth";
import { JoinAsModal } from "@/components/JoinAsModal";
import { GlobalLeaderboard } from "@/components/GlobalLeaderboard";
import { RecapVideo } from "@/components/RecapVideo";
import { mascotForCell, CELL_FLAVOR, CellMascot } from "@/components/CellMascot";
import { BombAvatar } from "@/components/BombAvatar";
import { CountdownNumber } from "@/components/CountdownNumber";
import { useFtue } from "@/components/Ftue";

import { TimesOutOverlay, GameOverOverlay } from "@/components/TimeoutOverlay";
import { PauseOverlay, PauseToggleButton } from "@/components/PauseOverlay";
import { BossPhase, BossVictory } from "@/components/BossPhase";
// BossVictory is still exported for the standalone /boss-test sandbox but
// the main flow now delegates to WrapUp for full leaderboard parity.
void BossVictory;
import { cellPos, cellBg, COLS, ROWS, POD_COLORS } from "@/components/GymMap";
import { BOARD, CELL_LABEL } from "@/lib/game";
import { Zap, ArrowLeft, HelpCircle, AlertTriangle, Users, Flame, Dumbbell, Trophy, Pause, Swords, ArrowRight } from "lucide-react";

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
  | { kind: "vs"; playerAId: string; playerBId: string; trap: ActiveTrap }
  | { kind: "group"; playerId: string; trap: ActiveTrap }
  | { kind: "pause"; playerId: string; finalSpace: number }
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
  const { room, players, pods, loading } = useRoom(code);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase | null>(null);
  const [pauseJoinOpen, setPauseJoinOpen] = useState(false);
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

  // --- Shared boss trigger ----------------------------------------------
  // The first time ANY player crosses FINISH (board phase), flip the room
  // into the shared boss fight. HP scales with the total number of players
  // currently in the room so it stays balanced regardless of pod count.
  // Must live ABOVE the early "Loading pod…" return so hook order stays stable.
  useEffect(() => {
    if (!room) return;
    if ((room.phase ?? "board") !== "board") return;
    const finished = players.find((p) => p.current_space >= BOARD_SIZE);
    if (!finished) return;
    const total = Math.max(1, players.length);
    const maxHp = total * 110;
    void supabase
      .from("rooms")
      .update({
        phase: "boss",
        boss_hp: maxHp,
        boss_max_hp: maxHp,
        boss_started_at: new Date().toISOString(),
      })
      .eq("code", code);
  }, [room, players, code]);

  // When the shared room is paused, stay on the pod screen and let the
  // PauseOverlay render on top. Resuming the room (toggle in overlay or by
  // the host) simply hides the overlay and gameplay continues in-place.
  void navigate;

  // --- Audio: freeze everything while paused, and swap the BGM per phase ---
  // These MUST stay above the early "Loading pod…" return so hook order is stable.
  const roomPaused = !!room?.paused;
  const roomPhase = room?.phase ?? null;
  const phaseKind = phase?.kind ?? null;
  useEffect(() => {
    setAudioSuspended(roomPaused);
    if (roomPaused) haptic("warn");
    return () => setAudioSuspended(false);
  }, [roomPaused]);

  useEffect(() => {
    if (!roomPhase && !phaseKind) return;
    if (roomPhase === "boss") return setMusicPhase("boss");
    if (roomPhase === "victory") return setMusicPhase("victory");
    if (phaseKind === "judge" || phaseKind === "vs" || phaseKind === "group") {
      return setMusicPhase("judge");
    }
    if (phaseKind === "done") return setMusicPhase("victory");
    setMusicPhase("play");
  }, [roomPhase, phaseKind]);

  // --- Timeout watchers (must stay above the early return) ---------------
  const endsAtMs = room?.game_ends_at ? new Date(room.game_ends_at).getTime() : null;
  const continueAtMs = room?.continue_deadline_at
    ? new Date(room.continue_deadline_at).getTime()
    : null;
  const gameState = room?.game_state ?? null;
  const bossPhase = room?.phase === "boss";

  // Main fuse ran out → continue countdown.
  useEffect(() => {
    if (!endsAtMs || gameState !== "playing" || roomPaused) return;
    const i = setInterval(() => {
      if (Date.now() < endsAtMs) return;
      if (bossPhase) return; // boss owns its own clock
      void supabase
        .from("rooms")
        .update({
          game_state: "timeout_continue",
          continue_deadline_at: new Date(Date.now() + 20_000).toISOString(),
        })
        .eq("code", code)
        .eq("game_state", "playing")
        .then(() => {});
      clearInterval(i);
    }, 1000);
    return () => clearInterval(i);
  }, [endsAtMs, gameState, roomPaused, bossPhase, code]);

  // Continue countdown expired → game over.
  useEffect(() => {
    if (gameState !== "timeout_continue" || !continueAtMs) return;
    const i = setInterval(() => {
      if (Date.now() < continueAtMs) return;
      void supabase
        .from("rooms")
        .update({ game_state: "game_over", continue_deadline_at: null })
        .eq("code", code)
        .eq("game_state", "timeout_continue")
        .then(() => {});
      clearInterval(i);
    }, 500);
    return () => clearInterval(i);
  }, [gameState, continueAtMs, code]);

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

  const onRollComplete = async (player: Player, _dice: number, finalArg: number) => {
    const final = finalArg;
    const finalCell = getEffectiveCell(final, overrides);

    await supabase.from("players").update({ current_space: final }).eq("id", player.id);

    // Reaching cell 60 in board phase triggers the shared boss fight
    // immediately — don't finish/leaderboard the player.
    if (final >= BOARD_SIZE && (room.phase ?? "board") === "board") {
      const total = Math.max(1, players.length);
      const maxHp = total * 110;
      await supabase
        .from("rooms")
        .update({
          phase: "boss",
          boss_hp: maxHp,
          boss_max_hp: maxHp,
          boss_started_at: new Date().toISOString(),
        })
        .eq("code", code);
      return;
    }

    // VS collision — another pod player already on this space → VS battle.
    const opponents = ordered.filter(
      (p) => p.id !== player.id && !p.finished_at && p.current_space === final,
    );
    if (
      opponents.length > 0 &&
      ordered.length >= 2 &&

      (finalCell.type === "easy" ||
        finalCell.type === "medium" ||
        finalCell.type === "hard" ||
        finalCell.type === "surprise" ||
        finalCell.type === "crazy")
    ) {
      const tier =
        finalCell.type === "hard" || finalCell.type === "crazy"
          ? 3
          : finalCell.type === "medium"
            ? 2
            : 1;
      const exercise =
        finalCell.type === "surprise"
          ? pickSurpriseExercise(overrides).exercise
          : finalCell.type === "crazy"
            ? pickCrazyExercise().exercise
            : finalCell.exercise ?? "Squats";
      const reps = calcRepsForTier(tier as 1 | 2 | 3, player.fitness_level, room.difficulty_multiplier);
      const trap: ActiveTrap = {
        exercise,
        reps,
        unit: "reps",
        finalSpace: final,
        cellType: finalCell.type,
      };
      setPhase({ kind: "vs", playerAId: player.id, playerBId: opponents[0].id, trap });
      return;
    }

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
    if (finalCell.type === "surprise" || finalCell.type === "crazy") {
      const pick =
        finalCell.type === "surprise"
          ? pickSurpriseExercise(overrides)
          : pickCrazyExercise();
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
    if (finalCell.type === "group") {
      const pick = pickGroupExercise();
      const reps = calcRepsForTier(pick.tier, player.fitness_level, room.difficulty_multiplier);
      const isHold = /\bhold\b/i.test(pick.exercise);
      const trap: ActiveTrap = {
        exercise: pick.exercise,
        reps,
        unit: isHold ? "seconds" : "reps",
        finalSpace: final,
        cellType: "group",
      };
      setPhase({ kind: "group", playerId: player.id, trap });
      return;
    }
    if (finalCell.type === "pause") {
      setPhase({ kind: "pause", playerId: player.id, finalSpace: final });
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

  // ---- VS result: winner gets 2× points, loser gets 0.5×.
  const onVsResult = async (winnerId: string) => {
    if (phase.kind !== "vs") return;
    const { playerAId, playerBId, trap } = phase;
    const loserId = winnerId === playerAId ? playerBId : playerAId;
    const winnerReps = Math.round(trap.reps * 2);
    const loserReps = Math.round(trap.reps * 0.5);
    await supabase.from("workout_logs").insert([
      {
        room_code: code,
        player_id: winnerId,
        exercise_name: `VS: ${trap.exercise}`,
        target_reps: winnerReps,
        unit: "reps",
        time_taken_ms: 0,
        verified_by_judge: true,
      },
      {
        room_code: code,
        player_id: loserId,
        exercise_name: `VS: ${trap.exercise}`,
        target_reps: loserReps,
        unit: "reps",
        time_taken_ms: 0,
        verified_by_judge: true,
      },
    ]);
    await recalcPlayerScore(winnerId, code);
    await recalcPlayerScore(loserId, code);
    setPhase({ kind: "player", playerId: nextPlayerId(playerAId) });
  };

  // ---- Group cell: every pod member gets credit, no judge.
  const onGroupComplete = async () => {
    if (phase.kind !== "group") return;
    const { trap, playerId } = phase;
    const rows = ordered
      .filter((p) => !p.finished_at)
      .map((p) => ({
        room_code: code,
        player_id: p.id,
        exercise_name: `ALL: ${trap.exercise}`,
        target_reps: trap.reps,
        unit: trap.unit,
        time_taken_ms: 0,
        verified_by_judge: true,
      }));
    if (rows.length > 0) {
      await supabase.from("workout_logs").insert(rows);
      await Promise.all(rows.map((r) => recalcPlayerScore(r.player_id, code)));
    }
    setPhase({ kind: "player", playerId: nextPlayerId(playerId) });
  };

  // ---- Pause cell: small breather, no judge, auto-advance.
  const onPauseComplete = async () => {
    if (phase.kind !== "pause") return;
    const { playerId } = phase;
    setPhase({ kind: "player", playerId: nextPlayerId(playerId) });
  };

  const onJudgeResult = async (outcome: "success" | "fail", clipBlob: Blob | null) => {
    if (phase.kind !== "judge") return;
    const { playerId, trap } = phase;
    const player = ordered.find((p) => p.id === playerId)!;
    // Key encodes player + exercise so the recap montage can label each clip.
    if (clipBlob) clipsRef.current.set(`${playerId}|${trap.exercise}|${Date.now()}`, clipBlob);

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
        if ((room.phase ?? "board") === "board") {
          const total = Math.max(1, players.length);
          const maxHp = total * 110;
          await supabase
            .from("rooms")
            .update({
              phase: "boss",
              boss_hp: maxHp,
              boss_max_hp: maxHp,
              boss_started_at: new Date().toISOString(),
            })
            .eq("code", code);
        } else {
          await finishPlayer(playerId, code);
          setPhase({ kind: "done", winnerId: playerId });
        }
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
    }, outcome === "success" ? 1300 : 2200);
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
        phase: "board",
        boss_hp: 0,
        boss_max_hp: 0,
        boss_started_at: null,
        boss_defeated_at: null,
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
        // Restart the boss clock too when the continue happens mid boss fight.
        ...(room.phase === "boss" ? { boss_started_at: new Date().toISOString() } : {}),
      })
      .eq("code", code);
  };

  // (timeout watchers live above the early return so hook order stays stable)


  // Render the timeout / game-over overlays on top of whatever phase is active.
  const overlay = (() => {
    // Always-on pause toggle in the top-right corner (z below PauseOverlay).
    const pauseBtn = (
      <div className="fixed top-2 right-2 z-[100]">
        <PauseToggleButton
          paused={!!room.paused}
          onToggle={() => {
            void supabase.from("rooms").update({ paused: !room.paused }).eq("code", code).then(() => {});
          }}
        />
      </div>
    );
    // Fuse ran out (main game or boss) → continue countdown, never straight
    // to the leaderboard. The leaderboard is only for pods that beat the boss.
    if (room.game_state === "timeout_continue" && continueAt) {
      return (
        <>
          {pauseBtn}
          <TimesOutOverlay
            continueDeadlineAt={continueAt}
            showContinue
            onContinue={onContinue}
            onGiveUp={() => {
              void supabase
                .from("rooms")
                .update({ game_state: "game_over", continue_deadline_at: null })
                .eq("code", code)
                .then(() => {});
            }}
          />
        </>
      );
    }
    if (room.game_state === "game_over" && room.phase !== "victory") {
      return (
        <>
          {pauseBtn}
          <GameOverOverlay
            onRestart={restart}
            onHome={() => window.location.assign("/")}
            onLeaderboard={() => {
              void supabase
                .from("rooms")
                .update({ phase: "victory", game_state: "playing" })
                .eq("code", code)
                .then(() => {});
            }}
          />
        </>
      );
    }

    if (room.paused) {
      return (
        <>
          <PauseOverlay
            code={code}
            players={players}
            pods={pods}
            onResume={() => {
              void supabase.from("rooms").update({ paused: false }).eq("code", code).then(() => {});
            }}
            onGiveUp={() => {
              void (async () => {
                await supabase.from("rooms").update({ paused: false }).eq("code", code);
                window.location.assign(`/join/${encodeURIComponent(code)}`);
              })();
            }}
            onSignInClick={() => setPauseJoinOpen(true)}
          />
          <JoinAsModal
            open={pauseJoinOpen}
            onClose={() => setPauseJoinOpen(false)}
            onSignedIn={() => setPauseJoinOpen(false)}
            onGuestChosen={() => setPauseJoinOpen(false)}
            title="Sign in to save scores"
            subtitle="Your score will appear on the global leaderboard"
          />
        </>
      );
    }
    return pauseBtn;
  })();

  // Boss fight + victory take over the screen.
  if (room.phase === "victory") {
    // Reuse the same WrapUp (leaderboard + recap videos + auth) shown at
    // game-over, so the post-game flow is identical whether the pod
    // defeated the boss or reached the finish line first.
    const ranked = [...ordered].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winnerId = ranked[0]?.id ?? ordered[0]?.id ?? "";
    return (
      <>
        <WrapUp
          players={ordered}
          winnerId={winnerId}
          clips={clipsRef.current}
          onRestart={() => {
            void restart();
            // Play Again always starts over from the player lobby.
            window.location.assign(`/join/${code}`);
          }}
        />

        {overlay}
      </>
    );
  }
  if (room.phase === "boss") {
    return (
      <>
        <BossPhase room={room} podPlayers={ordered} overrides={overrides} code={code} />
        {overlay}
      </>
    );
  }

  // --- Render the active phase ---

  if (phase.kind === "done") {
    return (
      <>
        <WrapUp
          players={ordered}
          winnerId={phase.winnerId}
          clips={clipsRef.current}
          onRestart={() => {
            void restart();
            window.location.assign(`/join/${code}`);
          }}
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
          onRoll={(d, resolved) => onRollComplete(player, d, resolved)}
          code={code}
          onRestart={restart}
          startedAt={startedAt}
          endsAt={endsAt}
          overrides={overrides}
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
          paused={!!room.paused}
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
          paused={!!room.paused}
          onComplete={onJudgeResult}
        />
        {overlay}
      </>
    );
  }

  if (phase.kind === "vs") {
    const a = ordered.find((x) => x.id === phase.playerAId)!;
    const b = ordered.find((x) => x.id === phase.playerBId)!;
    return (
      <>
        <VsPhase
          playerA={a}
          playerB={b}
          trap={phase.trap}
          podPlayers={ordered}
          onComplete={onVsResult}
        />
        {overlay}
      </>
    );
  }
  if (phase.kind === "group") {
    const p = ordered.find((x) => x.id === phase.playerId)!;
    return (
      <>
        <GroupPhase
          triggerPlayer={p}
          podPlayers={ordered}
          trap={phase.trap}
          paused={!!room.paused}
          onComplete={onGroupComplete}
        />
        {overlay}
      </>
    );
  }
  if (phase.kind === "pause") {
    const p = ordered.find((x) => x.id === phase.playerId)!;
    return (
      <>
        <PausePhase player={p} onComplete={onPauseComplete} paused={!!room.paused} />
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
                  width: isActive ? 52 : 40,
                  height: isActive ? 52 : 40,
                  background: color,
                  boxShadow: `0 0 0 2px #111${isActive ? ", 0 0 0 4px white, 0 0 0 6px " + color : ""}`,
                }}
              >
                {avatarIsMascot(p.avatar_url) ? (
                  <Bomb size={isActive ? 32 : 25} color="white" fill="white" />
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
        <BombAvatar color={color} size={size} />

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
  overrides,
}: {
  player: Player;
  players: Player[];
  onRoll: (dice: number, resolved: number) => void | Promise<void>;
  code: string;
  onRestart: () => void;
  startedAt: number | null;
  endsAt: number | null;
  overrides: BoardOverrides;
}) {
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const [hopping, setHopping] = useState<{ path: number[]; step: number } | null>(null);
  const [powerUp, setPowerUp] = useState(false);
  const [hopMascot, setHopMascot] = useState<CellType | null>(null);
  const ftue = useFtue(player.id, "roll");


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
    if (rolling || ftue.showing) return;
    void sfx.unlock();
    haptic("tap");

    startArcadeMusic();
    startTechnoLayer();
    speak(`${player.username}, roll the dice.`, { volume: 1, rate: 0.8, pitch: 0.8 });
    setRolling(true);
    setFace(null);
    sfx.play("rollJingle");
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
    // Build the full path: forward hops, then any boost/setback chain.
    const from = player.current_space;
    const to = Math.min(BOARD_SIZE, from + final);
    const landingCell = getEffectiveCell(to, overrides);
    let resolved = to;
    if (landingCell.type === "boost") {
      resolved = resolveMovementLanding(
        Math.min(BOARD_SIZE, to + (landingCell.delta ?? 0)),
        "boost",
      );
    } else if (landingCell.type === "setback") {
      resolved = resolveMovementLanding(
        Math.max(1, to + (landingCell.delta ?? 0)),
        "setback",
      );
    }
    // Path is a sequence of spaces visited, starting at `from`.
    const path: number[] = [from];
    for (let s = from + 1; s <= to; s++) path.push(s);
    if (resolved !== to) {
      const dir = resolved > to ? 1 : -1;
      for (let s = to + dir; dir > 0 ? s <= resolved : s >= resolved; s += dir) {
        path.push(s);
      }
    }
    // Start the camera-pan board overlay.
    setHopping({ path, step: 0 });
    await new Promise((r) => setTimeout(r, 700)); // initial pan into view
    // Forward hops to `to`.
    for (let i = 1; i <= final; i++) {
      await new Promise((r) => setTimeout(r, 280));
      setHopping({ path, step: i });
      sfx.play("hop");
    }
    await new Promise((r) => setTimeout(r, 350));
    // If we hit boost/setback, splash mascot, then continue along path.
    if (resolved !== to) {
      sfx.play(landingCell.type === "boost" ? "blast" : "setback");
      setHopMascot(landingCell.type);
      await new Promise((r) => setTimeout(r, 1100));
      setHopMascot(null);
      const startIdx = final + 1;
      for (let i = startIdx; i < path.length; i++) {
        await new Promise((r) => setTimeout(r, 260));
        setHopping({ path, step: i });
        sfx.play("hop");
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    setHopping(null);
    if (landingCell.type === "boost") {
      sfx.play("blast");
      speak(`${player.username}, power up!`, { volume: 1, rate: 0.85, pitch: 1.1 });
      setPowerUp(true);
      await new Promise((r) => setTimeout(r, 2200));
      setPowerUp(false);
    }
    setRolling(false);
    void onRoll(final, resolved);
    void start;
  };

  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center p-6 gap-6 bg-[var(--background)]">
      {ftue.modal}
      {hopping && (
        <HopOverlay player={player} players={players} path={hopping.path} step={hopping.step} />
      )}
      {hopMascot && <CellMascot type={hopMascot} username={player.username} />}
      {powerUp && <PowerUpOverlay player={player} />}
      <div
        className="font-black uppercase tracking-widest"
        style={{
          fontSize: "clamp(1.25rem, 6vw, 2rem)",
          color: "var(--boom-ink)",
        }}
      >
        Your turn
      </div>
      <Avatar player={player} size={150} />
      <div
        className="text-5xl font-black"
        style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-ink)" }}
      >
        {player.username}
      </div>

      <button
        onClick={handleRoll}
        disabled={rolling || ftue.showing}
        className="w-[64vw] max-w-[19rem] aspect-square rounded-[2rem] arcade-press arcade-tilt-r flex items-center justify-center"
        style={{
          background: "var(--boom-yellow)",
          border: "5px solid #000",
          boxShadow: "8px 8px 0 0 #000",
        }}
        aria-label="Roll the dice"
      >
        {face === null ? (
          <Dice5 size={150} strokeWidth={2.4} className="anim-ui-float" style={{ color: "var(--boom-ink)" }} />
        ) : (
          <span
            className="font-black tabular-nums"
            style={{
              fontFamily:
                "ui-rounded, 'SF Pro Rounded', system-ui, 'Segoe UI', sans-serif",
              fontWeight: 900,
              color: "var(--boom-ink)",
              fontSize: "clamp(5rem, 26vw, 9rem)",
              lineHeight: 1.25,
              display: "block",
              padding: "0.1em 0",
            }}
          >
            {face}
          </span>
        )}
      </button>
      <div className="text-lg font-black opacity-70 anim-ui-bob">TAP TO ROLL</div>


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
  paused = false,
  onDone,
}: {
  player: Player;
  judge: Player;
  trap: ActiveTrap;
  paused?: boolean;
  onDone: () => void;
}) {
  const [count, setCount] = useState(3);
  const spokeRef = useRef(false);
  const mascotImg = mascotForCell(trap.cellType);
  const flavor = CELL_FLAVOR[trap.cellType];
  const ftue = useFtue(player.id, "switch");

  useEffect(() => {
    if (ftue.showing || paused) return;
    if (spokeRef.current) return;
    spokeRef.current = true;
    const unit = trap.unit === "seconds" ? `${trap.reps} seconds` : `${trap.reps} reps`;
    speak(`Player ${player.username}. ${trap.exercise}, ${unit}. Judge: ${judge.username}.`);
  }, [player.username, judge.username, trap, ftue.showing]);

  useEffect(() => {
    if (ftue.showing || paused) return;
    if (count <= 0) {
      onDone();
      return;
    }
    sfx.play("switchBig");
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, onDone, ftue.showing, paused]);

  return (
    <main
      className="fixed inset-0 flex flex-col items-center justify-between p-4 gap-3"
      style={{ background: "#ffffff" }}
    >
      {ftue.modal}

      {/* Thick rounded black frame so text reads clearly */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-2 rounded-[2rem]"
        style={{ border: "8px solid #111" }}
      />
      {/* Cell mascot + label banner */}
      <div className="flex flex-col items-center gap-2 mt-2 w-full">
        <img
          src={mascotImg}
          alt=""
          key={`cellmascot-${trap.cellType}`}
          className="w-60 h-60 max-w-[62vw] max-h-[62vw] object-contain -mt-8 -mb-2 relative z-10 anim-mascot-bounce arcade-slam-in drop-shadow-[0_10px_0_rgba(0,0,0,0.3)]"
        />
        <div
          className="ink-border rounded-2xl px-4 py-1 bg-white arcade-tilt-l-sm arcade-slam-in anim-ui-float"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          <span
            className="text-2xl font-black"
            style={{ color: flavor.color }}
          >
            {flavor.label}
          </span>
        </div>
        <div className="text-center ink-border rounded-2xl bg-white px-4 py-2 max-w-[92%] arcade-slam-in anim-ui-float">
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
      <div className="flex items-center justify-between gap-2 w-full max-w-md">
        <div className="flex-1 min-w-0 flex flex-col items-center gap-2 anim-fade-in">
          <Avatar player={player} size={112} />
          <div
            className="text-base font-black uppercase tracking-wide"
            style={{ color: "var(--boom-ink)" }}
          >
            Player
          </div>
          <div
            className="w-full text-center font-black leading-tight truncate"
            style={{ color: "var(--boom-ink)", fontSize: "clamp(1.1rem, 5vw, 1.6rem)" }}
          >
            {player.username}
          </div>
        </div>
        <div
          className="shrink-0 ink-border rounded-2xl px-2 py-3 flex items-center justify-center arcade-tilt-r-sm anim-ui-float"
          style={{ background: "var(--boom-yellow)" }}
        >
          <ArrowRight size={40} strokeWidth={4} color="#111" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-center gap-2 anim-fade-in">
          <Avatar player={judge} size={112} />
          <div
            className="text-base font-black uppercase tracking-wide"
            style={{ color: "var(--boom-ink)" }}
          >
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

      {/* Countdown — single clean tick, never overlapping */}
      <CountdownNumber value={count} />


      <div
        className="font-black text-center px-6 pb-2"
        style={{ color: "var(--boom-ink)", fontSize: "clamp(1.15rem, 5vw, 1.6rem)" }}
      >
        Pass the phone to {judge.username}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Post-roll hop overlay — zoomed-in token hopping along the path
// ---------------------------------------------------------------------------

/**
 * Camera-panning hop overlay that renders the REAL 2D serpentine board
 * (same cells as GymMap) and pans/zooms a CSS transform to keep the moving
 * player avatar centered. The path is a precomputed sequence of board
 * spaces the player visits — works for forward, boost, and setback hops.
 * Icon and avatar sizes are clamped so nothing can blow up to full screen.
 */
function HopOverlay({
  player,
  players,
  path,
  step,
}: {
  player: Player;
  players: Player[];
  path: number[];
  step: number;
}) {
  // Fixed cell size in board coords. The actual rendered size depends on
  // the CSS scale we apply on the wrapper.
  const CELL = 56;
  const GAP = 6;
  const BOARD_W = COLS * (CELL + GAP);
  const BOARD_H = ROWS * (CELL + GAP);
  // Camera target zoom — 4-cell-wide framing on phone screens.
  const ZOOM = 2.2;
  const safeStep = Math.max(0, Math.min(step, path.length - 1));
  // One boing + buzz per hop.
  useEffect(() => {
    sfx.play("hopStep");
    haptic("hop");
  }, [safeStep]);
  const currentSpace = path[safeStep] ?? path[0] ?? 1;
  const finalSpace = path[path.length - 1] ?? currentSpace;

  // Intro: briefly show the full board centered & fully zoomed-out, then
  // pan/zoom in to the start of the path before hopping begins.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), 1100);
    return () => clearTimeout(t);
  }, []);

  const cellCenter = (space: number) => {
    const idx = Math.max(0, Math.min(BOARD.length - 1, space - 1));
    const { row, col } = cellPos(idx);
    return {
      x: col * (CELL + GAP) + CELL / 2,
      y: row * (CELL + GAP) + CELL / 2,
    };
  };

  // Compute pan: translate the board so the current cell sits at the
  // viewport center (using viewport-relative units we approximate with vw/vh).
  const center = cellCenter(currentSpace);

  // Viewport-fit zoom for the intro full-board view.
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 700;
  const fitZoom = Math.min((vw - 24) / BOARD_W, (vh - 160) / BOARD_H, 1);
  const activeZoom = intro ? fitZoom : ZOOM;
  const camCx = intro ? BOARD_W / 2 : center.x;
  const camCy = intro ? BOARD_H / 2 : center.y;

  // Other tokens (not the rolling player) mapped by space.
  const othersBySpace = new Map<number, Player[]>();
  for (const p of players) {
    if (p.id === player.id) continue;
    const arr = othersBySpace.get(p.current_space) ?? [];
    arr.push(p);
    othersBySpace.set(p.current_space, arr);
  }

  const trapTypes = new Set<CellType>([
    "surprise",
    "crazy",
    "setback",
    "pause",
    "group",
  ]);
  const finalCellType = BOARD[Math.max(0, finalSpace - 1)]?.type;
  const trapLanding =
    safeStep === path.length - 1 && finalCellType && trapTypes.has(finalCellType);

  return (
    <div className="fixed inset-0 z-40 bg-black/85 anim-fade-in overflow-hidden">
      {/* Title strip */}
      <div className="absolute top-3 left-0 right-0 z-20 text-center pointer-events-none">
        <div className="text-white text-[10px] font-black uppercase tracking-widest opacity-80">
          {intro ? "Get ready…" : "Hopping…"}
        </div>
        <div
          className="text-white text-3xl font-black"
          style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #111" }}
        >
          {intro ? "FULL BOARD" : `Cell ${currentSpace}`}
        </div>
      </div>

      {/* Camera viewport — full screen, board scaled & translated inside */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <div
          className="relative"
          style={{
            width: BOARD_W,
            height: BOARD_H,
            transform: `translate(${-camCx * activeZoom + vw / 2}px, ${-camCy * activeZoom + vh / 2}px) scale(${activeZoom})`,
            transformOrigin: "0 0",
            transition: "transform 650ms cubic-bezier(.4,.0,.2,1)",
            willChange: "transform",
          }}
        >
          {/* Cells */}
          {BOARD.map((cell, idx) => {
            const { row, col } = cellPos(idx);
            const isCurrent = cell.space === currentSpace;
            const isFinal = cell.space === finalSpace;
            const trapHit = isCurrent && isFinal && trapLanding;
            const others = othersBySpace.get(cell.space) ?? [];
            return (
              <div
                key={cell.space}
                className={`absolute rounded-xl flex items-center justify-center font-black ${
                  trapHit ? "anim-trap-land" : isCurrent ? "anim-mascot-bounce" : ""
                }`}
                style={{
                  left: col * (CELL + GAP),
                  top: row * (CELL + GAP),
                  width: CELL,
                  height: CELL,
                  background: cellBg(cell.type),
                  border: "3px solid #111",
                  boxShadow: isCurrent
                    ? trapHit
                      ? "0 0 0 4px #fff, 0 0 22px 8px #ef4444, 3px 3px 0 #111"
                      : "0 0 0 3px #fff, 0 0 18px 6px var(--boom-yellow), 3px 3px 0 #111"
                    : "3px 3px 0 #111",
                }}
              >
                <span
                  className="absolute leading-none rounded-sm px-1"
                  style={{
                    fontFamily: "'Luckiest Guy', cursive",
                    color: "#fff",
                    fontSize: 11,
                    top: 3,
                    left: 3,
                    background: "rgba(0,0,0,0.55)",
                    lineHeight: "12px",
                  }}
                >
                  {cell.space}
                </span>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    maxWidth: 28,
                    maxHeight: 28,
                  }}
                >
                  <HopCellGlyph type={cell.type} />
                </div>
                {/* Other players parked on this cell */}
                {others.length > 0 && (
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex justify-center gap-1 z-10">
                    {others.slice(0, 3).map((op) => (
                      <div
                        key={op.id}
                        className="rounded-full bg-white shrink-0"
                        style={{
                          width: 38,
                          height: 38,
                          maxWidth: 38,
                          maxHeight: 38,
                          boxShadow: "0 0 0 3px #111, 0 3px 8px rgba(0,0,0,0.45)",
                          overflow: "hidden",
                        }}
                        title={op.username}
                      >
                        {avatarIsMascot(op.avatar_url) ? (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ background: mascotColor(op.avatar_url) }}
                          >
                            <Bomb size={24} color="#fff" fill="#fff" />
                          </div>
                        ) : op.avatar_url ? (
                          <img
                            src={op.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ background: "#ec4899" }}
                          >
                            <Bomb size={24} color="#fff" fill="#fff" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Active player avatar — positioned over the current cell */}
          {(() => {
            const c = cellCenter(currentSpace);
            const SZ = 58;
            return (
              <div
                key={`hopper-${safeStep}`}
                className="absolute pointer-events-none anim-hop-visible"
                style={{
                  left: c.x - SZ / 2,
                  top: c.y - SZ / 2 - 6,
                  width: SZ,
                  height: SZ,
                  maxWidth: SZ,
                  maxHeight: SZ,
                  transition: "left 240ms cubic-bezier(.4,.0,.2,1), top 240ms cubic-bezier(.4,.0,.2,1)",
                }}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: SZ,
                    height: SZ,
                    filter: "drop-shadow(0 4px 0 #111) drop-shadow(0 0 8px var(--boom-yellow))",
                  }}
                >
                  {avatarIsMascot(player.avatar_url) ? (
                    <BombAvatar color={mascotColor(player.avatar_url)} size={SZ} />
                  ) : player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.username}
                      className="w-full h-full rounded-full object-cover ink-border-sm"
                    />
                  ) : (
                    <BombAvatar color={mascotColor(player.avatar_url)} size={SZ} />
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Progress dots — show how many hops left */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-1 pointer-events-none">
        {path.map((_, i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: i === safeStep ? 12 : 7,
              height: i === safeStep ? 12 : 7,
              background:
                i <= safeStep ? "var(--boom-yellow)" : "rgba(255,255,255,0.35)",
              boxShadow: "0 0 0 1.5px #111",
              transition: "all 200ms ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function HopCellGlyph({ type }: { type: CellType }) {
  // Monochrome white icons with consistent stroke thickness that fill the cell.
  const p = {
    size: undefined as unknown as number,
    strokeWidth: 2 as const,
    color: "#fff",
    className: "w-3/4 h-3/4",
  };
  switch (type) {
    case "boost": return <Zap {...p} />;
    case "setback": return <ArrowLeft {...p} />;
    case "surprise": return <HelpCircle {...p} />;
    case "crazy": return <AlertTriangle {...p} />;
    case "group": return <Users {...p} />;
    case "pause": return <Pause {...p} />;
    case "finish": return <Trophy {...p} />;
    case "hard": return <Flame {...p} />;
    case "easy": return <Dumbbell {...p} />;
    case "medium": return <Dumbbell {...p} />;
    case "start": return <Play {...p} />;
  }
  void CELL_LABEL; return null;
}

// ---------------------------------------------------------------------------
// Power-up celebration overlay — rainbow fireworks + token + big text.
// ---------------------------------------------------------------------------

function PowerUpOverlay({ player }: { player: Player }) {
  const sparks = Array.from({ length: 60 }, (_, i) => i);
  const fireworks = Array.from({ length: 6 }, (_, i) => i);
  const rainbow = ["#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#0a84ff", "#bf5af2"];
  return (
    <div className="fixed inset-0 z-[60] overflow-hidden anim-fade-in pointer-events-none">
      {/* Rainbow radial backdrop */}
      <div
        className="absolute inset-0 anim-powerup-bg"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.85), rgba(0,0,0,0.7) 70%), conic-gradient(from 0deg, #ff3b30, #ff9500, #ffd60a, #34c759, #0a84ff, #bf5af2, #ff3b30)",
        }}
      />
      {/* Firework bursts */}
      {fireworks.map((f) => {
        const top = 15 + Math.random() * 60;
        const left = 10 + Math.random() * 80;
        const delay = (f * 0.18).toFixed(2);
        return (
          <div
            key={`fw-${f}`}
            className="absolute"
            style={{ top: `${top}%`, left: `${left}%`, animationDelay: `${delay}s` }}
          >
            {sparks.slice(0, 18).map((s) => {
              const angle = (s / 18) * Math.PI * 2;
              const dist = 90 + Math.random() * 60;
              const dx = Math.cos(angle) * dist;
              const dy = Math.sin(angle) * dist;
              const color = rainbow[s % rainbow.length];
              return (
                <span
                  key={`spark-${f}-${s}`}
                  className="absolute block rounded-full anim-spark"
                  style={{
                    width: 10,
                    height: 10,
                    background: color,
                    boxShadow: `0 0 12px ${color}, 0 0 22px ${color}`,
                    ["--dx" as any]: `${dx}px`,
                    ["--dy" as any]: `${dy}px`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}
          </div>
        );
      })}
      {/* Centered token + text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
        <div className="anim-powerup-pop">
          <div className="rounded-full bg-white p-2 shadow-[0_0_0_6px_#111,0_0_60px_18px_rgba(255,255,255,0.7)]">
            <Avatar player={player} size={150} />
          </div>
        </div>
        <div
          className="text-center px-6 anim-powerup-text"
          style={{
            fontFamily: "'Luckiest Guy', cursive",
            color: "#fff",
            fontSize: "min(14vw, 5.5rem)",
            lineHeight: 1,
            WebkitTextStroke: "4px #111",
            textShadow:
              "0 6px 0 rgba(0,0,0,0.55), 0 0 20px #ffd60a, 0 0 40px #ff3b30, 0 0 70px #0a84ff",
          }}
        >
          {player.username} Power up!!
        </div>
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
  paused = false,
  onComplete,
}: {
  player: Player;
  trap: ActiveTrap;
  paused?: boolean;
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
  const [defuseFlash, setDefuseFlash] = useState(false);
  const ftue = useFtue(player.id, "judge");
  // Time spent reading the FTUE tip doesn't count against the defuse timer.
  const ftueOffsetRef = useRef(0);
  const ftueOpenedAtRef = useRef<number | null>(null);
  // Frozen = a tutorial tip is up OR the room is paused. Neither counts
  // against the defuse countdown.
  const frozen = ftue.showing || paused;
  if (frozen && ftueOpenedAtRef.current === null) ftueOpenedAtRef.current = Date.now();
  if (!frozen && ftueOpenedAtRef.current !== null) {
    ftueOffsetRef.current += Date.now() - ftueOpenedAtRef.current;
    ftueOpenedAtRef.current = null;
  }


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
      if (frozen) return;
      if (holdingRef.current && trap.unit === "seconds") {
        setHoldMs((m) => m + 50);
      }
      force((n) => n + 1);
    }, 50);
    return () => clearInterval(i);
  }, [trap.unit, frozen]);

  const pausedFor = frozen && ftueOpenedAtRef.current ? Date.now() - ftueOpenedAtRef.current : 0;
  const elapsed = Date.now() - started - ftueOffsetRef.current - pausedFor;
  const remaining = Math.max(0, TRAP_TIMEOUT_MS - elapsed);
  const ringProgress = remaining / TRAP_TIMEOUT_MS;

  // Timeout = fail
  useEffect(() => {
    if (completedRef.current) return;
    if (frozen) return;
    if (remaining <= 0) finish("fail");
  }, [remaining, frozen]);


  const finish = (outcome: "success" | "fail") => {
    if (completedRef.current) return;
    completedRef.current = true;
    arcadeStopRef.current?.();
    arcadeStopRef.current = null;
    if (outcome === "success") {
      haptic("success");
      playDefuseJingle();
      speak(`Well done ${player.username}! ${trap.reps} points!`);
      setDefuseFlash(true);
    } else {
      haptic("boom");
      sfx.play("explodeJingle");
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
      haptic("light");
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

  const ringSize = 280;
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
      {ftue.modal}
      <video

        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      {defuseFlash && (
        <div className="absolute inset-0 z-[70] pointer-events-none anim-defuse-flash" />
      )}
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
          className="rounded-2xl ink-border px-5 py-2 text-center max-w-[92%] anim-ui-float"
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
              style={{ fontFamily: "'Luckiest Guy', cursive", fontSize: "clamp(2.2rem, 10vw, 3.2rem)", lineHeight: 1, textShadow: "3px 3px 0 #000" }}
            >
              DEFUSE
            </span>
            <span className="text-2xl font-black tabular-nums">
              {trap.unit === "reps"
                ? `${reps} / ${trap.reps}`
                : `${(holdMs / 1000).toFixed(1)}s / ${trap.reps}s`}
            </span>
            <span className="text-sm font-bold opacity-90">
              {trap.unit === "reps" ? "TAP PER REP" : "HOLD"}
            </span>
          </button>
        </div>
        <div
          className={`mt-3 px-3 py-1 rounded-lg text-base font-black tabular-nums ${
            remaining <= 5000 ? "arcade-low-time" : "anim-ui-float"
          }`}
          style={{
            fontFamily: "'Luckiest Guy', cursive",
            background: remaining <= 5000 ? "var(--boom-red)" : "var(--boom-yellow)",
            color: remaining <= 5000 ? "#fff" : "var(--boom-ink)",
            border: "3px solid #111",
            boxShadow: "4px 4px 0 0 #111",
          }}
        >
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
      className="fixed inset-0 flex flex-col items-center justify-center gap-4 anim-explosion-flash arcade-vs-in"
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
  // Snapshot the clips + their object URLs ONCE, so re-renders (score polling,
  // auth updates) don't recreate the URLs and blank out the <video> previews.
  const clipList = useMemo(
    () =>
      Array.from(clips.entries()).map(([key, blob]) => {
        const [playerId, exercise] = key.split("|");
        return { key, blob, playerId, exercise: exercise || "Exercise", url: URL.createObjectURL(blob) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => () => clipList.forEach((c) => URL.revokeObjectURL(c.url)), [clipList]);
  const [spoken, setSpoken] = useState(false);
  const { user } = useAuth();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [connectingFor, setConnectingFor] = useState<string | null>(null);
  const [recordedFor, setRecordedFor] = useState<Set<string>>(new Set());
  const [localPlayers, setLocalPlayers] = useState<Player[]>(players);
  useEffect(() => setLocalPlayers(players), [players]);

  const CONNECT_KEY = `boom.connect.${players[0]?.room_code ?? ""}`;

  // Restore the player slot we were trying to link before an OAuth redirect.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(CONNECT_KEY);
    if (saved !== null) {
      setConnectingFor(saved);
      sessionStorage.removeItem(CONNECT_KEY);
    }
  }, [CONNECT_KEY]);

  // When a player slot is linked to the signed-in user, persist a game_results row
  // (the DB trigger bumps profile lifetime score + games_finished).
  useEffect(() => {
    if (!user) return;
    (async () => {
      for (const p of localPlayers) {
        if (p.user_id !== user.id) continue;
        if (recordedFor.has(p.id)) continue;
        const rank =
          ranked.findIndex((r) => r.id === p.id) >= 0
            ? ranked.findIndex((r) => r.id === p.id) + 1
            : null;
        const { error } = await supabase.from("game_results").insert({
          user_id: user.id,
          username: p.username,
          avatar_url: p.avatar_url,
          score: p.score ?? 0,
          finish_rank: rank,
          room_code: p.room_code,
          pod_id: p.pod_id ?? null,
        });
        if (!error) {
          setRecordedFor((s) => new Set(s).add(p.id));
        }
      }
    })();
  }, [user, localPlayers, ranked, recordedFor]);

  const connectSlot = async (playerId: string) => {
    if (!user) {
      setConnectingFor(playerId);
      if (typeof window !== "undefined") sessionStorage.setItem(CONNECT_KEY, playerId);
      setJoinModalOpen(true);
      return;
    }
    const { data, error } = await supabase
      .from("players")
      .update({ user_id: user.id })
      .eq("id", playerId)
      .select()
      .single();
    if (!error && data) {
      setLocalPlayers((arr) => arr.map((p) => (p.id === playerId ? (data as Player) : p)));
    }
  };

  // After signing in via the modal, finish connecting the pending slot.
  useEffect(() => {
    if (user && connectingFor) {
      const id = connectingFor;
      setConnectingFor(null);
      if (typeof window !== "undefined") sessionStorage.removeItem(CONNECT_KEY);
      void connectSlot(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, connectingFor]);

  useEffect(() => {
    if (spoken) return;
    setSpoken(true);
    sfx.play("winJingle");
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
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "BOOM! workout clip",
          text: "Check out my BOOM! workout 💥",
          url: "https://boomworkout.fun",
        });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    downloadClip(blob, idx);
  };

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col gap-4">
      {/* Winner explosion banner */}
      <div className="relative arcade-card rounded-3xl p-6 flex flex-col items-center gap-3 anim-explosion-flash" style={{ background: "var(--boom-yellow)" }}>
        <div className="text-sm font-black opacity-70 uppercase">Champion</div>
        <Avatar player={winner} size={120} />
        <div className="text-4xl arcade-heading text-center" style={{ color: "var(--boom-red)" }}>
          {winner.username} WINS!
        </div>
      </div>

      {/* Ranking */}
      <div className="arcade-card p-4 bg-white flex flex-col gap-2 anim-ui-float">
        <div className="text-xl arcade-heading text-white mb-1">Final Ranking</div>
        {[...localPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((p, i) => (
          <div key={p.id} className="arcade-card-sm bg-white flex items-center gap-3 py-2 px-3">
            <div className="text-2xl font-black w-8" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
              {i + 1}
            </div>
            <Avatar player={p} size={44} />
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{p.username}</div>
              {p.user_id ? (
                <div className="text-[10px] font-bold opacity-60">✓ profile connected</div>
              ) : (
                <button
                  onClick={() => connectSlot(p.id)}
                  className="text-[10px] font-black underline opacity-80"
                  style={{ color: "var(--boom-red)" }}
                >
                  Connect profile →
                </button>
              )}
            </div>
            <div className="font-black text-2xl tabular-nums" style={{ color: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}>
              {p.score ?? 0}
            </div>
          </div>
        ))}
        {!user && (
          <button
            onClick={() => setJoinModalOpen(true)}
            className="btn-boom mt-2 py-2 text-base"
            style={{ background: "var(--boom-green)", fontFamily: "'Luckiest Guy', cursive" }}
          >
            Sign in to save scores
          </button>
        )}
      </div>

      {/* Shareable recap videos — 2x2 sticker grid */}
      <div className="arcade-card p-4 bg-white flex flex-col gap-2 anim-ui-float">
        <div className="text-xl arcade-heading text-white mb-1">Share your recap</div>
        <div className="grid grid-cols-2 gap-3">
          {[...localPlayers]
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map((p, i) => (
              <RecapVideo
                key={p.id}
                tone={i}
                player={{
                  username: p.username,
                  avatar_url: p.avatar_url,
                  score: p.score ?? 0,
                  rank: i + 1,
                }}
                total={localPlayers.length}
                clips={(clipList.some((c) => c.playerId === p.id)
                  ? clipList.filter((c) => c.playerId === p.id)
                  : clipList
                ).map((c) => ({ blob: c.blob, label: c.exercise }))}
              />
            ))}
        </div>
      </div>

      {/* Global leaderboard */}
      <GlobalLeaderboard highlightUserId={user?.id ?? null} />

      {/* Clips */}
      <div className="arcade-card p-4 bg-white flex flex-col gap-2 anim-ui-float">
        <div className="text-xl arcade-heading text-white mb-1">Judge Highlights</div>
        {clipList.length === 0 ? (
          <div className="text-sm opacity-60">No clips captured this round.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {clipList.map(({ key, blob, url, exercise }, idx) => (
              <div key={key} className="ink-border-sm rounded-xl p-2 flex flex-col gap-1">
                <video src={url} controls playsInline className="w-full rounded-lg bg-black" />
                <div className="text-[10px] font-black truncate">{exercise}</div>

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
      <JoinAsModal
        open={joinModalOpen}
        onClose={() => {
          setJoinModalOpen(false);
          setConnectingFor(null);
          if (typeof window !== "undefined") sessionStorage.removeItem(CONNECT_KEY);
        }}
        onSignedIn={() => {
          setJoinModalOpen(false);
          // The connectingFor useEffect will finish the link after redirect.
        }}
        onGuestChosen={() => {
          // Wrap-up only needs authenticated links, so guests are ignored here.
          setJoinModalOpen(false);
        }}
        title="Save your score"
        subtitle="Sign in so your score joins the global leaderboard"
      />
    </main>
  );
}

// Suppress unused-import lint for icons consumed conditionally.
void Play;
void describeCell;
void getCell;

// ---------------------------------------------------------------------------
// VS Phase — same-pod collision: both players race the same exercise.
// First to tap their rep target wins 2×; loser keeps the 0.5× already logged.
// ---------------------------------------------------------------------------
function VsPhase({
  playerA,
  playerB,
  trap,
  podPlayers,
  onComplete,
}: {
  playerA: Player;
  playerB: Player;
  trap: ActiveTrap;
  podPlayers: Player[];
  onComplete: (winnerId: string) => void;
}) {
  const judge = podPlayers.find((p) => p.id !== playerA.id && p.id !== playerB.id) ?? null;
  const [stage, setStage] = useState<"handoff" | "battle">(judge ? "handoff" : "battle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const doneRef = useRef(false);
  useEffect(() => {
    if (stage !== "battle") return;
    speak(`Versus! ${playerA.username} against ${playerB.username}. ${trap.exercise}.`);
    sfx.play("blast");
  }, [stage, playerA.username, playerB.username, trap.exercise]);
  // Camera background — best effort; falls back to dark gradient on denial.
  useEffect(() => {
    if (stage !== "battle") return;
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [stage]);
  const tap = (who: "a" | "b") => {
    if (doneRef.current) return;
    const setter = who === "a" ? setA : setB;
    setter((n) => {
      const next = n + 1;
      haptic("light");
      repPop(next / trap.reps);
      if (next >= trap.reps) {
        doneRef.current = true;
        sfx.play("win");
        speak(`${who === "a" ? playerA.username : playerB.username} wins the duel!`);
        setTimeout(() => onComplete(who === "a" ? playerA.id : playerB.id), 900);
      }
      return next;
    });
  };
  if (stage === "handoff" && judge) {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center gap-5 p-6" style={{ background: "var(--boom-ink)" }}>
        <div className="text-white text-xs font-black uppercase tracking-widest opacity-80">VS Battle</div>
        <div className="flex items-center gap-3">
          <Avatar player={playerA} size={64} />
          <Swords size={36} color="#fff" />
          <Avatar player={playerB} size={64} />
        </div>
        <div className="text-white text-4xl font-black text-center" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #000" }}>
          {playerA.username} vs {playerB.username}
        </div>
        <div className="bg-white ink-border rounded-2xl px-5 py-3 text-center anim-ui-float">
          <div className="text-2xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>{trap.exercise}</div>
          <div className="text-base font-bold">First to {trap.reps} reps wins 2×</div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-white text-sm opacity-80 uppercase">Pass phone to judge</div>
          <div className="bg-white ink-border rounded-full px-4 py-2 flex items-center gap-2 anim-ui-float">
            <Avatar player={judge} size={40} />
            <span className="text-xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>{judge.username}</span>
          </div>
        </div>
        <button
          onClick={() => setStage("battle")}
          className="w-full max-w-sm py-4 rounded-2xl ink-border bg-[var(--boom-yellow)] text-2xl font-black active:scale-95 anim-ui-float"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          START BATTLE
        </button>
      </main>
    );
  }
  const Side = ({ p, count, side }: { p: Player; count: number; side: "a" | "b" }) => (
    <button
      onClick={() => tap(side)}
      className="flex-1 flex flex-col items-center justify-center gap-3 active:scale-95"
      style={{ background: side === "a" ? "rgba(239,68,68,0.55)" : "rgba(59,130,246,0.55)" }}
    >
      <Avatar player={p} size={96} />
      <div className="text-white text-2xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "2px 2px 0 #111" }}>
        {p.username}
      </div>
      <div className="text-white text-6xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #111" }}>
        {count}/{trap.reps}
      </div>
      <div className="text-white text-xs font-bold opacity-90">TAP PER REP</div>
    </button>
  );
  return (
    <main className="fixed inset-0 flex flex-col bg-black overflow-hidden">
      {/* Camera video background — judge holds the phone */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      />
      <div className="absolute inset-0 bg-black/40 z-[1]" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div className="bg-white ink-border rounded-full px-6 py-2 flex items-center gap-2 anim-ui-float">
          <Swords size={24} />
          <span className="text-2xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            VS · {trap.exercise}
          </span>
        </div>
      </div>
      <div className="relative flex flex-1 z-10">
        <Side p={playerA} count={a} side="a" />
        <Side p={playerB} count={b} side="b" />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Group Phase — everybody together. Phone is down; anybody taps DONE.
// ---------------------------------------------------------------------------
function GroupPhase({
  triggerPlayer,
  podPlayers,
  trap,
  paused = false,
  onComplete,
}: {
  triggerPlayer: Player;
  podPlayers: Player[];
  trap: ActiveTrap;
  paused?: boolean;
  onComplete: () => void;
}) {
  // Auto-timer: cap "all together" at 60s so a forgotten phone-down
  // doesn't stall the pod. Caller can still tap WE DID IT early.
  const TOTAL = 60;
  const [remaining, setRemaining] = useState(TOTAL);
  useEffect(() => {
    speak(`Everybody together! ${trap.exercise}, ${trap.reps} ${trap.unit}.`);
    sfx.play("gameStart");
  }, [trap.exercise, trap.reps, trap.unit]);
  useEffect(() => {
    if (paused) return;
    const i = setInterval(() => {
      setRemaining((r) => {
        const next = r - 1;
        if (next <= 5 && next > 0) sfx.play("timerTick");
        if (next <= 0) {
          clearInterval(i);
          onComplete();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [onComplete, paused]);
  const low = remaining <= 10;
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-between p-6 gap-3" style={{ background: "var(--boom-blue)" }}>
      <div className="text-white text-xs font-black uppercase opacity-90 mt-4">All Together · phone down</div>
      <div className="flex flex-col items-center gap-3 text-center">
        <Users size={64} color="#fff" />
        <div className="text-white text-5xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #111" }}>
          EVERYBODY!
        </div>
        <div className="bg-white ink-border rounded-2xl px-5 py-3 anim-ui-float">
          <div className="text-3xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            {trap.exercise}
          </div>
          <div className="text-xl font-bold">
            {trap.unit === "seconds" ? `Hold ${trap.reps}s` : `${trap.reps} reps`}
          </div>
        </div>
        <div
          className={`ink-border rounded-2xl px-6 py-3 text-5xl font-black tabular-nums ${low ? "anim-mascot-bounce" : "anim-ui-bob"}`}
          style={{
            background: low ? "var(--boom-red)" : "var(--boom-yellow)",
            color: low ? "#fff" : "var(--boom-ink)",
            fontFamily: "'Luckiest Guy', cursive",
            textShadow: low ? "2px 2px 0 #111" : "none",
          }}
        >
          {remaining}s
        </div>
        <div className="flex gap-2 mt-2">
          {podPlayers.map((p) => <Avatar key={p.id} player={p} size={48} />)}
        </div>
        <div className="text-white text-sm opacity-90">Triggered by {triggerPlayer.username}</div>
      </div>
      <button
        onClick={onComplete}
        className="w-full max-w-sm py-5 rounded-2xl ink-border bg-[var(--boom-green)] text-white text-3xl font-black active:scale-95 anim-ui-float"
        style={{ fontFamily: "'Luckiest Guy', cursive" }}
      >
        WE DID IT!
      </button>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Pause Phase — fun music, no judge, auto-advance.
// ---------------------------------------------------------------------------
function PausePhase({
  player,
  onComplete,
  paused = false,
}: {
  player: Player;
  onComplete: () => void;
  paused?: boolean;
}) {
  const TOTAL = 10;
  const [remaining, setRemaining] = useState(TOTAL);
  useEffect(() => {
    const stop = playPauseMusic();
    speak(`Pause! Take a breather, ${player.username}.`);
    return () => stop();
  }, [player.username]);
  useEffect(() => {
    if (paused) return;
    const i = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(i);
  }, [paused]);
  useEffect(() => {
    if (paused || remaining <= 0) return;
    if (remaining <= 3) sfx.play("timerTick");
  }, [paused, remaining]);
  useEffect(() => {
    if (!paused && remaining === 0) onComplete();
  }, [onComplete, paused, remaining]);
  const low = remaining <= 3;
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center gap-6" style={{ background: "#06b6d4" }}>
      <div className="anim-mascot-bounce">
        <Pause size={120} fill="#fff" color="#fff" />
      </div>
      <div className="text-white text-6xl font-black text-center px-6" style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "4px 4px 0 #111" }}>
        PAUSE!
      </div>
      <div className="text-white text-xl font-bold">Take a breath, {player.username} 🌬️</div>
      <div
        className={`ink-border rounded-2xl px-8 py-3 text-6xl font-black tabular-nums ${low ? "anim-mascot-bounce" : "anim-ui-bob"}`}
        style={{
          background: low ? "var(--boom-red)" : "var(--boom-yellow)",
          color: low ? "#fff" : "var(--boom-ink)",
          fontFamily: "'Luckiest Guy', cursive",
        }}
      >
        {remaining}s
      </div>
      <button onClick={onComplete} className="px-6 py-3 rounded-full bg-white ink-border text-lg font-black active:scale-95 anim-ui-float">
        Skip
      </button>
    </main>
  );
}