import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import { generateRoomCode } from "@/lib/game";
import { Bomb, Copy, Play } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";

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

  return <Lobby code={code} />;
}

const POD_COLORS = ["var(--boom-yellow)", "var(--boom-orange)", "var(--boom-green)"];

function Lobby({ code }: { code: string }) {
  const { room, players, pods, loading } = useRoom(code);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

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

  const start = async () => {
    if (!canStart) return;
    setStarting(true);
    await supabase
      .from("rooms")
      .update({ status: "playing", trap: null, locked: false })
      .eq("code", code);
    await supabase.from("pods").update({ status: "playing" }).eq("room_code", code);
    setStarting(false);
  };

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center text-2xl">Loading gym…</div>
    );
  }

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto flex flex-col gap-4">
      <header className="flex items-center gap-3 mt-2">
        <img src={bombMascot} alt="" className="w-12 h-12 anim-fuse" />
        <div>
          <h1
            className="text-3xl font-black leading-none"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
          >
            THE GYM
          </h1>
          <p className="text-xs font-bold opacity-70">
            Up to 3 pods · 2–4 players each
          </p>
        </div>
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
            Each pod scans the QR or opens{" "}
            <span className="font-black">{`${joinUrl.replace(/^https?:\/\//, "")}`}</span>
          </p>
          <button
            type="button"
            onClick={copy}
            className="ink-border-sm rounded-xl px-3 py-2 text-sm font-black bg-white flex items-center gap-2 self-start"
          >
            <Copy size={14} /> {copied ? "Copied!" : "Copy join link"}
          </button>
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
                      className="flex items-center gap-2 text-sm font-bold"
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
                      <span className="truncate">{p.username}</span>
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

      <SpotifyEmbed code={code} />

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
      {!canStart && pods.length === 0 && (
        <p className="text-xs text-center opacity-70">
          Waiting for at least one pod with 2+ players to join…
        </p>
      )}
      {!canStart && pods.length > 0 && (
        <p className="text-xs text-center opacity-70">
          Every pod needs at least 2 players to start.
        </p>
      )}
    </main>
  );
}