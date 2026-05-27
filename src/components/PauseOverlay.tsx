import { Pause, Play } from "lucide-react";

/**
 * Fullscreen "PAUSED" overlay shown to every connected client (host TV +
 * every pod phone) whenever `rooms.paused` is true. Blocks all gameplay
 * interaction underneath. Only the host can resume from the gym screen,
 * but pod players can also tap RESUME so a paused phone isn't a dead end.
 */
export function PauseOverlay({
  onResume,
  label = "PAUSED",
}: {
  onResume?: () => void;
  label?: string;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-6 bg-black/85 anim-fade-in">
      <div className="anim-mascot-bounce">
        <Pause size={140} fill="#fff" color="#fff" />
      </div>
      <div
        className="text-white text-7xl font-black text-center px-6"
        style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "4px 4px 0 #111" }}
      >
        {label}
      </div>
      <p className="text-white/80 font-bold text-sm">Music + timer on hold.</p>
      {onResume && (
        <button
          onClick={onResume}
          className="ink-border rounded-2xl bg-[var(--boom-green)] text-white px-6 py-3 text-2xl font-black flex items-center gap-2 active:scale-95"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          <Play size={28} fill="#fff" /> RESUME
        </button>
      )}
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