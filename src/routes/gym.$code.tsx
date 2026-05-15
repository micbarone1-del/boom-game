import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import { generateRoomCode, BOARD_SIZE, BOARD, HOP_MS, LANDING_SPLASH_MS, getCell, describeCell, finishPlayer, recalcPlayerScore, type Trap, type BoardOverrides } from "@/lib/game";
import { TRAP_TIMEOUT_MS } from "@/lib/game";
import { PRESETS, applyPreset } from "@/lib/presets";
import { PlayerToken } from "@/components/PlayerToken";
import { FuseTimer } from "@/components/FuseTimer";
import { CellMascot, mascotForCell } from "@/components/CellMascot";
import { CountdownIntro } from "@/components/CountdownIntro";
import { Bomb, Flame, Trophy, Flag, Settings, Dumbbell, Zap, ArrowLeft, HelpCircle, AlertTriangle, Users } from "lucide-react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { sfx } from "@/lib/sfx";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { TutorialCarousel } from "@/components/TutorialCarousel";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { OrientationLock } from "@/components/OrientationLock";
import { ExplosionOverlay } from "@/components/ExplosionOverlay";
import { GameStartReveal } from "@/components/GameStartReveal";

export const Route = createFileRoute("/gym/$code")({
  component: GymView,
  head: ({ params }) => ({
    meta: [
      { title: `Game Lobby ${params.code} — BOOM!` },
      { name: "description", content: "BOOM! gym screen — the big-screen master view. Players join from their phones, the board updates in real time." },
      { property: "og:title", content: `BOOM! Game Lobby — Room ${params.code}` },
      { property: "og:description", content: "Big-screen master view for a BOOM! workout game session." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/** Dumbbell with a single empty (outlined) weight on each side — matches the
 *  Lucide Dumbbell stroke style used on the orange (medium) cells. */
function MiniDumbbell({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* bar */}
      <line x1="8" y1="12" x2="16" y2="12" />
      {/* left weight (empty) */}
      <rect x="3" y="7.5" width="5" height="9" rx="1.2" />
      {/* right weight (empty) */}
      <rect x="16" y="7.5" width="5" height="9" rx="1.2" />
    </svg>
  );
}

function SfxButton({ className = "", variant = "green" }: { className?: string; variant?: "green" | "white" }) {
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const [unlocked, setUnlocked] = useState(() => sfx.isUnlocked());
  const [pulse, setPulse] = useState(0);
  const isWhite = variant === "white";
  const on = !muted && unlocked;
  const label = muted ? "SFX OFF" : unlocked ? "SFX ON" : "TAP TO ENABLE SFX";
  const bg = muted
    ? "#888"
    : unlocked
      ? "var(--boom-green)"
      : "var(--boom-orange)";
  return (
    <button
      onClick={async () => {
        setPulse((p) => p + 1);
        // First click while muted -> turn ON + unlock + test beep.
        // Click while ON -> turn OFF (mute).
        if (muted) {
          sfx.setMuted(false);
          setMuted(false);
          sfx.play("didIt");
          const ok = await sfx.unlock();
          setUnlocked(ok);
          return;
        }
        if (!unlocked) {
          // Audio not yet unlocked by browser — this gesture unlocks it.
          sfx.play("didIt");
          const ok = await sfx.unlock();
          setUnlocked(ok);
          return;
        }
        // Already on -> mute.
        sfx.setMuted(true);
        setMuted(true);
      }}
      className={
        isWhite
          ? `ink-border-sm rounded-xl px-3 py-2 font-black text-sm flex items-center gap-1 transition-transform active:scale-95 ${className}`
          : `btn-boom flex items-center gap-2 py-2 px-4 text-base transition-transform active:scale-95 ${className}`
      }
      style={
        isWhite
          ? { background: bg, color: muted ? "white" : "var(--boom-ink)" }
          : { fontFamily: "'Luckiest Guy', cursive", background: bg }
      }
      title={muted ? "Tap to enable sound effects" : unlocked ? "Tap to mute sound effects" : "Tap once to enable audio in this browser"}
      key={pulse}
    >
      {on ? <Volume2 size={isWhite ? 16 : 18} /> : <VolumeX size={isWhite ? 16 : 18} />} {label}
    </button>
  );
}

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
  const [paused, setPaused] = useState(false);
  const [exploding, setExploding] = useState(false);
  const [landed, setLanded] = useState<{ id: string; type: import("@/lib/game").CellType; username: string; key: number } | null>(null);
  const [turnAnnounce, setTurnAnnounce] = useState<{ username: string; avatar: string | null; key: number } | null>(null);
  const prevTurnKeyRef = useRef<string | null>(null);
  const turnAnnounceRef = useRef<{ key: number } | null>(null);
  useEffect(() => { turnAnnounceRef.current = turnAnnounce ? { key: turnAnnounce.key } : null; }, [turnAnnounce]);
  const turnAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hard safety: any time turnAnnounce is set, ensure it clears within 2.6s
  // even if the effect that scheduled it never fires its cleanup (e.g. trap
  // arrives mid-flight and unmounts the overlay logic).
  useEffect(() => {
    if (!turnAnnounce) return;
    if (turnAnnounceTimerRef.current) clearTimeout(turnAnnounceTimerRef.current);
    turnAnnounceTimerRef.current = setTimeout(() => setTurnAnnounce(null), 2600);
    return () => {
      if (turnAnnounceTimerRef.current) {
        clearTimeout(turnAnnounceTimerRef.current);
        turnAnnounceTimerRef.current = null;
      }
    };
  }, [turnAnnounce]);
  // Per-player rendered space (animated hop-by-hop toward the real current_space).
  const [hopSpaces, setHopSpaces] = useState<Record<string, number>>({});
  const [hoppingIds, setHoppingIds] = useState<Set<string>>(new Set());
  // Tick to re-render the modal so we can toggle the flashing border off
  // exactly when the countdown ends.
  const [, setTick] = useState(0);
  const prevRef = useRef<Record<string, number>>({});
  const hopTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seenPlayerIdsRef = useRef<Set<string>>(new Set());
  const lastTrapIdRef = useRef<string | null>(null);
  const countdownTicksRef = useRef<Set<number>>(new Set());
  const winnerSoundRef = useRef<Set<string>>(new Set());
  const prevStartedRef = useRef<boolean>(false);
  const pauseStartedAtRef = useRef<number | null>(null);
  const orderedPlayers = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
  const hasGameProgress = players.some(
    (p) => p.current_space > 0 || !!p.finished_at || !!p.finish_rank || (p.score ?? 0) > 0,
  );
  const gameHasStarted = room?.status === "playing" || !!room?.current_turn_player_id || hasGameProgress || !!trap;
  const isPaused = !!room?.paused || paused;
  // Full-screen play mode shows only the board; lobby mode shows QR/Spotify/leaderboard/players.
  const inPlayMode = gameHasStarted && !isPaused;

  useEffect(() => {
    if (isPaused && pauseStartedAtRef.current === null) pauseStartedAtRef.current = Date.now();
  }, [isPaused]);

  useEffect(() => {
    if (!isPaused) return;
    hopTimeoutsRef.current.forEach(clearTimeout);
    hopTimeoutsRef.current = [];
    setHoppingIds(new Set());
    setLanded(null);
    setTurnAnnounce(null);
    setExploding(false);
  }, [isPaused]);

  // Camera (board zoom/pan): scale 1 idle; scale 3 centered on the active
  // token while a roll is animating or a trap is on the board. Pans live as
  // the token hops cell to cell.
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const boardInnerRef = useRef<HTMLDivElement>(null);
  const [boardTransform, setBoardTransform] = useState("scale(1) translate(0px, 0px)");
  // Track whether the camera was already zoomed-in on the previous tick so we
  // can use a longer, eased transition for the initial zoom-in / final
  // zoom-out and a tight linear pan between hops.
  const [cameraPhase, setCameraPhase] = useState<"idle" | "settle" | "pan">("idle");
  // Always keep the camera centered on the active player. Zoom in tighter
  // while the token is hopping; ease back to a wider follow when idle.
  const hoppingId = hoppingIds.size > 0 ? Array.from(hoppingIds)[0] : null;
  const turnId = room?.current_turn_player_id ?? null;
  const focusPlayerId = hoppingId ?? turnId;
  const focusPlayer = focusPlayerId ? players.find((p) => p.id === focusPlayerId) : null;
  const rawFocusSpace = focusPlayerId
    ? hopSpaces[focusPlayerId] ?? focusPlayer?.current_space ?? 0
    : 0;
  const focusSpace = rawFocusSpace > 0 ? rawFocusSpace : 1;
  const zoomActive = !!focusPlayerId && !trap;
  const isHoppingFocus = !!hoppingId;
  useEffect(() => {
    const recalc = () => {
      const inner = boardInnerRef.current;
      const wrap = boardWrapRef.current;
      if (!inner || !wrap) {
        return;
      }
      if (!zoomActive) {
        setBoardTransform("translate(0px, 0px) scale(1)");
        setCameraPhase("idle");
        return;
      }
      const cellEl = inner.querySelector(`[data-space="${focusSpace}"]`) as HTMLElement | null;
      if (!cellEl) return;
      // Accumulate offsetLeft/Top up to the inner board so the focal point is
      // robust regardless of intermediate positioned ancestors.
      let cx = cellEl.offsetWidth / 2;
      // Tokens sit above the cell — bias upward so the avatar lands at the
      // visual center of the screen.
      let cy = cellEl.offsetHeight * 0.15;
      let node: HTMLElement | null = cellEl;
      while (node && node !== inner) {
        cx += node.offsetLeft;
        cy += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const Wc = wrap.clientWidth;
      const Hc = wrap.clientHeight;
      const innerW = inner.scrollWidth || inner.offsetWidth;
      const innerH = inner.scrollHeight || inner.offsetHeight;
      // Hopping: zoom in tight on the moving token. Idle: zoom OUT as far as
      // possible while still fitting the whole board in view, centered on the
      // active player (clamped to board edges so we don't show empty space).
      const fitScale = Math.min(Wc / innerW, Hc / innerH);
      const scale = isHoppingFocus ? 2 : fitScale;
      let tx = Wc / 2 - cx * scale;
      let ty = Hc / 2 - cy * scale;
      // Clamp so the scaled board never leaves a gap inside the viewport.
      const scaledW = innerW * scale;
      const scaledH = innerH * scale;
      const minTx = Math.min(0, Wc - scaledW);
      const maxTx = Math.max(0, Wc - scaledW);
      const minTy = Math.min(0, Hc - scaledH);
      const maxTy = Math.max(0, Hc - scaledH);
      tx = Math.min(maxTx, Math.max(minTx, tx));
      ty = Math.min(maxTy, Math.max(minTy, ty));
      setBoardTransform(`translate(${tx}px, ${ty}px) scale(${scale})`);
      setCameraPhase((prev) => (prev === "idle" ? "settle" : "pan"));
    };
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [focusSpace, zoomActive, isHoppingFocus, inPlayMode]);

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
    for (const p of players) {
      const prev = prevRef.current[p.id];
      prevRef.current[p.id] = p.current_space;
      if (isPaused) {
        setHopSpaces((s) => ({ ...s, [p.id]: p.current_space }));
        continue;
      }
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
      // A new hop sequence is starting for this player — clear any landed
      // mascot still showing from the previous hop so animations don't overlap.
      setLanded((cur) => (cur && cur.id === p.id ? null : cur));
      // Wait for any in-flight "[name] ROLLS!" announcement to finish before
      // the token starts hopping so the two animations don't overlap.
      const ann = turnAnnounceRef.current;
      const announceRemaining = ann ? Math.max(0, 2500 - (Date.now() - ann.key)) : 0;
      hopTimeoutsRef.current.push(setTimeout(() => {
        setHoppingIds((s) => { const n = new Set(s); n.add(p.id); return n; });
      }, announceRemaining));
      for (let i = 1; i <= distance; i++) {
        const at = from + i * step;
        hopTimeoutsRef.current.push(setTimeout(() => {
          setHopSpaces((s) => ({ ...s, [p.id]: at }));
          sfx.play("hop");
        }, announceRemaining + i * HOP_MS));
      }
      hopTimeoutsRef.current.push(setTimeout(() => {
        setHoppingIds((s) => { const n = new Set(s); n.delete(p.id); return n; });
        if (to > 0) {
          const cell = getCell(to);
          setLanded({ id: p.id, type: cell.type, username: p.username, key: Date.now() });
          // Play the cell-type animation sound when the token lands.
          const cellSfx: Record<string, Parameters<typeof sfx.play>[0] | undefined> = {
            easy: "easy", medium: "medium", hard: "hard",
            rest: "rest", boost: "blast", setback: "setback",
          };
          const which = cellSfx[cell.type];
          if (which) sfx.play(which);
          hopTimeoutsRef.current.push(setTimeout(() => setLanded(null), LANDING_SPLASH_MS));
        }
      }, announceRemaining + distance * HOP_MS));
    }
  }, [players, isPaused]);

  // Player joined sound — fires when a new player id appears.
  useEffect(() => {
    if (isPaused) return;
    if (players.length === 0) {
      seenPlayerIdsRef.current = new Set();
      return;
    }
    // Skip the very first batch (initial load) to avoid a burst on refresh.
    if (seenPlayerIdsRef.current.size === 0) {
      seenPlayerIdsRef.current = new Set(players.map((p) => p.id));
      return;
    }
    for (const p of players) {
      if (!seenPlayerIdsRef.current.has(p.id)) {
        seenPlayerIdsRef.current.add(p.id);
        sfx.play("playerJoin");
      }
    }
  }, [players, isPaused]);

  // Game start sound — fires when the room transitions into play.
  useEffect(() => {
    if (isPaused) return;
    const started = !!room && (room.status === "playing" || !!room.current_turn_player_id);
    if (started && !prevStartedRef.current) sfx.play("gameStart");
    prevStartedRef.current = started;
  }, [room, isPaused]);

  // Turn announcement — flash a "[NAME] ROLLS!" overlay when the active turn
  // changes. We key on (turn player id + last_dice) so that a RESTART (which
  // sets last_dice back to null while keeping the same first player) ALSO
  // re-fires the announcement, not just turn rotations.
  useEffect(() => {
    if (isPaused) return;
    const tid = room?.current_turn_player_id ?? null;
    if (!tid) { prevTurnKeyRef.current = null; return; }
    const key = `${tid}|${room?.last_dice ?? "null"}`;
    if (prevTurnKeyRef.current === key) return;
    const isFirst = prevTurnKeyRef.current === null;
    prevTurnKeyRef.current = key;
    if (trap) return;
    // Skip the very first render (just loaded the page) to avoid an
    // overlay every time the host opens the gym screen mid-game.
    if (isFirst) return;
    const player = players.find((p) => p.id === tid);
    if (!player) return;
    setTurnAnnounce({ username: player.username, avatar: player.avatar_url, key: Date.now() });
    const t = setTimeout(() => setTurnAnnounce(null), 2500);
    return () => clearTimeout(t);
  }, [room?.current_turn_player_id, room?.last_dice, players, trap, isPaused]);

  // Countdown beeps — one per second of the 3-2-1.
  useEffect(() => {
    if (isPaused) return;
    if (!trap) {
      countdownTicksRef.current = new Set();
      return;
    }
    const remaining = trap.started_at - Date.now();
    if (remaining <= 0 || remaining > 3500) return;
    const n = Math.max(1, Math.ceil(remaining / 1000));
    if (!countdownTicksRef.current.has(n)) {
      countdownTicksRef.current.add(n);
      sfx.play("countdown");
    }
  });

  // Trap appearance: distinguish defuse vs blow up button presses.
  useEffect(() => {
    if (!trap) {
      lastTrapIdRef.current = null;
      return;
    }
    const id = `${trap.triggered_by}:${trap.started_at}`;
    lastTrapIdRef.current = id;
  }, [trap]);

  // Win sound — when a player finishes.
  useEffect(() => {
    for (const p of players) {
      if (p.finished_at && !winnerSoundRef.current.has(p.id)) {
        winnerSoundRef.current.add(p.id);
        sfx.play("win");
      }
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


  // Tick while the trap modal is open so border-flash can switch off when the
  // countdown completes.
  useEffect(() => {
    if (!trap) return;
    const i = setInterval(() => setTick((t) => t + 1), 150);
    return () => clearInterval(i);
  }, [trap]);

  // Timed-out player whose name is shown in the explosion overlay (60s timeout).
  const [timeoutBoom, setTimeoutBoom] = useState<string | null>(null);

  // 60-second timeout: if a trap is still active 60s after the countdown
  // ended, the bomb explodes — show overlay, send the active player back to
  // start, clear the trap, and pass the turn to the next player.
  const explosionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (explosionTimerRef.current) {
      clearTimeout(explosionTimerRef.current);
      explosionTimerRef.current = null;
    }
    if (!trap || !room || isPaused) return;
    if (trap.kind === "group") return; // group cells don't explode
    const deadline = trap.started_at + TRAP_TIMEOUT_MS;
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    explosionTimerRef.current = setTimeout(async () => {
      const triggered = players.find((p) => p.id === trap.triggered_by);
      if (!triggered) return;
      setTimeoutBoom(triggered.username);
      sfx.play("setback");
      // Send player back to start.
      await supabase.from("players").update({ current_space: 1 }).eq("id", triggered.id);
      // Pick next turn (skip finished + the just-exploded one once).
      const order = [...players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      const idx = order.findIndex((p) => p.id === triggered.id);
      let next = order[(idx + 1) % order.length];
      for (let i = 1; i <= order.length; i++) {
        const c = order[(idx + i) % order.length];
        if (c.finished_at) continue;
        next = c;
        break;
      }
      await supabase
        .from("rooms")
        .update({ trap: null, locked: false, current_turn_player_id: next?.id ?? null })
        .eq("code", code);
      setTimeout(() => setTimeoutBoom(null), 1800);
    }, remaining);
    return () => {
      if (explosionTimerRef.current) {
        clearTimeout(explosionTimerRef.current);
        explosionTimerRef.current = null;
      }
    };
  }, [trap, room, players, isPaused, code]);

  const resumeGame = async () => {
    void sfx.unlock();
    setPaused(false);
    const pausedFor = pauseStartedAtRef.current ? Date.now() - pauseStartedAtRef.current : 0;
    pauseStartedAtRef.current = null;
    const pausedTrap = room?.trap as Trap | null;
    await supabase.from("rooms").update({
      paused: false,
      ...(pausedTrap ? { trap: { ...pausedTrap, started_at: pausedTrap.started_at + pausedFor } } : {}),
    }).eq("code", code);
  };

  const restartGame = async () => {
    if (!room || players.length === 0 || restarting) return;
    setRestarting(true);
    setStartError(null);
    void sfx.unlock();
    // Restart must always exit pause and re-enter full play mode, even if the
    // host hit RESTART from the paused screen.
    setPaused(false);
    sfx.play("gameStart");
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
      const { error: resetRoomError } = await supabase
        .from("rooms")
        .update({
          status: "restarting",
          locked: true,
          trap: null,
          last_dice: null,
          current_turn_player_id: null,
        })
        .eq("code", code);

      const [{ error: playersError }, { error: logsError }] = await Promise.all([
        supabase
        .from("players")
        .update({ current_space: 0, finished_at: null, finish_rank: null, score: 0, status: "active" })
        .eq("room_code", code),
        supabase.from("workout_logs").delete().eq("room_code", code),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const { error: roomError } = await supabase
        .from("rooms")
        .update({
          status: "playing",
          locked: false,
          trap: null,
          last_dice: null,
          current_turn_player_id: first?.id ?? null,
          paused: false,
        })
        .eq("code", code);

      if (first) {
        setTurnAnnounce({ username: first.username, avatar: first.avatar_url, key: Date.now() });
        setTimeout(() => setTurnAnnounce(null), 2500);
      }

      if (resetRoomError || playersError || logsError || roomError) {
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
    setPaused(false);
    setExploding(true);
    void sfx.unlock();
    sfx.play("blast");
    setTimeout(() => setExploding(false), 1800);
    const { error } = await supabase
      .from("rooms")
      .update({
        status: "playing",
        locked: false,
        trap: null,
        last_dice: null,
        current_turn_player_id: first.id,
        paused: false,
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
    if (!room || !trap || isPaused) return;
    sfx.play("defuse");
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
    await recalcPlayerScore(triggerPlayer.id, code);
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
    if (!trap || isPaused) return;
    sfx.play("blowUp");
    // Reset awaiting_verification — player must redo
    await supabase
      .from("rooms")
      .update({
        trap: { ...trap, awaiting_verification: false },
      })
      .eq("code", code);
  };

  return (
    <>
      <OrientationLock />
      <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
        <div
          className="relative bg-white shadow-2xl"
          style={{
            width: "min(100vw, calc(100vh * 16 / 9))",
            height: "min(100vh, calc(100vw * 9 / 16))",
          }}
        >
          <div
            onPointerDownCapture={() => { if (!sfx.isMuted()) void sfx.unlock(); }}
            className={`flex flex-col gap-4 relative w-full h-full ${inPlayMode ? "overflow-hidden p-2" : "overflow-y-auto p-6"}`}
          >
      <h1 className="sr-only">BOOM! Gym Screen — Room {code}</h1>
      {!inPlayMode && (
        <div className="absolute top-2 right-2 z-40 flex items-center gap-2">
          <SfxButton variant="white" />
          <button
            onClick={() => setShowCustomize(true)}
            className="ink-border-sm rounded-xl px-3 py-2 bg-white font-black text-sm flex items-center gap-1"
            title="Customize exercises and reps"
          >
            <Settings size={16} /> CUSTOMIZE
          </button>
        </div>
      )}
      {inPlayMode ? (
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={bombMascot} alt="" width={1024} height={1024} className="w-8 h-8" />
            <div
              style={{ fontFamily: "'Luckiest Guy', cursive" }}
              className="text-2xl text-[var(--boom-red)] comic-shadow leading-none"
            >
              BOOM!
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SfxButton />
            {!isPaused && (
              <button
                onClick={() => { void sfx.unlock(); setPaused(true); void supabase.from("rooms").update({ paused: true }).eq("code", code); }}
                className="btn-boom flex items-center gap-2 py-2 px-4 text-base"
                style={{ fontFamily: "'Luckiest Guy', cursive" }}
              >
                <Pause size={18} fill="currentColor" /> PAUSE
              </button>
            )}
          </div>
        </header>
      ) : (
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 pt-1">
          <img src={bombMascot} alt="" width={1024} height={1024} className="w-10 h-10" />
          <div>
            <div
              style={{ fontFamily: "'Luckiest Guy', cursive" }}
              className="text-3xl text-[var(--boom-red)] comic-shadow leading-none"
            >
              BOOM!
            </div>
            <div className="text-xs font-bold">Gym Screen</div>
          </div>
          {!gameHasStarted && (
            <button
              onClick={startGame}
              disabled={players.length === 0 || starting}
              className="btn-boom disabled:opacity-50 disabled:cursor-not-allowed py-2 px-4 text-base"
              style={{ fontFamily: "'Luckiest Guy', cursive" }}
            >
              {starting ? "IGNITING…" : "START GAME"}
            </button>
          )}
          {gameHasStarted && isPaused && (
            <>
              <button
                onClick={resumeGame}
                className="btn-boom flex items-center gap-2 py-2 px-4 text-base"
                style={{ fontFamily: "'Luckiest Guy', cursive" }}
              >
                <Play size={20} fill="currentColor" /> PLAY
              </button>
              <button
                onClick={restartGame}
                disabled={restarting}
                className="btn-boom disabled:opacity-50 py-2 px-4 text-base"
                style={{ fontFamily: "'Luckiest Guy', cursive", background: "var(--boom-red)" }}
              >
                {restarting ? "BOOMING…" : "RESTART"}
              </button>
            </>
          )}
        </div>
        {/* Combined Invite + QR card — shown next to the action buttons in the lobby */}
        {!inPlayMode && (
        <div className="ink-border rounded-2xl bg-white p-2 flex items-center gap-3 ml-auto">
          <div className="flex flex-col items-start gap-1 max-w-[180px]">
            <div
              className="text-base font-black leading-none"
              style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
            >
              INVITE YOUR CREW
            </div>
            <div className="text-[10px] font-bold opacity-70 break-all leading-tight">{joinUrl}</div>
            <ShareLinkButton url={joinUrl} code={code} />
            <div className="text-[9px] font-bold leading-none mt-1">
              CODE:{" "}
              <span style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}>
                {code}
              </span>
            </div>
          </div>
          <button
            onClick={() => setQrZoom(true)}
            className="bg-white"
            title="Tap to enlarge QR"
            aria-label="Enlarge QR code to join this room"
          >
            <QRCodeSVG value={joinUrl} size={84} level="M" />
          </button>
        </div>
        )}
      </header>
      )}
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
      {inPlayMode && (
      <img
        src={bombMascot}
        alt="Boom mascot"
        width={1024}
        height={1024}
        loading="lazy"
        className="fixed bottom-0 right-0 translate-y-10 translate-x-10 w-40 md:w-56 opacity-95 pointer-events-none anim-fuse z-30"
      />
      )}
      {inPlayMode && (
      <div ref={boardWrapRef} className="ink-border rounded-3xl bg-white flex-1 relative overflow-hidden">
      <div
        ref={boardInnerRef}
        className="relative p-4 w-full h-full"
        style={{
          transform: boardTransform,
          transformOrigin: "top left",
          // Smooth, eased zoom-in / zoom-out; tight linear pan between hops
          // so the camera tracks the token without drifting.
          transition:
            cameraPhase === "pan"
              ? `transform ${HOP_MS}ms linear`
              : `transform 650ms cubic-bezier(0.22, 1, 0.36, 1)`,
          willChange: "transform",
        }}
      >
        {/* Snake board: 10-cell horizontal rows joined by single-cell vertical connectors */}
        <div className="flex flex-col gap-1.5 pt-6">
          {(() => {
            const COLS = 15;
            const LAP = 16; // 15 horizontal + 1 connector
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
                    cell.type === "boost" ? "var(--boom-green)" :
                    cell.type === "surprise" ? "#ec4899" :
                    cell.type === "crazy" ? "#22d3ee" :
                    cell.type === "group" ? "var(--boom-blue)" :
                    "#7c3aed";
                  const isLight = cell.type === "start" || cell.type === "finish";
                  const numColor = isLight ? "var(--boom-ink)" : "white";
                  return (
                    <div
                      key={space}
                      data-space={space}
                      onClick={() => { if (!isPaused) sfx.play("gymSelect"); }}
                      className="@container aspect-square rounded-xl ink-border-sm flex flex-col items-center justify-center relative p-1 text-center cursor-pointer select-none"
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
                      <span
                        className="font-black leading-none"
                        style={{ color: numColor, fontSize: "clamp(0.7rem, 22cqw, 1.75rem)" }}
                      >
                        {space}
                      </span>
                      {cell.type === "easy" && <MiniDumbbell className="w-[60%] h-[60%] text-white" />}
                      {cell.type === "medium" && <Dumbbell className="w-[60%] h-[60%] text-white" />}
                      {cell.type === "hard" && <Flame className="w-[60%] h-[60%] text-white" />}
                      {cell.type === "boost" && <Zap className="w-[60%] h-[60%] text-white" />}
                      {cell.type === "setback" && <ArrowLeft className="w-[60%] h-[60%] text-white" />}
                      {cell.type === "surprise" && <HelpCircle className="w-[60%] h-[60%] text-white" />}
                      {cell.type === "crazy" && <AlertTriangle className="w-[60%] h-[60%] text-white" />}
                      {cell.type === "group" && <Users className="w-[60%] h-[60%] text-white" />}
                      {cell.type === "start" && <Flag className="w-[60%] h-[60%]" />}
                      {cell.type === "finish" && <Trophy className="w-[60%] h-[60%]" />}
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
                                  size={64}
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
            { c: "#ec4899", l: "Surprise" },
            { c: "#22d3ee", l: "Crazy" },
            { c: "var(--boom-blue)", l: "All Together" },
            { c: "var(--boom-green)", l: "Blast +" },
            { c: "#7c3aed", l: "Setback −" },
          ].map((x) => (
            <span key={x.l} className="ink-border-sm rounded-full px-2 py-1 flex items-center gap-1" style={{ background: x.c, color: "white" }}>
              {x.l}
            </span>
          ))}
        </div>
      </div>
      </div>
      )}

      {/* Spotify lives only in lobby mode. Keep the iframe mounted (offscreen)
          while playing so audio keeps playing without restarting. */}
      <div
        className={inPlayMode ? "fixed -left-[9999px] top-0 w-px h-px overflow-hidden pointer-events-none opacity-0" : ""}
        aria-hidden={inPlayMode}
      >
        <SpotifyEmbed code={code} />
      </div>

      {/* Tutorial — shown in lobby AND while paused. Invite lives in the header. */}
      {!inPlayMode && <TutorialCarousel compact />}

      {/* Live leaderboard — visible to everyone in the room */}
      {!inPlayMode && (
      <div className="ink-border rounded-2xl bg-white p-3">
        <h2 className="text-lg font-black mb-2 flex items-center gap-2"><Trophy size={20} /> LIVE LEADERBOARD</h2>
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
      )}

      {/* Players strip */}
      {!inPlayMode && (
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
      )}

      {/* BOOM modal */}
      {trap && !isPaused && (
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
              src={mascotForCell(getCell((trap.space ?? players.find((p) => p.id === trap.triggered_by)?.current_space) ?? 0).type)}
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
              const trapCellType = getCell((trap.space ?? players.find((p) => p.id === trap.triggered_by)?.current_space) ?? 0).type;
              const cellColor =
                trapCellType === "easy" ? "var(--boom-yellow)" :
                trapCellType === "medium" ? "var(--boom-orange)" :
                trapCellType === "hard" ? "var(--boom-red)" :
                trapCellType === "boost" ? "var(--boom-green)" :
                trapCellType === "setback" ? "#7c3aed" :
                trapCellType === "surprise" ? "#ec4899" :
                trapCellType === "crazy" ? "#22d3ee" :
                trapCellType === "group" ? "var(--boom-blue)" :
                "var(--boom-yellow)";
              const effectiveStart = trap.started_at;
              const remaining = effectiveStart - Date.now();
              const inCountdown = remaining > 0 && remaining <= 3500;
              const ready = remaining <= 3500;
              return (
                <div className="mt-4 flex justify-center">
                  <div
                    className={`ink-border rounded-2xl px-6 py-3 ${inCountdown ? "anim-border-flash" : ""}`}
                    style={{
                      background: "white",
                      color: "var(--boom-ink)",
                      borderWidth: 8,
                      borderColor: cellColor,
                      transform: "rotate(-3deg)",
                      minWidth: "14rem",
                    }}
                  >
                    {!ready ? (
                      <div className="text-2xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
                        GET READY…
                      </div>
                    ) : (
                      <>
                        <CountdownIntro startAt={effectiveStart} inline />
                        <FuseTimer
                          startedAt={effectiveStart}
                          big
                          color="var(--boom-ink)"
                          hideBeforeStart
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
            <button
              onClick={() => { if (!isPaused) { void sfx.unlock(); setPaused(true); void supabase.from("rooms").update({ paused: true }).eq("code", code); } }}
              disabled={isPaused}
              className="mt-4 ink-border-sm rounded-xl px-4 py-2 font-black text-sm flex items-center gap-2 mx-auto"
              style={{ background: "var(--boom-ink)", color: "white", fontFamily: "'Luckiest Guy', cursive" }}
            >
              <Pause size={16} fill="currentColor" /> PAUSE
            </button>
            {!isPaused && Date.now() >= trap.started_at && players.length <= 1 && (
              <div className="mt-6">
                <h2 className="text-xl font-black mb-3" style={{ color: "var(--boom-ink)" }}>
                  TEAM VERIFICATION
                </h2>
                <div className="flex gap-4 justify-center flex-wrap">
                  <button
                    onClick={defuse}
                    className="ink-border rounded-2xl px-8 py-6 text-3xl font-black comic-shadow"
                    style={{ background: "var(--boom-green)", color: "white" }}
                  >
                    DEFUSED
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Turn announcement overlay */}
      {turnAnnounce && !trap && !isPaused && (
        <div
          key={turnAnnounce.key}
          className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-black/70 pointer-events-none"
        >
          <div className="anim-mascot-pop">
            <PlayerToken
              avatar={turnAnnounce.avatar}
              username={turnAnnounce.username}
              size={220}
              active
              showName={false}
              showInitial
            />
          </div>
          <div
            className="mt-8 text-7xl md:text-8xl font-black comic-shadow anim-shake text-center px-6"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              color: "var(--boom-yellow)",
              textShadow: "5px 5px 0 #000, -2px -2px 0 #000",
            }}
          >
            {turnAnnounce.username.toUpperCase()} ROLLS!
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
      {isPaused && gameHasStarted && (
        <div
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[120] ink-border rounded-2xl bg-[var(--boom-red)] text-white px-4 py-2 flex items-center gap-2 pointer-events-none comic-shadow"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          <Pause size={20} fill="currentColor" /> GAME PAUSED
        </div>
      )}
      {landed && (
        <CellMascot key={landed.key} type={landed.type} username={landed.username} />
      )}
      {timeoutBoom && <ExplosionOverlay username={timeoutBoom} />}
      {/* Start-of-game explosion overlay */}
      {exploding && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none overflow-hidden bg-black/40">
          <img
            src={bombMascot}
            alt=""
            width={1024}
            height={1024}
            className="absolute anim-mascot-explode"
            style={{ width: "90vmin", height: "90vmin" }}
          />
          <div
            className="relative comic-shadow anim-shake"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              fontSize: "clamp(6rem, 22vw, 16rem)",
              color: "var(--boom-yellow)",
              textShadow: "6px 6px 0 #000, -3px -3px 0 #000",
              lineHeight: 1,
            }}
          >
            BOOM!
          </div>
        </div>
      )}
      {/* countdown rendered inline inside the timer box */}
    </div>
        </div>
      </div>
    </>
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
  const [presetId, setPresetId] = useState<string>("default");
  const exerciseCells = BOARD.filter(
    (c) => c.type === "easy" || c.type === "medium" || c.type === "hard",
  );

  const update = (
    space: number,
    patch: { exercise?: string; reps?: number; min_reps?: number; max_reps?: number; unit?: "reps" | "seconds" },
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
      const unit: "reps" | "seconds" | undefined = v.unit === "seconds" ? "seconds" : undefined;
      // If a fixed reps value is provided, drop the range — fixed wins.
      if (reps) { min = undefined; max = undefined; }
      // Normalise so min <= max when both are set.
      if (min !== undefined && max !== undefined && min > max) {
        const t = min; min = max; max = t;
      }
      if (exercise || reps || min || max || unit) {
        clean[k] = {
          ...(exercise ? { exercise } : {}),
          ...(reps ? { reps } : {}),
          ...(min ? { min_reps: min } : {}),
          ...(max ? { max_reps: max } : {}),
          ...(unit ? { unit } : {}),
        };
      }
    }
    await supabase.from("rooms").update({ board_overrides: clean }).eq("code", code);
    setSaving(false);
    onClose();
  };

  const resetAll = () => setDraft({});

  // Auto-apply + auto-save when a preset is picked: every exercise on the
  // board updates instantly to match the chosen discipline.
  const onPresetChange = async (id: string) => {
    setPresetId(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    const next = applyPreset(p);
    setDraft(next);
    setSaving(true);
    await supabase.from("rooms").update({ board_overrides: next }).eq("code", code);
    setSaving(false);
  };

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
        <div className="flex flex-wrap items-center gap-2 mb-3 ink-border-sm rounded-xl p-2 bg-[var(--boom-cream)]">
          <span className="text-xs font-black opacity-70">PRESET:</span>
          <select
            value={presetId}
            onChange={(e) => { void onPresetChange(e.target.value); }}
            className="ink-border-sm rounded-lg px-2 py-1 text-sm font-bold bg-white text-black"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className="text-[11px] font-bold opacity-70 flex-1 min-w-[180px]">
            {PRESETS.find((p) => p.id === presetId)?.description}
          </span>
          <span className="text-[11px] font-black" style={{ color: saving ? "var(--boom-red)" : "var(--boom-green)" }}>
            {saving ? "SAVING…" : "AUTO-SAVED"}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid gap-2">
            {exerciseCells.map((c) => {
              const o = draft[String(c.space)] ?? {};
              const tierBg =
                c.type === "easy" ? "var(--boom-yellow)" :
                c.type === "medium" ? "var(--boom-orange)" : "var(--boom-red)";
              const unit: "reps" | "seconds" = (o.unit === "seconds" ? "seconds" : "reps");
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
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-black opacity-60">UNIT</span>
                    <button
                      type="button"
                      onClick={() => update(c.space, { unit: unit === "reps" ? "seconds" : "reps" })}
                      className="ink-border-sm rounded-lg px-2 py-1 text-xs font-black"
                      style={{ background: unit === "seconds" ? "var(--boom-blue)" : "white", color: unit === "seconds" ? "white" : "black" }}
                    >
                      {unit === "seconds" ? "SEC" : "REPS"}
                    </button>
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
