import { Pause, Play, UserPlus, Bomb } from "lucide-react";
import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Player, Pod } from "@/hooks/use-room";

/**
 * Fullscreen "PAUSED" overlay shown to every connected client (host TV +
 * every pod phone) whenever `rooms.paused` is true. Blocks all gameplay
 * interaction underneath. Only the host can resume from the gym screen,
 * but pod players can also tap RESUME so a paused phone isn't a dead end.
 */
export function PauseOverlay({
  onResume,
  onSignInClick,
  label = "PAUSED",
  code,
  players,
  pods,
}: {
  onResume?: () => void;
  onSignInClick?: () => void;
  label?: string;
  code?: string;
  players?: Player[];
  pods?: Pod[];
}) {
  const joinUrl = useMemo(() => {
    if (!code || typeof window === "undefined") return "";
    return `${window.location.origin}/join/${code}`;
  }, [code]);
  const podColors = ["var(--boom-yellow)", "var(--boom-orange)", "var(--boom-green)"];
  const podsBySlot = useMemo(() => {
    const m = new Map<number, Pod>();
    (pods ?? []).forEach((p) => m.set(p.slot, p));
    return m;
  }, [pods]);
  const playersByPod = useMemo(() => {
    const m = new Map<string, Player[]>();
    (players ?? []).forEach((p) => {
      if (!p.pod_id) return;
      const arr = m.get(p.pod_id) ?? [];
      arr.push(p);
      m.set(p.pod_id, arr);
    });
    return m;
  }, [players]);
  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center bg-black/90 anim-fade-in overflow-y-auto p-4 gap-4">
      <div className="anim-mascot-bounce mt-4">
        <Pause size={80} fill="#fff" color="#fff" />
      </div>
      <div
        className="text-white text-5xl font-black text-center px-6"
        style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "4px 4px 0 #111" }}
      >
        {label}
      </div>
      {onResume && (
        <button
          onClick={onResume}
          className="ink-border rounded-2xl bg-[var(--boom-green)] text-white px-6 py-3 text-2xl font-black flex items-center gap-2 active:scale-95"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          <Play size={28} fill="#fff" /> RESUME
        </button>
      )}
      {code && (
        <div className="ink-border rounded-2xl bg-white p-3 w-full max-w-md flex flex-col gap-2">
          <div className="text-xs font-black opacity-70 uppercase tracking-wider flex items-center gap-1">
            <UserPlus size={14} /> Join while paused
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg ink-border-sm shrink-0">
              <QRCodeSVG value={joinUrl} size={88} bgColor="#ffffff" fgColor="#111111" level="M" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs opacity-60 uppercase">Room</div>
              <div
                className="text-3xl font-black leading-none"
                style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-ink)" }}
              >
                {code}
              </div>
              <div className="text-[10px] opacity-70 mt-1 truncate">
                {joinUrl.replace(/^https?:\/\//, "")}
              </div>
            </div>
          </div>
        </div>
      )}
      {code && pods && (
        <div className="grid grid-cols-3 gap-2 w-full max-w-md">
          {[1, 2, 3].map((slot) => {
            const pod = podsBySlot.get(slot);
            const podPlayers = pod ? playersByPod.get(pod.id) ?? [] : [];
            const color = podColors[slot - 1];
            return (
              <div
                key={slot}
                className="ink-border-sm rounded-xl p-2 bg-white flex flex-col gap-1 min-h-[100px]"
              >
                <div
                  className="rounded-lg px-2 py-1 text-center font-black text-sm"
                  style={{
                    background: color,
                    fontFamily: "'Luckiest Guy', cursive",
                    color: "var(--boom-ink)",
                  }}
                >
                  {pod ? pod.name : `POD ${slot}`}
                </div>
                {!pod || podPlayers.length === 0 ? (
                  <div className="text-[10px] opacity-60 text-center my-auto">
                    Tap join from your phone
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {podPlayers.map((p) => (
                      <li key={p.id} className="flex items-center gap-1 text-[11px] font-bold">
                        <span
                          className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0"
                          style={{
                            background: p.avatar_url?.startsWith("mascot:")
                              ? p.avatar_url.slice(7)
                              : "#ec4899",
                            boxShadow: "0 0 0 1px #111",
                          }}
                        >
                          {p.avatar_url?.startsWith("mascot:") ? (
                            <Bomb size={8} color="white" fill="white" />
                          ) : p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : null}
                        </span>
                        <span className="truncate">{p.username}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
      {code && (
        <a
          href={`/gym/${code}/customize`}
          target="_blank"
          rel="noopener noreferrer"
          className="ink-border-sm rounded-xl bg-white px-4 py-2 text-sm font-black flex items-center gap-2 active:scale-95"
        >
          CUSTOMISE
        </a>
      )}
      <p className="text-white/70 font-bold text-xs">Music + timer on hold</p>
    </div>
  );
}

export function PauseToggleButton({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={paused ? "Resume" : "Pause"}
      className="ink-border-sm rounded-full bg-white w-10 h-10 flex items-center justify-center active:scale-90"
    >
      {paused ? <Play size={18} fill="#111" /> : <Pause size={18} fill="#111" />}
    </button>
  );
}