import { Flame } from "lucide-react";

export function PlayerToken({
  avatar,
  username,
  size = 56,
  active = false,
  showName = true,
  className = "",
}: {
  avatar?: string | null;
  username: string;
  size?: number;
  active?: boolean;
  showName?: boolean;
  className?: string;
}) {
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
          className="rounded-full overflow-hidden ink-border-sm bg-white"
          style={{ width: size, height: size, borderRadius: "9999px" }}
        >
          {avatar ? (
            <img src={avatar} alt={username} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-2xl font-black"
              style={{ background: "var(--boom-yellow)", color: "var(--boom-ink)" }}
            >
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>
      {showName && (
        <span className="text-xs font-bold truncate max-w-[80px]" style={{ color: "var(--boom-ink)" }}>
          {username}
        </span>
      )}
    </div>
  );
}
