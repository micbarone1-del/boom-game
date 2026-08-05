import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom, type Player, type Pod, type Room } from "@/hooks/use-room";
import { generateRoomCode } from "@/lib/game";
import { Bomb, Copy, Play, RotateCcw, Settings, Share2 } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { FuseBar } from "@/components/FuseBar";
import { GymMap, GymScoreboard } from "@/components/GymMap";
import { PodActivityTicker } from "@/components/PodActivityTicker";
import { TimesOutOverlay, GameOverOverlay } from "@/components/TimeoutOverlay";
import { setBgmIntensity, startArcadeMusic } from "@/lib/sfx";
import { PauseOverlay, PauseToggleButton } from "@/components/PauseOverlay";
import { JoinAsModal } from "@/components/JoinAsModal";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/gym/$code")({
  component: GymView,
  head: ({ params }) => ({
    meta: [
      { title: `Gym ${params.code} — BOOM!` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function GymView() {
  const { code: codeParam } = Route.useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(codeParam === "new" ? null : codeParam);
  const [joinModalOpen, setJoinModalOpen] = useState(false);

  useEffect(() => {
    if (codeParam !== "new") {
      setCode(codeParam);
      return;
    }
    (async () => {
      const newCode = generateRoomCode();
      const { error } = await supabase.from("rooms").insert({ code: newCode });
      if (!error) {
        setCode(newCode);
        navigate({ to: "/gym/$code", params: { code: newCode }, replace: true });
      }
    })();
  }, [codeParam, navigate]);

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center text-3xl">Igniting fuse…</div>
    );
  }

  return (
    <>
      <Lobby code={code} onJoinOpen={() => setJoinModalOpen(true)} />
      <JoinAsModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onSignedIn={() => setJoinModalOpen(false)}
        onGuestChosen={() => setJoinModalOpen(false)}
        title="Join the game"
        subtitle="Sign in so your score can reach the leaderboard"
      />
    </>
  );
}


const POD_COLORS = ["var(--boom-yellow)", "var(--boom-orange)", "var(--boom-green)"];

function Lobby({ code, onJoinOpen }: { code: string; onJoinOpen: () => void }) {
  const { room, players, pods, loading } = useRoom(code);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  // Brief pause animation overlay shown when the room transitions to paused.
  // After the animation, we hide it so the lobby (Play/Restart/Customise) is usable.
  const [showPauseIntro, setShowPauseIntro] = useState(false);

  useEffect(() => {
    if (room?.paused) {
      setShowPauseIntro(true);
      const t = setTimeout(() => setShowPauseIntro(false), 1400);
      return () => clearTimeout(t);
    }
    setShowPauseIntro(false);
  }, [room?.paused]);

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${code}`;
  }, [code]);

  const podsBySlot = useMemo(() => {
    const m = new Map<number, typeof pods[number]>();
    pods.forEach((p) => m.set(p.slot, p));
    return m;
  }, [pods]);

  const playersByPod = useMemo(() => {
    const m = new Map<string, typeof players>();
    players.forEach((p) => {
      if (!p.pod_id) return;
      const arr = m.get(p.pod_id) ?? [];
      arr.push(p);
      m.set(p.pod_id, arr);
    });
    return m;
  }, [players]);

  const canStart =
    pods.length > 0 && pods.every((p) => (playersByPod.get(p.id)?.length ?? 0) >= 2) && !starting;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const share = async () => {
    const shareData = {
      title: `Join BOOM! room ${code}`,
      text: `Join my BOOM! workout — sign in to save your score on the leaderboard.`,
      url: joinUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(joinUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  };

  const start = async () => {
    if (!canStart) return;
    setStarting(true);
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 15 * 60 * 1000);
    await supabase
      .from("rooms")
      .update({
        status: "playing",
        trap: null,
        locked: false,
        game_started_at: startedAt.toISOString(),
        game_ends_at: endsAt.toISOString(),
        game_state: "playing",
        continue_deadline_at: null,
        paused: false,
      })
      .eq("code", code);
    await supabase.from("pods").update({ status: "playing" }).eq("room_code", code);
    setStarting(false);
  };

  const resume = async () => {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 15 * 60 * 1000);
    await supabase
      .from("rooms")
      .update({
        paused: false,
        game_started_at: startedAt.toISOString(),
        game_ends_at: endsAt.toISOString(),
        game_state: "playing",
        continue_deadline_at: null,
      })
      .eq("code", code);
  };

  const restartAll = async () => {
    if (!confirm("Reset all scores and start a new game?")) return;
    setStarting(true);
    await supabase
      .from("players")
      .update({ current_space: 0, score: 0, finished_at: null, finish_rank: null })
      .eq("room_code", code);
    await supabase
      .from("pods")
      .update({ status: "waiting", current_space: 0, score: 0, current_turn_player_id: null })
      .eq("room_code", code);
    await supabase
      .from("rooms")
      .update({
        status: "waiting",
        trap: null,
        locked: false,
        game_started_at: null,
        game_ends_at: null,
        game_state: "playing",
        continue_deadline_at: null,
        paused: false,
        phase: "board",
        boss_hp: 0,
        boss_max_hp: 0,
        boss_started_at: null,
        boss_defeated_at: null,
      })
      .eq("code", code);
    setStarting(false);
    navigate({ to: "/" });
  };

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center text-2xl">Loading gym…</div>
    );
  }

  // Once playing, show the shared map view instead of the lobby.
  const isLive =
    room.status === "playing" ||
    room.game_state === "playing" ||
    room.game_state === "timeout_continue" ||
    room.game_state === "game_over";

  if (isLive && !room.paused) {
    return <MapView room={room} players={players} pods={pods} code={code} />;
  }

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto flex flex-col gap-4">
      <header className="flex items-center gap-3 mt-2">
        <img src={bombMascot} alt="" className="w-14 h-14 anim-fuse drop-shadow-[0_4px_0_rgba(0,0,0,0.25)]" />
        <div className="flex-1">
          <h1
            className="text-4xl font-black leading-none"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
          >
            BOOM!
          </h1>
          <p
            className="text-[11px] font-black tracking-[0.18em] opacity-80 mt-0.5"
            style={{ fontFamily: "'Luckiest Guy', cursive" }}
          >
            GYM SCREEN
          </p>
        </div>
        {!user ? (
          <button
            onClick={onJoinOpen}
            className="ink-border-sm rounded-xl px-3 py-2 text-xs font-black bg-white"
          >
            Sign in to save scores
          </button>
        ) : (
          <div className="text-[10px] font-bold opacity-70 text-right">
            <div>signed in</div>
            <button onClick={() => supabase.auth.signOut()} className="underline">sign out</button>
          </div>
        )}
      </header>

      {/* Join card */}
      <div className="ink-border rounded-2xl bg-white p-4 flex flex-col sm:flex-row gap-4 items-center">
        <div className="bg-white p-2 rounded-xl ink-border-sm">
          <QRCodeSVG value={joinUrl} size={160} bgColor="#ffffff" fgColor="#111111" level="M" />
        </div>
        <div className="flex-1 flex flex-col gap-2 w-full">
          <div className="text-xs font-bold opacity-60 uppercase tracking-wider">Room code</div>
          <div
            className="text-5xl font-black leading-none"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-ink)" }}
          >
            {code}
          </div>
          <p className="text-xs opacity-70">
            Each player scans the QR or opens{" "}
            <span className="font-black">{`${joinUrl.replace(/^https?:\/\//, "")}`}</span>{" "}
            to join a pod and <span className="font-black">sign in</span> with their profile.
          </p>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={copy}
              className="ink-border-sm rounded-xl px-3 py-2 text-sm font-black bg-white flex items-center gap-2"
            >
              <Copy size={14} /> {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={share}
              className="ink-border-sm rounded-xl px-3 py-2 text-sm font-black bg-[var(--boom-yellow)] flex items-center gap-2"
            >
              <Share2 size={14} /> Share login link
            </button>
          </div>
        </div>
      </div>

      {/* Pods list */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((slot) => {
          const pod = podsBySlot.get(slot);
          const podPlayers = pod ? playersByPod.get(pod.id) ?? [] : [];
          const color = POD_COLORS[slot - 1];
          return (
            <div
              key={slot}
              className="ink-border rounded-2xl p-3 bg-white flex flex-col gap-2 min-h-[160px]"
              style={{ borderColor: "#111" }}
            >
              <div
                className="rounded-xl px-3 py-2 text-center font-black"
                style={{
                  background: color,
                  fontFamily: "'Luckiest Guy', cursive",
                  fontSize: "1.25rem",
                  color: "var(--boom-ink)",
                }}
              >
                {pod ? pod.name : `POD ${slot}`}
              </div>
              {pod && (
                <button
                  type="button"
                  onClick={async () => {
                    const next = window.prompt("Rename team", pod.name);
                    if (!next || next.trim() === pod.name) return;
                    await supabase.from("pods").update({ name: next.trim().slice(0, 24) }).eq("id", pod.id);
                  }}
                  className="text-[10px] font-black opacity-70 hover:opacity-100 underline self-end"
                >
                  rename team
                </button>
              )}
              {!pod ? (
                <div className="text-xs opacity-60 text-center my-auto">
                  Waiting for a pod to join…
                </div>
              ) : podPlayers.length === 0 ? (
                <div className="text-xs opacity-60 text-center my-auto">No players yet</div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {podPlayers.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 text-sm font-bold group"
                    >
                      <span
                        className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center shrink-0"
                        style={{
                          background:
                            p.avatar_url?.startsWith("mascot:")
                              ? p.avatar_url.slice(7)
                              : "#ec4899",
                          boxShadow: "0 0 0 1.5px #111",
                        }}
                      >
                        {p.avatar_url?.startsWith("mascot:") ? (
                          <Bomb size={12} color="white" fill="white" />
                        ) : p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </span>
                      <span className="truncate flex-1">{p.username}</span>
                      <button
                        type="button"
                        title="Remove player from team"
                        onClick={async () => {
                          if (!confirm(`Remove ${p.username} from ${pod.name}?`)) return;
                          await supabase.from("players").update({ pod_id: null }).eq("id", p.id);
                        }}
                        className="opacity-40 hover:opacity-100 text-xs"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pod && pod.status === "playing" && (
                <Link
                  to="/pod/$code/$podId"
                  params={{ code, podId: pod.id }}
                  className="ink-border-sm rounded-xl text-center py-2 text-xs font-black bg-[var(--boom-green)] text-white mt-auto"
                >
                  Open pod
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <SpotifyEmbed code={code} paused={!!room.paused} />

      <a
        href={`/gym/${code}/customize`}
        target="_blank"
        rel="noopener noreferrer"
        className="ink-border rounded-2xl bg-white px-4 py-3 text-base font-black flex items-center justify-center gap-2 active:scale-95"
      >
        <Settings size={18} /> CUSTOMISE TRAINING & MUSIC
      </a>

      {isLive ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={resume}
            className="btn-boom text-2xl py-4 flex items-center justify-center gap-2"
            style={{ fontFamily: "'Luckiest Guy', cursive", background: "var(--boom-green)" }}
          >
            <Play className="inline" /> PLAY
          </button>
          <button
            onClick={restartAll}
            disabled={starting}
            className="btn-boom text-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ fontFamily: "'Luckiest Guy', cursive", background: "var(--boom-red)" }}
          >
            <RotateCcw className="inline" /> RESTART
          </button>
        </div>
      ) : (
        <button
          onClick={start}
          disabled={!canStart}
          className="btn-boom mt-2 text-2xl py-4 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{
            fontFamily: "'Luckiest Guy', cursive",
            background: canStart ? "var(--boom-red)" : "#999",
          }}
        >
          <Play className="inline" /> START GAME
        </button>
      )}
      {!isLive && !canStart && pods.length === 0 && (
        <p className="text-xs text-center opacity-70">
          Waiting for at least one pod with 2+ players to join…
        </p>
      )}
      {!isLive && !canStart && pods.length > 0 && (
        <p className="text-xs text-center opacity-70">
          Every pod needs at least 2 players to start.
        </p>
      )}
      {showPauseIntro && (
        <PauseOverlay
          code={code}
          players={players}
          pods={pods}
          onSignInClick={onJoinOpen}
        />
      )}
    </main>
  );
}

function MapView({ room, players, pods, code }: { room: Room; players: Player[]; pods: Pod[]; code: string }) {
  const startedAt = room.game_started_at ? new Date(room.game_started_at).getTime() : null;
  const endsAt = room.game_ends_at ? new Date(room.game_ends_at).getTime() : null;
  const continueAt = room.continue_deadline_at ? new Date(room.continue_deadline_at).getTime() : null;

  // Drive BGM intensity from fuse progress.
  useEffect(() => {
    startArcadeMusic();
    if (!startedAt || !endsAt) return;
    const i = setInterval(() => {
      const p = Math.max(0, Math.min(1, (Date.now() - startedAt) / (endsAt - startedAt)));
      setBgmIntensity(p);
    }, 1000);
    return () => clearInterval(i);
  }, [startedAt, endsAt]);

  // Watch for timeout: first client transitions room state.
  useEffect(() => {
    if (!endsAt || room.game_state !== "playing") return;
    const i = setInterval(async () => {
      if (Date.now() < endsAt) return;
      const anyFinished = players.some((p) => p.finished_at);
      if (anyFinished) return;
      await supabase
        .from("rooms")
        .update({
          // Fuse ran out → straight to GAME OVER (no continue prompt).
          game_state: "game_over",
          continue_deadline_at: null,
        })
        .eq("code", code)
        .eq("game_state", "playing");
      clearInterval(i);
    }, 1000);
    return () => clearInterval(i);
  }, [endsAt, room.game_state, players, code]);

  // Continue countdown → game over.
  useEffect(() => {
    if (room.game_state !== "timeout_continue" || !continueAt) return;
    const i = setInterval(async () => {
      if (Date.now() < continueAt) return;
      await supabase
        .from("rooms")
        .update({ game_state: "game_over" })
        .eq("code", code)
        .eq("game_state", "timeout_continue");
      clearInterval(i);
    }, 500);
    return () => clearInterval(i);
  }, [room.game_state, continueAt, code]);

  return (
    <main className="min-h-screen p-3 max-w-5xl mx-auto flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src={bombMascot} alt="" className="w-11 h-11 anim-fuse drop-shadow-[0_3px_0_rgba(0,0,0,0.25)]" />
          <div>
            <h1
              className="text-3xl font-black leading-none"
              style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
            >
              BOOM!
            </h1>
            <div className="text-[10px] font-black tracking-[0.18em] opacity-75" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
              ROOM {code}
            </div>
          </div>
        </div>
        <div className="flex-1 max-w-md">
          <FuseBar startedAt={startedAt} endsAt={endsAt} paused={room.game_state !== "playing" || !!room.paused} />
        </div>
        <PauseToggleButton
          paused={!!room.paused}
          onToggle={() => {
            void supabase.from("rooms").update({ paused: !room.paused }).eq("code", code).then(() => {});
          }}
        />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 items-start">
        <GymMap players={players} pods={pods} />
        <GymScoreboard players={players} pods={pods} />
      </div>

      <PodActivityTicker roomCode={code} pods={pods} />

      {/* Corner mascot peeking from the bottom-right during gameplay */}
      <img
        src={bombMascot}
        alt=""
        aria-hidden
        className="fixed bottom-2 right-2 w-24 h-24 md:w-32 md:h-32 pointer-events-none z-20 anim-mascot-peek anim-fuse drop-shadow-[0_6px_0_rgba(0,0,0,0.35)]"
      />

      {room.game_state === "timeout_continue" && continueAt && (
        <TimesOutOverlay continueDeadlineAt={continueAt} showContinue={false} />
      )}
      {room.game_state === "game_over" && <GameOverOverlay />}
      {room.paused && (
        <PauseOverlay
          code={code}
          players={players}
          pods={pods}
          onResume={() => {
            void supabase.from("rooms").update({ paused: false }).eq("code", code).then(() => {});
          }}
        />
      )}
    </main>
  );
}