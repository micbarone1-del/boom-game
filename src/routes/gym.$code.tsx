import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import { generateRoomCode, BOARD_SIZE, BOARD, getCell, describeCell, finishPlayer, type Trap, type BoardOverrides } from "@/lib/game";
import { PlayerToken } from "@/components/PlayerToken";
import { FuseTimer } from "@/components/FuseTimer";
import { CellMascot, mascotForCell } from "@/components/CellMascot";
import { CountdownIntro } from "@/components/CountdownIntro";
import { Bomb, Flame, Trophy, Flag, Settings, Dumbbell, Zap, Coffee, ArrowLeft } from "lucide-react";
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
  const [showFinalRanking, setShowFinalRanking] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [qrZoom, setQrZoom] = useState(false);
  const [landed, setLanded] = useState<{ id: string; type: import("@/lib/game").CellType; username: string; key: number } | null>(null);
  // Per-player rendered space (animated hop-by-hop toward the real current_space).
  const [hopSpaces, setHopSpaces] = useState<Record<string, number>>({});
  const [hoppingIds, setHoppingIds] = useState<Set<string>>(new Set());
  const prevRef = useRef<Record<string, number>>({});
  const hopTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const orderedPlayers = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const hasGameProgress = players.some(
    (p) => p.current_space > 0 || !!p.finished_at || !!p.finish_rank || (p.score ?? 0) > 0,
  );
  const gameHasStarted = room?.status === "playing" || !!room?.current_turn_player_id || hasGameProgress || !!trap;

  // Clear any pending hop timeouts only when the component unmounts.
  useEffect(() => {
    return () => {
      hopTimeoutsRef.current.forEach(clearTimeout);
      hopTimeoutsRef.current = [];
    };
  }, []);

  // When a player's current_space changes, animate them through each cell.
  useEffect(() => {
    if (players.length === 0) return;
    const HOP_MS = 220;
    for (const p of players) {
      const prev = prevRef.current[p.id];
      prevRef.current[p.id] = p.current_space;
      if (prev === undefined || prev === p.current_space) {
        if (prev === undefined) setHopSpaces((s) => ({ ...s, [p.id]: p.current_space }));
        continue;
      }
      // Restart / teleport back to start: snap, don't hop all the way back.
      // Boosts up to +10 should still animate, so we only snap on big setbacks.
      if (p.current_space === 0 || Math.abs(p.current_space - prev) > 15) {
        setHopSpaces((s) => ({ ...s, [p.id]: p.current_space }));
        continue;
      }
      const from = prev;
      const to = p.current_space;
      const step = to > from ? 1 : -1;
      const distance = Math.abs(to - from);
      setHoppingIds((s) => { const n = new Set(s); n.add(p.id); return n; });
      for (let i = 1; i <= distance; i++) {
        const at = from + i * step;
        hopTimeoutsRef.current.push(setTimeout(() => {
          setHopSpaces((s) => ({ ...s, [p.id]: at }));
        }, i * HOP_MS));
      }
      hopTimeoutsRef.current.push(setTimeout(() => {
        setHoppingIds((s) => { const n = new Set(s); n.delete(p.id); return n; });
        if (to > 0) {
          const cell = getCell(to);
          setLanded({ id: p.id, type: cell.type, username: p.username, key: Date.now() });
          hopTimeoutsRef.current.push(setTimeout(() => setLanded(null), 3200));
        }
      }, distance * HOP_MS));
    }
  }, [players]);

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
      const t = setTimeout(() => {
        setWinnerOverlay(null);
        setShowFinalRanking(true);
      }, 2800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  const restartGame = async () => {
    if (!room || players.length === 0 || restarting) return;
    setRestarting(true);
    setStartError(null);
    const first = orderedPlayers[0];
    const resetSpaces = Object.fromEntries(players.map((p) => [p.id, 0]));
    prevRef.current = resetSpaces;
    setHopSpaces(resetSpaces);
    setHoppingIds(new Set());
    setLanded(null);
    setWinnerOverlay(null);
    setSeenFinishers(new Set());
    setShowFinalRanking(false);
    try {
      const [{ error: playersError }, { error: logsError }, { error: roomError }] = await Promise.all([
        supabase
        .from("players")
        .update({ current_space: 0, finished_at: null, finish_rank: null, score: 0, status: "active" })
        .eq("room_code", code),
        supabase.from("workout_logs").delete().eq("room_code", code),
        supabase
        .from("rooms")
        .update({
          status: "playing",
          locked: false,
          trap: null,
          last_dice: null,
          current_turn_player_id: first?.id ?? null,
        })
        .eq("code", code),
      ]);
      if (playersError || logsError || roomError) {
        setStartError("Couldn’t restart the game. Smash it again!");
      }
    } finally {
      setRestarting(false);
    }
  };

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
    <div className="min-h-screen p-6 flex flex-col gap-4 relative">
      <button
        onClick={() => setShowCustomize(true)}
        className="absolute top-2 right-2 z-40 ink-border-sm rounded-xl px-3 py-2 bg-white font-black text-sm flex items-center gap-1"
        title="Customize exercises and reps"
      >
        <Settings size={16} /> CUSTOMIZE
      </button>
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="absolute top-2 left-2 z-40 flex items-center gap-3">
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
        <div className="ml-auto flex items-center gap-3 flex-wrap justify-end pt-10">
          <button
            onClick={gameHasStarted ? restartGame : startGame}
            disabled={players.length === 0 || starting || restarting}
            className="btn-boom disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Luckiest Guy', cursive" }}
          >
            {gameHasStarted
              ? restarting
                ? "BOOMING…"
                : "RESTART"
              : starting
                ? "IGNITING…"
                : "START GAME"}
          </button>
          <div className="ink-border-sm rounded-xl p-1.5 bg-white flex items-center gap-2">
            <div className="flex flex-col">
              <div className="text-[9px] font-bold leading-none">JOIN</div>
              <div
                className="text-base font-black tracking-wider leading-tight"
                style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
              >
                {code}
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(joinUrl)}
                className="text-[8px] font-bold underline text-left"
                title="Copy join link"
              >
                copy link
              </button>
            </div>
            <button
              onClick={() => setQrZoom(true)}
              className="bg-white"
              title="Tap to enlarge QR"
            >
              <QRCodeSVG value={joinUrl} size={56} level="M" />
            </button>
          </div>
        </div>
      </header>
      {qrZoom && (
        <div
          onClick={() => setQrZoom(false)}
          className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-6 gap-4 cursor-pointer"
        >
          <div className="bg-white p-4 ink-border rounded-2xl">
            <QRCodeSVG value={joinUrl} size={Math.min(520, window.innerWidth - 80)} level="H" />
          </div>
          <div className="text-white font-black text-2xl" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            {code}
          </div>
          <div className="text-white text-xs break-all max-w-md text-center opacity-80">{joinUrl}</div>
          <div className="text-white text-xs opacity-60">Tap anywhere to close</div>
        </div>
      )}
      {startError && (
        <div className="ink-border-sm rounded-xl bg-white p-2 text-sm font-black">{startError}</div>
      )}

      {/* Board */}
      <div className="ink-border rounded-3xl p-4 bg-white flex-1 relative">
        <img
          src={bombMascot}
          alt="Boom mascot"
          width={1024}
          height={1024}
          loading="lazy"
          className="absolute -bottom-10 -right-10 w-40 md:w-56 opacity-95 pointer-events-none anim-fuse z-20"
        />
        {/* Snake board: 10-cell horizontal rows joined by single-cell vertical connectors */}
        <div className="flex flex-col gap-1.5 pt-6">
          {(() => {
            const COLS = 10;
            const LAP = 11; // 10 horizontal + 1 connector
            const rows: { space: number; col: number }[][] = [];
            for (let lap = 0; lap * LAP + 1 <= BOARD_SIZE; lap++) {
              const lapStart = lap * LAP + 1;
              const ltr = lap % 2 === 0;
              const horizontal: { space: number; col: number }[] = [];
              for (let i = 0; i < COLS; i++) {
                const space = lapStart + i;
                if (space > BOARD_SIZE) break;
                horizontal.push({ space, col: ltr ? i + 1 : COLS - i });
              }
              if (horizontal.length > 0) rows.push(horizontal);
              const conn = lapStart + COLS;
              if (conn <= BOARD_SIZE) rows.push([{ space: conn, col: ltr ? COLS : 1 }]);
            }
            return rows.map((row, rowIdx) => (
              <div key={rowIdx} className="grid gap-1.5 relative" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
                {row.map(({ space, col }) => {
                  const cell = getCell(space);
                  const here = players.filter((p) => {
                    const s = hopSpaces[p.id] ?? p.current_space;
                    // Players that haven't rolled yet (space 0) park on the START cell.
                    return (s === 0 ? 1 : s) === space;
                  });
                  const bg =
                    cell.type === "start" ? "white" :
                    cell.type === "finish" ? "white" :
                    cell.type === "easy" ? "var(--boom-yellow)" :
                    cell.type === "medium" ? "var(--boom-orange)" :
                    cell.type === "hard" ? "var(--boom-red)" :
                    cell.type === "rest" ? "var(--boom-blue)" :
                    cell.type === "boost" ? "var(--boom-green)" :
                    "#7c3aed";
                  return (
                    <div
                      key={space}
                      className="aspect-square rounded-xl ink-border-sm flex flex-col items-center justify-center relative p-1 text-center"
                      style={{ background: bg, gridColumn: col, gridRow: 1 }}
                      title={describeCell(cell)}
                    >
                      {space === 1 && (
                        <span
                          className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm md:text-base font-black tracking-widest whitespace-nowrap pointer-events-none"
                          style={{ color: "var(--boom-ink)", fontFamily: "'Luckiest Guy', system-ui", letterSpacing: "0.15em" }}
                        >
                          START
                        </span>
                      )}
                      {space === BOARD_SIZE && (
                        <span
                          className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm md:text-base font-black tracking-widest whitespace-nowrap pointer-events-none"
                          style={{ color: "var(--boom-ink)", fontFamily: "'Luckiest Guy', system-ui", letterSpacing: "0.15em" }}
                        >
                          FINISH
                        </span>
                      )}
                      <span className="text-[10px] font-black" style={{ color: "var(--boom-ink)" }}>
                        {space}
                      </span>
                      {(cell.type === "easy" || cell.type === "medium") && <Dumbbell size={22} />}
                      {cell.type === "hard" && <Flame size={22} className="text-white" />}
                      {cell.type === "rest" && <Coffee size={22} />}
                      {cell.type === "boost" && <Zap size={22} />}
                      {cell.type === "setback" && <ArrowLeft size={22} className="text-white" />}
                      {cell.type === "start" && <Flag size={22} />}
                      {cell.type === "finish" && <Trophy size={22} />}
                      {here.length > 0 && (
                        <div className="absolute left-1/2 -top-3 -translate-x-1/2 z-30 flex -space-x-2 pointer-events-none">
                          {here.slice(0, 4).map((p, i) => {
                            const isHopping = hoppingIds.has(p.id);
                            return (
                              <div
                                key={`${p.id}-${hopSpaces[p.id] ?? p.current_space}`}
                                style={{ zIndex: 30 + i }}
                              >
                                <PlayerToken
                                  avatar={p.avatar_url}
                                  username={p.username}
                                  size={34}
                                  active={room?.current_turn_player_id === p.id}
                                  showName={false}
                                  showInitial
                                  className={isHopping ? "anim-hop" : "anim-land"}
                                />
                              </div>
                            );
                          })}
                          {here.length > 4 && (
                            <span className="text-[10px] font-black bg-white rounded-full px-1.5 py-0.5 ink-border-sm self-center">
                              +{here.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ));
          })()}
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
                  <PlayerToken avatar={p.avatar_url} username={p.username} size={28} showName={false} />
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
      <div className="ink-border rounded-2xl p-3 pt-5 bg-white flex gap-6 overflow-x-auto">
        {players.length === 0 && (
          <div className="text-lg font-bold p-2">Waiting for players to join… scan the QR!</div>
        )}
        {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((p) => {
          const isTurn = room?.current_turn_player_id === p.id;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col items-center gap-2 px-3 pt-2 ${isTurn ? "anim-shake" : ""}`}
            >
              <button
                onClick={async () => {
                  if (!confirm(`Remove ${p.username} from the game?`)) return;
                  await supabase.from("players").delete().eq("id", p.id);
                  if (room?.current_turn_player_id === p.id) {
                    await supabase.from("rooms").update({ current_turn_player_id: null }).eq("code", code);
                  }
                }}
                title="Remove player"
                className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-white ink-border-sm text-xs font-black leading-none flex items-center justify-center hover:bg-[var(--boom-red)] hover:text-white"
              >×</button>
              <div className="pt-2">
                <PlayerToken avatar={p.avatar_url} username={p.username} size={56} active={isTurn} showName={false} showInitial />
              </div>
              <span className="text-xs font-black flex items-center gap-1 mt-1">
                {p.username}
              </span>
              <span className="text-[11px] font-black flex items-center gap-1 opacity-80">
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
          <div className="ink-border rounded-3xl bg-white p-8 max-w-2xl w-full text-center anim-boom relative">
            {(() => {
              const trapPlayer = players.find((p) => p.id === trap.triggered_by);
              if (!trapPlayer) return null;
              return (
                <div className="absolute top-3 right-3 z-20 ink-border-sm rounded-2xl bg-white px-2 py-1 flex flex-col items-center gap-1">
                  <PlayerToken
                    avatar={trapPlayer.avatar_url}
                    username={trapPlayer.username}
                    size={56}
                    active
                    showName={false}
                  />
                  <span
                    className="text-xs font-black truncate max-w-[88px]"
                    style={{ color: "var(--boom-ink)" }}
                  >
                    {trapPlayer.username}
                  </span>
                </div>
              );
            })()}
            <img
              src={mascotForCell(getCell(players.find((p) => p.id === trap.triggered_by)?.current_space ?? 0).type)}
              alt=""
              width={1024}
              height={1024}
              className={`mx-auto w-40 h-40 -mt-24 ${trap.awaiting_verification ? "anim-mascot-pop" : "anim-shake"} drop-shadow-[0_0_30px_rgba(255,180,0,0.9)]`}
            />
            <div
              className="comic-shadow mt-2"
              style={{
                fontFamily: "'Luckiest Guy', cursive",
                fontSize: "clamp(5rem, 16vw, 10rem)",
                color: "var(--boom-red)",
                lineHeight: 1,
              }}
            >
              BOOM!
            </div>
            <p className="text-2xl font-black mt-2">
              {players.find((p) => p.id === trap.triggered_by)?.username ?? "Someone"} IS ABOUT TO EXPLODE!
            </p>
            <p className="text-3xl font-black mt-2" style={{ color: "var(--boom-red)" }}>
              Do {trap.reps} {trap.exercise}!
            </p>
            {(() => {
              const trapCellType = getCell(players.find((p) => p.id === trap.triggered_by)?.current_space ?? 0).type;
              const cellColor =
                trapCellType === "easy" ? "var(--boom-yellow)" :
                trapCellType === "medium" ? "var(--boom-orange)" :
                trapCellType === "hard" ? "var(--boom-red)" :
                trapCellType === "rest" ? "var(--boom-blue)" :
                trapCellType === "boost" ? "var(--boom-green)" :
                trapCellType === "setback" ? "#7c3aed" :
                "var(--boom-yellow)";
              return (
                <div className="mt-4 flex justify-center">
                  <div
                    className="ink-border anim-border-flash rounded-2xl px-6 py-3"
                    style={{
                      background: cellColor,
                      color: trapCellType === "hard" ? "white" : "var(--boom-ink)",
                      borderWidth: 4,
                      transform: "rotate(-3deg)",
                      minWidth: "12rem",
                    }}
                  >
                    <CountdownIntro startAt={trap.started_at} inline />
                    <FuseTimer
                      startedAt={trap.started_at}
                      big
                      color={trapCellType === "hard" ? "white" : "var(--boom-ink)"}
                      hideBeforeStart
                    />
                  </div>
                </div>
              );
            })()}
            <button
              onClick={restartGame}
              disabled={restarting}
              className="mt-4 ink-border-sm rounded-xl px-4 py-2 font-black text-sm disabled:opacity-50"
              style={{ background: "var(--boom-red)", color: "white", fontFamily: "'Luckiest Guy', cursive" }}
            >
              {restarting ? "RESETTING…" : "RESTART GAME"}
            </button>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none overflow-hidden">
          <img
            src={bombMascot}
            alt=""
            width={1024}
            height={1024}
            className="absolute anim-mascot-explode"
            style={{ width: "70vmin", height: "70vmin" }}
          />
        </div>
      )}

      {/* Final ranking modal — appears after the explosion */}
      {showFinalRanking && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-6">
          <div className="ink-border rounded-3xl bg-white p-6 max-w-lg w-full text-center anim-boom">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Trophy size={28} />
              <div className="text-4xl font-black comic-shadow" style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}>
                FINAL RANKING
              </div>
              <Trophy size={28} />
            </div>
            <div className="flex flex-col gap-2 text-left mb-5">
              {[...players]
                .sort((a, b) => {
                  if (a.finish_rank && b.finish_rank) return a.finish_rank - b.finish_rank;
                  if (a.finish_rank) return -1;
                  if (b.finish_rank) return 1;
                  return (b.score ?? 0) - (a.score ?? 0) || b.current_space - a.current_space;
                })
                .map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded-xl ink-border-sm"
                    style={{ background: i === 0 ? "var(--boom-yellow)" : "white" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black w-7 text-center" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      <PlayerToken avatar={p.avatar_url} username={p.username} size={36} showName={false} />
                      <span className="font-black">{p.username}</span>
                    </div>
                    <span className="font-black" style={{ color: "var(--boom-red)" }}>{p.score ?? 0} pts</span>
                  </div>
                ))}
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowFinalRanking(false)} className="ink-border-sm rounded-xl px-4 py-2 font-black text-sm">
                CLOSE
              </button>
              <button onClick={restartGame} disabled={restarting} className="btn-boom disabled:opacity-50"
                style={{ fontFamily: "'Luckiest Guy', cursive" }}>
                {restarting ? "RESETTING…" : "RESTART GAME"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomize && room && (
        <CustomizeBoardModal
          code={code}
          overrides={(room.board_overrides ?? {}) as BoardOverrides}
          onClose={() => setShowCustomize(false)}
        />
      )}
      {landed && (
        <CellMascot key={landed.key} type={landed.type} username={landed.username} />
      )}
      {/* countdown rendered inline inside the timer box */}
    </div>
  );
}

function CustomizeBoardModal({
  code,
  overrides,
  onClose,
}: {
  code: string;
  overrides: BoardOverrides;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<BoardOverrides>(() => ({ ...overrides }));
  const [saving, setSaving] = useState(false);
  const exerciseCells = BOARD.filter(
    (c) => c.type === "easy" || c.type === "medium" || c.type === "hard",
  );

  const update = (
    space: number,
    patch: { exercise?: string; reps?: number; min_reps?: number; max_reps?: number },
  ) => {
    setDraft((prev) => {
      const cur = prev[String(space)] ?? {};
      return { ...prev, [String(space)]: { ...cur, ...patch } };
    });
  };

  const save = async () => {
    setSaving(true);
    // strip empty entries
    const clean: BoardOverrides = {};
    for (const [k, v] of Object.entries(draft)) {
      const exercise = v.exercise?.trim();
      const reps = v.reps && v.reps > 0 ? Math.round(v.reps) : undefined;
      let min = v.min_reps && v.min_reps > 0 ? Math.round(v.min_reps) : undefined;
      let max = v.max_reps && v.max_reps > 0 ? Math.round(v.max_reps) : undefined;
      // If a fixed reps value is provided, drop the range — fixed wins.
      if (reps) { min = undefined; max = undefined; }
      // Normalise so min <= max when both are set.
      if (min !== undefined && max !== undefined && min > max) {
        const t = min; min = max; max = t;
      }
      if (exercise || reps || min || max) {
        clean[k] = {
          ...(exercise ? { exercise } : {}),
          ...(reps ? { reps } : {}),
          ...(min ? { min_reps: min } : {}),
          ...(max ? { max_reps: max } : {}),
        };
      }
    }
    await supabase.from("rooms").update({ board_overrides: clean }).eq("code", code);
    setSaving(false);
    onClose();
  };

  const resetAll = () => setDraft({});

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="ink-border rounded-3xl bg-white p-5 max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="text-2xl font-black comic-shadow flex items-center gap-2"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}>
            <Settings size={24} /> CUSTOMIZE BOARD
          </div>
          <button onClick={onClose} className="ink-border-sm rounded-lg w-8 h-8 font-black">×</button>
        </div>
        <p className="text-xs font-bold mb-3 opacity-70">
          Tap any field to change the exercise name, lock a fixed rep count, or set a MIN/MAX
          range so a random number of reps is picked each time. Leave fields empty to keep the
          default (auto-scaled to each player's fitness level). FIXED beats MIN/MAX if both are set.
        </p>
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid gap-2">
            {exerciseCells.map((c) => {
              const o = draft[String(c.space)] ?? {};
              const tierBg =
                c.type === "easy" ? "var(--boom-yellow)" :
                c.type === "medium" ? "var(--boom-orange)" : "var(--boom-red)";
              return (
                <div key={c.space} className="ink-border-sm rounded-xl p-2 flex items-center gap-2 flex-wrap bg-white">
                  <span className="rounded-lg px-2 py-1 text-xs font-black ink-border-sm"
                    style={{ background: tierBg, color: c.type === "hard" ? "white" : "black" }}>
                    Sp.{c.space} · {c.type.toUpperCase()}
                  </span>
                  <label className="flex-1 min-w-[140px] flex flex-col gap-0.5">
                    <span className="text-[10px] font-black opacity-60">EXERCISE</span>
                    <input
                      type="text"
                      placeholder={c.exercise}
                      value={o.exercise ?? ""}
                      onChange={(e) => update(c.space, { exercise: e.target.value })}
                      className="ink-border-sm rounded-lg px-2 py-1 text-sm font-bold bg-white text-black"
                    />
                  </label>
                  <label className="w-20 flex flex-col gap-0.5">
                    <span className="text-[10px] font-black opacity-60">FIXED</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="auto"
                      value={o.reps ?? ""}
                      onChange={(e) => update(c.space, { reps: e.target.value ? Number(e.target.value) : undefined })}
                      className="ink-border-sm rounded-lg px-2 py-1 text-sm font-bold bg-white text-black"
                    />
                  </label>
                  <label className="w-20 flex flex-col gap-0.5">
                    <span className="text-[10px] font-black opacity-60">MIN</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="—"
                      value={o.min_reps ?? ""}
                      onChange={(e) => update(c.space, { min_reps: e.target.value ? Number(e.target.value) : undefined })}
                      className="ink-border-sm rounded-lg px-2 py-1 text-sm font-bold bg-white text-black"
                    />
                  </label>
                  <label className="w-20 flex flex-col gap-0.5">
                    <span className="text-[10px] font-black opacity-60">MAX</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="—"
                      value={o.max_reps ?? ""}
                      onChange={(e) => update(c.space, { max_reps: e.target.value ? Number(e.target.value) : undefined })}
                      className="ink-border-sm rounded-lg px-2 py-1 text-sm font-bold bg-white text-black"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between gap-2 mt-3">
          <button onClick={resetAll} className="ink-border-sm rounded-xl px-3 py-2 font-black text-sm">
            RESET ALL
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="ink-border-sm rounded-xl px-3 py-2 font-black text-sm">
              CANCEL
            </button>
            <button onClick={save} disabled={saving} className="btn-boom disabled:opacity-50"
              style={{ fontFamily: "'Luckiest Guy', cursive" }}>
              {saving ? "SAVING…" : "SAVE"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
