import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import { generateRoomCode, BOARD_SIZE, BOARD, getCell, describeCell, finishPlayer, type Trap, type BoardOverrides } from "@/lib/game";
import { PlayerToken } from "@/components/PlayerToken";
import { FuseTimer } from "@/components/FuseTimer";
import { Bomb, Zap, Flame, Trophy, Coffee, ArrowLeft, Dumbbell, Flag, Settings } from "lucide-react";
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
    if (restarting) return;
    setRestarting(true);
    try {
      await supabase
        .from("players")
        .update({ current_space: 0, finished_at: null, finish_rank: null, score: 0, status: "active" })
        .eq("room_code", code);
      const first = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];
      await supabase
        .from("rooms")
        .update({
          status: "playing",
          locked: false,
          trap: null,
          last_dice: null,
          current_turn_player_id: first?.id ?? null,
        })
        .eq("code", code);
      setSeenFinishers(new Set());
      setShowFinalRanking(false);
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
        className="absolute top-2 right-2 z-30 ink-border-sm rounded-xl px-3 py-2 bg-white font-black text-sm flex items-center gap-1"
        title="Customize exercises and reps"
      >
        <Settings size={16} /> CUSTOMIZE
      </button>
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
                : "RESTART"
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
              <button
                onClick={() => navigator.clipboard?.writeText(joinUrl)}
                className="text-[10px] font-bold underline mt-1 break-all text-left"
                title="Copy join link"
              >
                Tap to copy link
              </button>
            </div>
            <button
              onClick={() => setQrZoom(true)}
              className="bg-white p-1"
              title="Tap to enlarge QR"
            >
              <QRCodeSVG value={joinUrl} size={160} level="H" />
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
                className="aspect-square rounded-xl ink-border-sm flex flex-col items-center justify-center relative p-1 text-center overflow-hidden"
                style={{ background: bg }}
                title={describeCell(cell)}
              >
                <span className="text-[10px] font-black" style={{ color: "var(--boom-ink)" }}>
                  {space}
                </span>
                {(cell.type === "easy" || cell.type === "medium" || cell.type === "hard") && (
                  <>
                    <span className="text-base leading-none">
                      {cell.type === "easy" && <span className="anim-wiggle">🤸</span>}
                      {cell.type === "medium" && <span className="anim-flex">🏋️</span>}
                      {cell.type === "hard" && <span className="anim-skull">💀</span>}
                    </span>
                    <span className="text-[8px] leading-tight font-black px-0.5 line-clamp-2" style={{ color: "var(--boom-ink)" }}>
                      {cell.exercise}
                    </span>
                  </>
                )}
                {cell.type === "rest" && (
                  <>
                    <span className="text-base leading-none anim-snore">😴</span>
                    <span className="text-[8px] font-black">REST</span>
                  </>
                )}
                {cell.type === "boost" && (
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-base leading-none anim-rocket">🚀</span>
                    <span className="text-[9px] font-black">
                      {cell.delta && cell.delta >= 10 ? `MEGA +${cell.delta}` : `BLAST +${cell.delta}`}
                    </span>
                  </div>
                )}
                {cell.type === "setback" && (
                  <div className="flex flex-col items-center leading-none text-white">
                    <span className="text-base leading-none anim-snail">🐌</span>
                    <span className="text-[9px] font-black">
                      {cell.delta && cell.delta <= -50 ? "TO START" : `BACK ${cell.delta}`}
                    </span>
                  </div>
                )}
                {cell.type === "start" && <Flag size={14} />}
                {cell.type === "finish" && <Trophy size={16} />}
                {here.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    {here.slice(0, 6).map((p, i) => {
                      const n = Math.min(here.length, 6);
                      // Spread tokens around bottom-right of the cell so the label stays readable.
                      const angle = (Math.PI * (i + 0.5)) / Math.max(n, 1) - Math.PI / 2;
                      const r = n === 1 ? 0 : 10;
                      const dx = Math.cos(angle) * r;
                      const dy = Math.sin(angle) * r;
                      return (
                        <div
                          key={p.id}
                          className="absolute"
                          style={{
                            right: 2,
                            bottom: 2,
                            transform: `translate(${dx}px, ${dy}px)`,
                            zIndex: 10 + i,
                          }}
                        >
                          <PlayerToken
                            avatar={p.avatar_url}
                            username={p.username}
                            size={22}
                            active={room?.current_turn_player_id === p.id}
                            showName={false}
                          />
                        </div>
                      );
                    })}
                    {here.length > 6 && (
                      <span className="absolute top-0.5 right-0.5 text-[9px] font-black bg-white rounded-full px-1 ink-border-sm">
                        +{here.length - 6}
                      </span>
                    )}
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
      <div className="ink-border rounded-2xl p-3 bg-white flex gap-4 overflow-x-auto">
        {players.length === 0 && (
          <div className="text-lg font-bold p-2">Waiting for players to join… scan the QR!</div>
        )}
        {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((p) => {
          const isTurn = room?.current_turn_player_id === p.id;
          return (
            <div
              key={p.id}
              className={`relative flex flex-col items-center gap-1 px-2 ${isTurn ? "anim-shake" : ""}`}
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
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white ink-border-sm text-xs font-black leading-none flex items-center justify-center hover:bg-[var(--boom-red)] hover:text-white"
              >×</button>
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
          <div className="ink-border rounded-3xl bg-white p-8 max-w-2xl w-full text-center anim-boom relative">
            <img
              src={bombMascot}
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none anim-flash-bg overflow-hidden">
          <img
            src={bombMascot}
            alt=""
            width={1024}
            height={1024}
            className="absolute anim-mascot-explode"
            style={{ width: "70vmin", height: "70vmin" }}
          />
          <div className="text-center anim-mega-boom relative z-10">
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

  const update = (space: number, patch: { exercise?: string; reps?: number }) => {
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
      if (exercise || reps) clean[k] = { ...(exercise ? { exercise } : {}), ...(reps ? { reps } : {}) };
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
          Tap any field to change the exercise name or set a fixed rep count.
          Leave a field empty to keep the default (the rep count auto-scales to each player's fitness level).
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
                  <label className="w-24 flex flex-col gap-0.5">
                    <span className="text-[10px] font-black opacity-60">REPS</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="auto"
                      value={o.reps ?? ""}
                      onChange={(e) => update(c.space, { reps: e.target.value ? Number(e.target.value) : undefined })}
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
