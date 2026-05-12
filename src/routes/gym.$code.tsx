import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import { generateRoomCode, BOARD_SIZE, BOARD, getCell, finishPlayer, type Trap } from "@/lib/game";
import { PlayerToken } from "@/components/PlayerToken";
import { FuseTimer } from "@/components/FuseTimer";
import { Bomb, Zap, Flame, Trophy, Coffee, ArrowLeft, Dumbbell, Flag } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";

export const Route = createFileRoute("/gym/$code")({
  component: GymView,
});

function GymView() {
  const { code: codeParam } = Route.useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(codeParam === "new" ? null : codeParam);
  const [creating, setCreating] = useState(codeParam === "new");

  useEffect(() => {
    if (codeParam !== "new") return;
    const create = async () => {
      const newCode = generateRoomCode();
      const { error } = await supabase.from("rooms").insert({ code: newCode });
      if (!error) {
        setCode(newCode);
        setCreating(false);
        navigate({ to: "/gym/$code", params: { code: newCode }, replace: true });
      }
    };
    create();
  }, [codeParam, navigate]);

  if (creating || !code) {
    return (
      <div className="min-h-screen flex items-center justify-center text-3xl">Igniting fuse…</div>
    );
  }

  return <GymBoard code={code} />;
}

function GymBoard({ code }: { code: string }) {
  const { room, players } = useRoom(code);
  const trap = room?.trap as Trap | null;
  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join?code=${code}` : "";
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [winnerOverlay, setWinnerOverlay] = useState<string | null>(null);
  const [seenFinishers, setSeenFinishers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const finished = players.filter((p) => p.finished_at);
    const newOnes = finished.filter((p) => !seenFinishers.has(p.id));
    if (newOnes.length > 0) {
      setSeenFinishers((prev) => {
        const n = new Set(prev);
        newOnes.forEach((p) => n.add(p.id));
        return n;
      });
      const latest = newOnes[newOnes.length - 1];
      setWinnerOverlay(latest.username);
      const t = setTimeout(() => setWinnerOverlay(null), 5000);
      return () => clearTimeout(t);
    }
  }, [players, seenFinishers]);

  const startGame = async () => {
    if (!room || players.length === 0 || starting) return;
    const first = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];
    if (!first) return;
    setStarting(true);
    setStartError(null);
    const { error } = await supabase
      .from("rooms")
      .update({
        status: "playing",
        locked: false,
        trap: null,
        last_dice: null,
        current_turn_player_id: first.id,
      })
      .eq("code", code);
    if (error) setStartError("Couldn’t start the game. Smash it again!");
    setStarting(false);
  };

  // If the current turn player leaves or is missing, advance to the first available player.
  useEffect(() => {
    if (!room?.current_turn_player_id || players.length === 0) return;
    const exists = players.some((p) => p.id === room.current_turn_player_id);
    if (!exists) {
      const first = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];
      supabase.from("rooms").update({ current_turn_player_id: first.id }).eq("code", code);
    }
  }, [room, players, code]);

  // Defuse / Blow Up handlers (judge buttons)
  const defuse = async () => {
    if (!room || !trap) return;
    const triggerPlayer = players.find((p) => p.id === trap.triggered_by);
    if (!triggerPlayer) return;
    // Player already moved to their target on roll. Defuse just clears the trap.
    const finalSpace = triggerPlayer.current_space;
    // Victory check
    if (finalSpace >= BOARD_SIZE) {
      await finishPlayer(triggerPlayer.id, code);
    }
    // pass turn — skip finished players
    const order = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
    const idx = order.findIndex((p) => p.id === triggerPlayer.id);
    let next = order[(idx + 1) % order.length];
    for (let i = 1; i <= order.length; i++) {
      const candidate = order[(idx + i) % order.length];
      if (candidate.finished_at) continue;
      if (finalSpace >= BOARD_SIZE && candidate.id === triggerPlayer.id) continue;
      next = candidate;
      break;
    }
    await supabase.from("workout_logs").insert({
      room_code: code,
      player_id: triggerPlayer.id,
      exercise_name: trap.exercise,
      target_reps: trap.reps,
      time_taken_ms: Date.now() - trap.started_at,
      verified_by_judge: true,
    });
    await supabase
      .from("rooms")
      .update({
        trap: null,
        locked: false,
        current_turn_player_id: next.id,
        last_dice: null,
      })
      .eq("code", code);
  };

  const blowUp = async () => {
    if (!trap) return;
    // Reset awaiting_verification — player must redo
    await supabase
      .from("rooms")
      .update({
        trap: { ...trap, awaiting_verification: false },
      })
      .eq("code", code);
  };

  return (
    <div className="min-h-screen p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Bomb size={40} />
          <div>
            <div
              style={{ fontFamily: "'Luckiest Guy', cursive" }}
              className="text-4xl text-[var(--boom-red)] comic-shadow"
            >
              BOOM!
            </div>
            <div className="text-sm font-bold">Gym Screen</div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={startGame}
            disabled={players.length === 0 || starting || !!trap}
            className="btn-boom disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Luckiest Guy', cursive" }}
          >
            {room?.current_turn_player_id
              ? starting
                ? "BOOMING…"
                : "RESTART TURN"
              : starting
                ? "IGNITING…"
                : "START GAME"}
          </button>
          <div className="ink-border rounded-2xl p-3 bg-white flex items-center gap-4">
            <div>
              <div className="text-xs font-bold">JOIN CODE</div>
              <div
                className="text-3xl font-black tracking-wider"
                style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
              >
                {code}
              </div>
            </div>
            <div className="bg-white p-1">
              <QRCodeSVG value={joinUrl} size={88} />
            </div>
          </div>
        </div>
      </header>
      {startError && (
        <div className="ink-border-sm rounded-xl bg-white p-2 text-sm font-black">{startError}</div>
      )}

      {/* Board */}
      <div className="ink-border rounded-3xl p-4 bg-white flex-1 relative overflow-hidden">
        <img
          src={bombMascot}
          alt="Boom mascot"
          width={1024}
          height={1024}
          loading="lazy"
          className="absolute -bottom-6 -right-6 w-40 md:w-56 opacity-90 pointer-events-none anim-fuse"
        />
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}>
          {Array.from({ length: BOARD_SIZE }, (_, i) => i + 1).map((space) => {
            const cell = getCell(space);
            const here = players.filter((p) => p.current_space === space);
            const bg =
              cell.type === "start"
                ? "var(--boom-green)"
                : cell.type === "finish"
                  ? "var(--boom-yellow)"
                  : cell.type === "easy"
                    ? "var(--boom-yellow)"
                    : cell.type === "medium"
                      ? "var(--boom-orange)"
                      : cell.type === "hard"
                        ? "var(--boom-red)"
                        : cell.type === "rest"
                          ? "var(--boom-blue)"
                          : cell.type === "boost"
                            ? "var(--boom-green)"
                            : "#7c3aed"; // setback purple
            return (
              <div
                key={space}
                className="aspect-square rounded-xl ink-border-sm flex flex-col items-center justify-center relative p-1"
                style={{ background: bg }}
              >
                <span className="text-[10px] font-black" style={{ color: "var(--boom-ink)" }}>
                  {space}
                </span>
                {cell.type === "easy" && <Dumbbell size={14} />}
                {cell.type === "medium" && (
                  <div className="flex items-center"><Dumbbell size={12} /><Dumbbell size={12} /></div>
                )}
                {cell.type === "hard" && <Bomb size={16} />}
                {cell.type === "rest" && <Coffee size={16} />}
                {cell.type === "boost" && (
                  <div className="flex flex-col items-center leading-none">
                    <Zap size={14} fill="currentColor" />
                    <span className="text-[9px] font-black">+{cell.delta}</span>
                  </div>
                )}
                {cell.type === "setback" && (
                  <div className="flex flex-col items-center leading-none text-white">
                    <ArrowLeft size={14} />
                    <span className="text-[9px] font-black">{cell.delta}</span>
                  </div>
                )}
                {cell.type === "start" && <Flag size={14} />}
                {cell.type === "finish" && <Trophy size={16} />}
                {here.length > 0 && (
                  <div className="absolute inset-0 flex flex-wrap gap-0.5 items-center justify-center p-0.5">
                    {here.slice(0, 4).map((p) => (
                      <PlayerToken
                        key={p.id}
                        avatar={p.avatar_url}
                        username={p.username}
                        size={28}
                        active={room?.current_turn_player_id === p.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black relative z-10">
          {[
            { c: "var(--boom-yellow)", l: "Easy" },
            { c: "var(--boom-orange)", l: "Medium" },
            { c: "var(--boom-red)", l: "Hard" },
            { c: "var(--boom-blue)", l: "Rest" },
            { c: "var(--boom-green)", l: "Blast +" },
            { c: "#7c3aed", l: "Setback −" },
          ].map((x) => (
            <span key={x.l} className="ink-border-sm rounded-full px-2 py-1 flex items-center gap-1" style={{ background: x.c, color: "white" }}>
              {x.l}
            </span>
          ))}
        </div>
      </div>

      {/* Live leaderboard — visible to everyone in the room */}
      <div className="ink-border rounded-2xl bg-white p-3">
        <div className="text-lg font-black mb-2 flex items-center gap-2"><Trophy size={20} /> LIVE LEADERBOARD</div>
        <div className="grid gap-1">
          {[...players]
            .sort((a, b) => {
              if (a.finish_rank && b.finish_rank) return a.finish_rank - b.finish_rank;
              if (a.finish_rank) return -1;
              if (b.finish_rank) return 1;
              return (b.score ?? 0) - (a.score ?? 0) || b.current_space - a.current_space;
            })
            .map((p, i) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-2 py-1 rounded-lg" style={{ background: i === 0 ? "var(--boom-yellow)" : "transparent" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black w-6" style={{ fontFamily: "'Luckiest Guy', cursive" }}>{i + 1}</span>
                  <PlayerToken avatar={p.avatar_url} username={p.username} size={28} />
                  <span className="text-sm font-black">{p.username}</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-black">
                  <span>Sp.{p.current_space}</span>
                  <span style={{ color: "var(--boom-red)" }}>{p.score ?? 0} pts</span>
                  {p.finished_at && <Trophy size={14} />}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Players strip */}
      <div className="ink-border rounded-2xl p-3 bg-white flex gap-4 overflow-x-auto">
        {players.length === 0 && (
          <div className="text-lg font-bold p-2">Waiting for players to join… scan the QR!</div>
        )}
        {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((p) => {
          const isTurn = room?.current_turn_player_id === p.id;
          return (
            <div
              key={p.id}
              className={`flex flex-col items-center gap-1 px-2 ${isTurn ? "anim-shake" : ""}`}
            >
              <PlayerToken avatar={p.avatar_url} username={p.username} size={64} active={isTurn} />
              <span className="text-xs font-black flex items-center gap-1">
                {p.finished_at && <Trophy size={12} />}
                {p.finished_at ? `#${p.finish_rank}` : `Sp.${p.current_space}`} · {p.score ?? 0}pts
              </span>
            </div>
          );
        })}
      </div>

      {/* BOOM modal */}
      {trap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="ink-border rounded-3xl bg-white p-8 max-w-2xl w-full text-center anim-boom">
            <div
              className="comic-shadow"
              style={{
                fontFamily: "'Luckiest Guy', cursive",
                fontSize: "clamp(5rem, 16vw, 10rem)",
                color: "var(--boom-red)",
                lineHeight: 1,
              }}
            >
              BOOM!
            </div>
            <p className="text-2xl font-black mt-2">TRAP TRIGGERED!</p>
            <p className="text-3xl font-black mt-2" style={{ color: "var(--boom-red)" }}>
              Do {trap.reps} {trap.exercise}!
            </p>
            <div className="mt-4 flex justify-center">
              <FuseTimer startedAt={trap.started_at} big />
            </div>
            {trap.awaiting_verification ? (
              <div className="mt-6">
                <p className="text-xl font-black mb-3" style={{ color: "var(--boom-ink)" }}>
                  TEAM VERIFICATION REQUIRED!
                </p>
                <div className="flex gap-4 justify-center flex-wrap">
                  <button
                    onClick={defuse}
                    className="ink-border rounded-2xl px-8 py-6 text-3xl font-black comic-shadow"
                    style={{ background: "var(--boom-green)", color: "white" }}
                  >
                    DEFUSED
                  </button>
                  <button
                    onClick={blowUp}
                    className="ink-border rounded-2xl px-8 py-6 text-3xl font-black comic-shadow"
                    style={{ background: "var(--boom-red)", color: "white" }}
                  >
                    BLOW IT UP
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-lg font-bold flex items-center justify-center gap-2">
                <Flame className="anim-fuse" /> Get sweating!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Winner KA-BOOM overlay */}
      {winnerOverlay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6 pointer-events-none">
          <div className="text-center anim-mega-boom">
            <div
              className="comic-shadow anim-spin-slow"
              style={{
                fontFamily: "'Luckiest Guy', cursive",
                fontSize: "clamp(8rem, 28vw, 22rem)",
                color: "var(--boom-yellow)",
                lineHeight: 1,
              }}
            >
              KA-BOOM!
            </div>
            <div className="text-5xl font-black mt-6 text-white comic-shadow" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
              {winnerOverlay} BLEW UP THE FINISH LINE! 🏆💥
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
