import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import {
  loadPlayerSession,
  rollDice,
  calcRepsForTier,
  getCell,
  describeCell,
  BOARD_SIZE,
  finishPlayer,
  type Trap,
  getEffectiveCell,
  getOverrideReps,
  type BoardOverrides,
} from "@/lib/game";
import { PlayerToken } from "@/components/PlayerToken";
import { FuseTimer } from "@/components/FuseTimer";
import { CellMascot, mascotForCell } from "@/components/CellMascot";
import { CountdownIntro } from "@/components/CountdownIntro";
import { Bomb, Dice5, Trophy, Camera } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { BoomCamera } from "@/components/BoomCamera";
import { sfx } from "@/lib/sfx";

export const Route = createFileRoute("/play/$code")({
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const { room, players } = useRoom(code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [winnerOverlay, setWinnerOverlay] = useState<string | null>(null);
  const [seenFinishers, setSeenFinishers] = useState<Set<string>>(new Set());
  const [showFinalRanking, setShowFinalRanking] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [myPrevSpace, setMyPrevSpace] = useState<number | null>(null);
  const [myLanded, setMyLanded] = useState<{ type: import("@/lib/game").CellType; key: number } | null>(null);
  const [myTurnFlash, setMyTurnFlash] = useState<number | null>(null);
  const prevMyTurnRef = useRef<boolean>(false);
  // Tick to drive border-flash off when countdown ends.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 150);
    return () => clearInterval(i);
  }, []);

  // Refs for one-shot sound triggers
  const countdownTicksRef = useRef<Set<number>>(new Set());
  const lastTrapKeyRef = useRef<string | null>(null);
  const winSoundRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const s = loadPlayerSession();
    if (s && s.roomCode === code) setPlayerId(s.playerId);
  }, [code]);

  // Mascot splash when MY token lands on a new cell
  useEffect(() => {
    const meNow = players.find((p) => p.id === playerId);
    if (!meNow) return;
    if (myPrevSpace !== null && myPrevSpace !== meNow.current_space && meNow.current_space > 0) {
      // Clear any prior mascot — a new movement just started.
      setMyLanded(null);
      // Wait until current_space has been stable for ~700ms before showing
      // the mascot, so two-stage moves (intermediate → final) don't overlap.
      const stableMs = 700;
      const targetSpace = meNow.current_space;
      const showT = setTimeout(() => {
        const cell = getCell(targetSpace);
        setMyLanded({ type: cell.type, key: Date.now() });
        const cellSfx: Record<string, Parameters<typeof sfx.play>[0] | undefined> = {
          easy: "easy", medium: "medium", hard: "hard",
          rest: "rest", boost: "blast", setback: "setback",
        };
        const which = cellSfx[cell.type];
        if (which) sfx.play(which);
      }, stableMs);
      const clearT = setTimeout(() => setMyLanded(null), stableMs + 3200);
      setMyPrevSpace(meNow.current_space);
      return () => { clearTimeout(showT); clearTimeout(clearT); };
    }
    setMyPrevSpace(meNow.current_space);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, playerId]);

  // Detect newly-finished players and trigger explosion overlay
  useEffect(() => {
    const finished = players.filter((p) => p.finished_at);
    const newOnes = finished.filter((p) => !seenFinishers.has(p.id));
    if (newOnes.length > 0) {
      for (const p of newOnes) {
        if (!winSoundRef.current.has(p.id)) {
          winSoundRef.current.add(p.id);
          sfx.play("win");
        }
      }
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

  // Countdown beeps + clear when trap appears/disappears
  useEffect(() => {
    const trap = room?.trap as Trap | null;
    if (!trap) {
      countdownTicksRef.current = new Set();
      lastTrapKeyRef.current = null;
      return;
    }
    const key = `${trap.triggered_by}:${trap.started_at}`;
    if (lastTrapKeyRef.current !== key) {
      lastTrapKeyRef.current = key;
      countdownTicksRef.current = new Set();
    }
    const remaining = trap.started_at - Date.now();
    // Beep only inside the final 3-2-1 window so we don't beep early.
    if (remaining > 0 && remaining <= 3500) {
      const n = Math.max(1, Math.ceil(remaining / 1000));
      if (!countdownTicksRef.current.has(n)) {
        countdownTicksRef.current.add(n);
        sfx.play("countdown");
      }
    }
  });

  // Auto-clear final ranking when host restarts (everyone back to space 0, no finishers)
  useEffect(() => {
    if (!showFinalRanking) return;
    const stillFinished = players.some((p) => p.finished_at);
    if (!stillFinished) {
      setShowFinalRanking(false);
      setSeenFinishers(new Set());
    }
  }, [players, showFinalRanking]);

  const me = players.find((p) => p.id === playerId);
  const trap = room?.trap as Trap | null;

  // Full-screen flash when it becomes my turn (and we're not in a trap).
  useEffect(() => {
    const isTurn = !!me && room?.current_turn_player_id === me.id;
    if (isTurn && !prevMyTurnRef.current && !trap) {
      setMyTurnFlash(Date.now());
      const t = setTimeout(() => setMyTurnFlash(null), 1100);
      prevMyTurnRef.current = true;
      return () => clearTimeout(t);
    }
    prevMyTurnRef.current = isTurn;
  }, [room?.current_turn_player_id, me, trap]);

  // Auto-assign first turn if none set
  useEffect(() => {
    if (!room) return;
    if (!room.current_turn_player_id && players.length > 0 && !room.locked) {
      const first = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];
      if (first && me?.id === first.id) {
        supabase.from("rooms").update({ current_turn_player_id: first.id }).eq("code", code);
      }
    }
  }, [room, players, me, code]);

  if (!me) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-4">
        <p className="text-xl font-bold">You're not in this room yet.</p>
        <Link to="/join" search={{ code }} className="btn-boom">JOIN</Link>
      </div>
    );
  }

  const isMyTurn = room?.current_turn_player_id === me.id;
  const triggeredByMe = trap?.triggered_by === me.id;

  const onRoll = async () => {
    if (!room || !isMyTurn || room.locked) return;
    setRolling(true);
    const dice = rollDice();
    await new Promise((r) => setTimeout(r, 600));
    const target = Math.min(BOARD_SIZE, me.current_space + dice);
    const overrides = (room.board_overrides ?? {}) as BoardOverrides;
    const cell = getEffectiveCell(target, overrides);

    // Apply any movement effect first; the destination cell decides what happens next.
    let final = target;
    if (cell.type === "boost" && cell.delta) {
      final = Math.min(BOARD_SIZE, target + cell.delta);
    } else if (cell.type === "setback" && cell.delta) {
      final = Math.max(1, target + cell.delta); // delta is negative
    } else if (cell.type === "finish") {
      final = BOARD_SIZE;
    }
    const finalCell = getEffectiveCell(final, overrides);

    // Two-stage movement: first hop to the dice target so the boost/setback
    // cell is clearly visible, pause, then hop to the actual final cell.
    if (final !== target) {
      const firstDistance = Math.max(1, Math.abs(target - me.current_space));
      await supabase.from("players").update({ current_space: target }).eq("id", me.id);
      await new Promise((r) => setTimeout(r, firstDistance * 220 + 500));
    }

    // Exercise destination -> lock with trap (after hop animation finishes).
    if (finalCell.type === "easy" || finalCell.type === "medium" || finalCell.type === "hard") {
      const tier = finalCell.tier ?? 1;
      const calc = calcRepsForTier(tier, me.fitness_level, room.difficulty_multiplier);
      const reps = getOverrideReps(final, overrides, calc) ?? calc;
      const exercise = finalCell.exercise ?? "Workout";
      const hopFrom = final !== target ? target : me.current_space;
      await supabase.from("players").update({ current_space: final }).eq("id", me.id);
      const distance = Math.max(1, Math.abs(final - hopFrom));
      const hopMs = distance * 220 + 600;
      await new Promise((r) => setTimeout(r, hopMs));
      await supabase
        .from("rooms")
        .update({
          locked: true,
          last_dice: dice,
          trap: {
            exercise,
            reps,
            triggered_by: me.id,
            // Pad the anchor with enough lead time for every client to finish
            // the cell-landing mascot animation (~3.2s) AND a 3-2-1 countdown
            // (3s) before the timer starts. The CountdownIntro only renders
            // numbers in the final 3.5s, so this is the single shared anchor
            // that keeps gym + player screens perfectly synchronised.
            started_at: Date.now() + 6500,
            awaiting_verification: false,
          } satisfies Trap,
        })
        .eq("code", code);
    } else {
      // rest / boost-into-non-exercise / setback-into-non-exercise / finish
      await supabase.from("players").update({ current_space: final }).eq("id", me.id);
      if (final >= BOARD_SIZE) {
        await finishPlayer(me.id, code);
      }
      // Pass turn — skip players who already finished (and the one who just finished)
      const order = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      const idx = order.findIndex((p) => p.id === me.id);
      const justFinished = final >= BOARD_SIZE;
      let next = order[(idx + 1) % order.length];
      for (let i = 1; i <= order.length; i++) {
        const candidate = order[(idx + i) % order.length];
        if (candidate.finished_at) continue;
        if (justFinished && candidate.id === me.id) continue;
        next = candidate;
        break;
      }
      await supabase.from("rooms").update({
        last_dice: dice,
        current_turn_player_id: next.id,
      }).eq("code", code);
    }
    setRolling(false);
  };

  const onIDidIt = async () => {
    if (!trap || !triggeredByMe) return;
    sfx.play("didIt");
    await supabase.from("rooms").update({
      trap: { ...trap, awaiting_verification: true },
    }).eq("code", code);
  };

  return (
    <main className="min-h-screen p-4 flex flex-col gap-4 max-w-md mx-auto">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={bombMascot} alt="" width={1024} height={1024} loading="lazy" className="w-12 h-12 anim-fuse" />
          <div>
            <div className="text-xs font-bold opacity-70">ROOM</div>
            <div className="text-xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>{code}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCamera(true)}
            title="Take a photo or video with the BOOM! logo"
            className="ink-border-sm rounded-full bg-white w-11 h-11 flex items-center justify-center"
          >
            <Camera size={20} />
          </button>
          <PlayerToken
            key={`me-${me.current_space}`}
            avatar={me.avatar_url}
            username={me.username}
            size={56}
            active={isMyTurn}
            className={rolling ? "anim-hop" : "anim-land"}
          />
        </div>
      </header>

      <div className="ink-border rounded-2xl bg-white p-4 text-center">
        <div className="text-sm font-bold opacity-70">YOU ARE ON SPACE</div>
        <div className="text-6xl font-black comic-shadow" style={{ color: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}>
          #{me.current_space}
        </div>
        <div className="text-xs mt-1">Fitness Lvl {me.fitness_level} · Difficulty x{room?.difficulty_multiplier ?? 5}</div>
        <div className="mt-1 text-sm font-black">{describeCell(getCell(me.current_space))}</div>
        {(() => {
          const next = getCell(Math.min(BOARD_SIZE, me.current_space + 1));
          return (
            <div className="text-xs opacity-70 mt-1">Next cell: {describeCell(next)}</div>
          );
        })()}
      </div>

      {trap ? (() => {
        const trapCellType = getCell(players.find(p=>p.id===trap.triggered_by)?.current_space ?? 0).type;
        const cellColor =
          trapCellType === "easy" ? "var(--boom-yellow)" :
          trapCellType === "medium" ? "var(--boom-orange)" :
          trapCellType === "hard" ? "var(--boom-red)" :
          "var(--boom-yellow)";
        const fg = trapCellType === "hard" ? "white" : "var(--boom-ink)";
        return (
        <div
          className="fixed inset-0 z-[60] p-6 pt-10 text-center anim-boom flex flex-col items-center justify-center gap-4 overflow-y-auto"
          style={{ background: cellColor, color: fg }}
        >
          <img
            src={mascotForCell(getCell(players.find(p=>p.id===trap.triggered_by)?.current_space ?? 0).type)}
            alt=""
            width={1024}
            height={1024}
            className="w-40 h-40 anim-mascot-pop drop-shadow-[0_0_20px_rgba(255,200,0,0.8)]"
          />
          <div className="anim-mascot-bounce inline-block">
            <div
              className="text-6xl font-black comic-shadow"
              style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
            >
              BOOM!
            </div>
          </div>
          <p className="text-xl font-black">
            {triggeredByMe
              ? "YOU ARE ABOUT TO EXPLODE!"
              : `${players.find(p=>p.id===trap.triggered_by)?.username || "Someone"} is about to explode!`}
          </p>
          <p className="text-3xl font-black">{trap.reps} {trap.exercise}</p>
          <div className="flex justify-center py-2">
            {(() => {
              const anchor = trap.started_at;
              const remaining = anchor - Date.now();
              const inCountdown = remaining > 0 && remaining <= 3500;
              const ready = remaining <= 3500; // show countdown UI only at the end
              return (
                <div
                  className={`ink-border rounded-2xl px-8 py-5 bg-white ${ready && inCountdown ? "anim-border-flash" : ""}`}
                  style={{
                    color: "var(--boom-ink)",
                    transform: "rotate(-3deg)",
                    borderWidth: 10,
                    borderStyle: "solid",
                    borderColor: "var(--boom-ink)",
                    boxShadow: "10px 10px 0 0 rgba(0,0,0,0.95)",
                    minWidth: "14rem",
                  }}
                >
                  {!ready ? (
                    <div className="text-2xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
                      GET READY…
                    </div>
                  ) : (
                    <>
                      <CountdownIntro startAt={anchor} inline />
                      <FuseTimer startedAt={anchor} big color="var(--boom-ink)" hideBeforeStart />
                    </>
                  )}
                </div>
              );
            })()}
          </div>
          {triggeredByMe && (
            trap.awaiting_verification ? (
              <p className="font-bold text-lg">Waiting for the room to judge your form…</p>
            ) : (
              <button onClick={onIDidIt} className="ink-border rounded-2xl px-6 py-6 text-4xl font-black w-full max-w-md"
                style={{ background: "var(--boom-green)", color: "white", fontFamily: "'Luckiest Guy', cursive" }}>
                I DID IT!
              </button>
            )
          )}
          {!triggeredByMe && trap.awaiting_verification && (
            <p className="font-bold text-lg">Head to the GYM SCREEN to vote DEFUSED or BLOW IT UP.</p>
          )}
        </div>
        );
      })() : me.finished_at ? null : (
        <button
          onClick={onRoll}
          disabled={!isMyTurn || rolling || room?.locked || !!me.finished_at}
          className={`ink-border rounded-3xl p-8 text-3xl font-black flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isMyTurn && !rolling && !room?.locked ? "anim-roll-pulse" : ""}`}
          style={{ background: isMyTurn ? "var(--boom-yellow)" : "var(--muted)", color: "var(--boom-ink)", fontFamily: "'Luckiest Guy', cursive" }}
        >
          <Dice5 size={64} className={rolling ? "anim-shake" : ""} />
          {rolling ? "ROLLING…" : isMyTurn ? "ROLL DICE" : "Wait for your turn"}
          {room?.last_dice && <span className="text-base font-bold">Last roll: {room.last_dice}</span>}
        </button>
      )}

      <div className="ink-border rounded-2xl bg-white p-3">
        <div className="text-base font-black mb-2 flex items-center gap-2"><Trophy size={18}/> LIVE LEADERBOARD</div>
        <div className="flex flex-col gap-1">
          {[...players]
            .sort((a, b) => {
              if (a.finish_rank && b.finish_rank) return a.finish_rank - b.finish_rank;
              if (a.finish_rank) return -1;
              if (b.finish_rank) return 1;
              return (b.score ?? 0) - (a.score ?? 0) || b.current_space - a.current_space;
            })
            .map((p, i) => {
              const isMe = p.id === me.id;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg"
                  style={{ background: i === 0 ? "var(--boom-yellow)" : isMe ? "var(--muted)" : "transparent" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black w-5" style={{ fontFamily: "'Luckiest Guy', cursive" }}>{i + 1}</span>
                    <PlayerToken avatar={p.avatar_url} username={p.username} size={28}
                      active={room?.current_turn_player_id === p.id} showName={false} />
                    <span className="text-sm font-black truncate max-w-[100px]">{p.username}{isMe ? " (you)" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-black">
                    <span>Sp.{p.current_space}</span>
                    <span style={{ color: "var(--boom-red)" }}>{p.score ?? 0}pts</span>
                    {p.finished_at && <Trophy size={14} />}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Personal trophy badge */}
      {me.finished_at && (
        <div className="ink-border rounded-2xl p-4 text-center" style={{ background: "var(--boom-yellow)" }}>
          <Trophy className="mx-auto" size={32} />
          <div className="text-2xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            FINISHED #{me.finish_rank}!
          </div>
          <div className="text-lg font-black" style={{ color: "var(--boom-red)" }}>
            {me.score} POINTS
          </div>
        </div>
      )}

      {/* Winner mascot explosion overlay — non-blocking */}
      {winnerOverlay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none overflow-hidden">
          <img
            src={bombMascot}
            alt=""
            width={1024}
            height={1024}
            className="absolute anim-mascot-explode"
            style={{ width: "60vmin", height: "60vmin" }}
          />
        </div>
      )}

      {showFinalRanking && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/70 p-4">
          <div className="ink-border rounded-3xl bg-white p-5 max-w-sm w-full text-center anim-boom">
            <div className="text-3xl font-black comic-shadow mb-3" style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}>
              FINAL RANKING
            </div>
            <div className="flex flex-col gap-1.5 text-left mb-4">
              {[...players]
                .sort((a, b) => {
                  if (a.finish_rank && b.finish_rank) return a.finish_rank - b.finish_rank;
                  if (a.finish_rank) return -1;
                  if (b.finish_rank) return 1;
                  return (b.score ?? 0) - (a.score ?? 0) || b.current_space - a.current_space;
                })
                .map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg ink-border-sm"
                    style={{ background: i === 0 ? "var(--boom-yellow)" : "white" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black w-6 text-center">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      <PlayerToken avatar={p.avatar_url} username={p.username} size={28} showName={false} />
                      <span className="font-black text-sm">{p.username}</span>
                    </div>
                    <span className="font-black text-sm" style={{ color: "var(--boom-red)" }}>{p.score ?? 0} pts</span>
                  </div>
                ))}
            </div>
            <button onClick={() => setShowFinalRanking(false)} className="ink-border-sm rounded-xl px-4 py-2 font-black text-sm">
              CLOSE
            </button>
            <p className="text-xs opacity-70 mt-2">Waiting for the host to restart…</p>
          </div>
        </div>
      )}

      <div className="text-center text-xs opacity-70 flex items-center justify-center gap-1">
        <Bomb size={12} /> BOOM — The Workout Game
      </div>

      {showCamera && <BoomCamera onClose={() => setShowCamera(false)} />}
      {myLanded && <CellMascot key={myLanded.key} type={myLanded.type} />}
      {myTurnFlash && (
        <div
          key={myTurnFlash}
          className="fixed inset-0 z-[80] pointer-events-none anim-screen-flash"
          style={{ background: "var(--boom-yellow)" }}
        />
      )}
      {/* countdown rendered inline inside the timer box */}
    </main>
  );
}
