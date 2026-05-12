import { Flame } from "lucide-react";

// Colors chosen to NOT clash with cell backgrounds
// (cell bg uses yellow/orange/red/blue/green/purple).
const PLAYER_COLORS = [
  "#ec4899", // hot pink
  "#d946ef", // fuchsia
  "#a3e635", // lime
  "#22d3ee", // cyan
  "#ffffff", // white
  "#111111", // black
  "#92400e", // brown
  "#f472b6", // light pink
];

export function playerColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
}

export function PlayerToken({
  avatar,
  username,
  size = 56,
  active = false,
  showName = true,
  showInitial = false,
  ringColor,
  className = "",
}: {
  avatar?: string | null;
  username: string;
  size?: number;
  active?: boolean;
  showName?: boolean;
  showInitial?: boolean;
  ringColor?: string;
  className?: string;
}) {
  const color = ringColor ?? playerColor(username);
  const ring = Math.max(2, Math.round(size * 0.12));
  const initial = username.slice(0, 1).toUpperCase();
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* fuse */}
        <div
          className={`absolute -top-3 left-1/2 -translate-x-1/2 z-10 ${active ? "anim-fuse" : ""}`}
          style={{ color: "var(--boom-orange)" }}
        >
          <Flame size={Math.round(size * 0.45)} fill="currentColor" />
        </div>
        <div
          className="rounded-full overflow-hidden bg-white"
          style={{
            width: size,
            height: size,
            borderRadius: "9999px",
            boxShadow: `0 0 0 ${ring}px ${color}, 0 0 0 ${ring + 2}px #111`,
          }}
        >
          {avatar ? (
            <img src={avatar} alt={username} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: color, color: "white", fontSize: Math.round(size * 0.5), fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              {initial}
            </div>
          )}
        </div>
        {showInitial && avatar && (
          <span
            className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center"
            style={{
              background: color,
              color: "white",
              width: Math.round(size * 0.55),
              height: Math.round(size * 0.55),
              fontSize: Math.round(size * 0.32),
              fontWeight: 600,
              fontFamily: "system-ui, -apple-system, sans-serif",
              boxShadow: "0 0 0 2px #111",
              lineHeight: 1,
            }}
          >
            {initial}
          </span>
        )}
      </div>
      {showName && (
        <span className="text-xs font-bold truncate max-w-[80px]" style={{ color: "var(--boom-ink)" }}>
          {username}
        </span>
      )}
    </div>
  );
}
