import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import { loadPlayerSession, rollDice, pickExercise, calcReps, TRAP_SPACES, BOOST_SPACES, BOARD_SIZE, type Trap } from "@/lib/game";
import { PlayerToken } from "@/components/PlayerToken";
import { FuseTimer } from "@/components/FuseTimer";
import { Bomb, Dice5 } from "lucide-react";

export const Route = createFileRoute("/play/$code")({
  component: PlayPage,
});

function PlayPage() {
  const { code } = Route.useParams();
  const { room, players } = useRoom(code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    const s = loadPlayerSession();
    if (s?.roomCode === code) setPlayerId(s.playerId);
  }, [code]);

  const me = players.find((p) => p.id === playerId);
  const trap = room?.trap as Trap | null;

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

    if (TRAP_SPACES.has(target)) {
      // Move to trap space, lock with trap
      const reps = calcReps(me.fitness_level, room.difficulty_multiplier);
      const exercise = pickExercise();
      await supabase.from("players").update({ current_space: target }).eq("id", me.id);
      await supabase.from("rooms").update({
        locked: true,
        last_dice: dice,
        trap: {
          exercise, reps, triggered_by: me.id, started_at: Date.now(), awaiting_verification: false,
        } satisfies Trap,
      }).eq("code", code);
    } else {
      // Boost?
      const final = BOOST_SPACES.has(target) ? Math.min(BOARD_SIZE, target + 5) : target;
      await supabase.from("players").update({ current_space: final }).eq("id", me.id);
      // Pass turn
      const order = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      const idx = order.findIndex((p) => p.id === me.id);
      const next = order[(idx + 1) % order.length];
      await supabase.from("rooms").update({
        last_dice: dice,
        current_turn_player_id: next.id,
      }).eq("code", code);
    }
    setRolling(false);
  };

  const onIDidIt = async () => {
    if (!trap || !triggeredByMe) return;
    await supabase.from("rooms").update({
      trap: { ...trap, awaiting_verification: true },
    }).eq("code", code);
  };

  return (
    <main className="min-h-screen p-4 flex flex-col gap-4 max-w-md mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold opacity-70">ROOM</div>
          <div className="text-xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>{code}</div>
        </div>
        <PlayerToken avatar={me.avatar_url} username={me.username} size={56} active={isMyTurn} />
      </header>

      <div className="ink-border rounded-2xl bg-white p-4 text-center">
        <div className="text-sm font-bold opacity-70">YOU ARE ON SPACE</div>
        <div className="text-6xl font-black comic-shadow" style={{ color: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}>
          #{me.current_space}
        </div>
        <div className="text-xs mt-1">Fitness Lvl {me.fitness_level} · Difficulty x{room?.difficulty_multiplier ?? 5}</div>
      </div>

      {trap ? (
        <div className="ink-border rounded-3xl p-6 text-center anim-boom" style={{ background: "var(--boom-red)", color: "white" }}>
          <div className="text-5xl font-black comic-shadow" style={{ fontFamily: "'Luckiest Guy', cursive" }}>BOOM!</div>
          <p className="text-xl font-black mt-2">
            {triggeredByMe ? "YOU stepped on a mine!" : `${players.find(p=>p.id===trap.triggered_by)?.username || "Someone"} got blasted!`}
          </p>
          <p className="text-2xl font-black mt-2">{trap.reps} {trap.exercise}</p>
          <div className="mt-3"><FuseTimer startedAt={trap.started_at} /></div>
          {triggeredByMe && (
            trap.awaiting_verification ? (
              <p className="mt-4 font-bold">Waiting for the room to judge your form…</p>
            ) : (
              <button onClick={onIDidIt} className="mt-5 ink-border rounded-2xl px-6 py-5 text-3xl font-black w-full"
                style={{ background: "var(--boom-green)", color: "white", fontFamily: "'Luckiest Guy', cursive" }}>
                I DID IT!
              </button>
            )
          )}
          {!triggeredByMe && trap.awaiting_verification && (
            <p className="mt-4 font-bold">Head to the GYM SCREEN to vote DEFUSED or BLOW IT UP.</p>
          )}
        </div>
      ) : (
        <button
          onClick={onRoll}
          disabled={!isMyTurn || rolling || room?.locked}
          className="ink-border rounded-3xl p-8 text-3xl font-black flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: isMyTurn ? "var(--boom-yellow)" : "var(--muted)", color: "var(--boom-ink)", fontFamily: "'Luckiest Guy', cursive" }}
        >
          <Dice5 size={64} className={rolling ? "anim-shake" : ""} />
          {rolling ? "ROLLING…" : isMyTurn ? "ROLL DICE" : "Wait for your turn"}
          {room?.last_dice && <span className="text-base font-bold">Last roll: {room.last_dice}</span>}
        </button>
      )}

      <div className="ink-border rounded-2xl bg-white p-3">
        <div className="text-sm font-black mb-2">PLAYERS</div>
        <div className="flex gap-3 overflow-x-auto">
          {players.map((p) => (
            <div key={p.id} className="flex-shrink-0">
              <PlayerToken avatar={p.avatar_url} username={p.username} size={48}
                active={room?.current_turn_player_id === p.id} />
              <div className="text-center text-xs">#{p.current_space}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-xs opacity-70 flex items-center justify-center gap-1">
        <Bomb size={12} /> BOOM — The Workout Game
      </div>
    </main>
  );
}
