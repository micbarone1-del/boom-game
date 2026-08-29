/**
 * Quirky bomb characters. Each mascot colour maps to a personality with its
 * own face and idle animation so the avatars feel alive on every screen.
 * Pure SVG + CSS — no assets, scales to any size.
 */

export type BombPersona = "sassy" | "angry" | "cool" | "goofy" | "sleepy" | "wild";

function hueOf(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2) || "ee", 16) / 255;
  const g = parseInt(h.slice(2, 4) || "44", 16) / 255;
  const b = parseInt(h.slice(4, 6) || "99", 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return ((hue * 60) + 360) % 360;
}

export function personaFor(color: string): BombPersona {
  const hue = hueOf(color);
  if (hue >= 300 || hue < 15) return "sassy"; // pink / magenta → quirky female
  if (hue < 40) return "angry"; // red / deep orange → aggressive
  if (hue < 70) return "goofy"; // amber / yellow → goofy
  if (hue < 160) return "wild"; // lime / green → wild
  if (hue < 250) return "cool"; // cyan / blue → laid back
  return "sleepy"; // violet
}

const IDLE: Record<BombPersona, string> = {
  sassy: "anim-bomb-sway",
  angry: "anim-bomb-fume",
  cool: "anim-bomb-breathe",
  goofy: "anim-bomb-bob",
  sleepy: "anim-bomb-breathe-slow",
  wild: "anim-bomb-jitter",
};

export function BombAvatar({
  color,
  size = 56,
  persona,
  animated = true,
  className = "",
}: {
  color: string;
  size?: number;
  persona?: BombPersona;
  animated?: boolean;
  className?: string;
}) {
  const p = persona ?? personaFor(color);
  return (
    <div
      className={`relative ${animated ? IDLE[p] : ""} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="-8 -14 116 122" width={size} height={size} style={{ display: "block", overflow: "visible" }}>
        {/* body */}
        <circle cx="50" cy="56" r="38" fill={color} stroke="#111" strokeWidth="5" />
        {/* shine */}
        <ellipse cx="36" cy="40" rx="10" ry="7" fill="#fff" opacity="0.45" transform="rotate(-25 36 40)" />
        {/* cap */}
        <rect x="38" y="12" width="24" height="12" rx="4" fill="#333" stroke="#111" strokeWidth="4" />
        {/* fuse */}
        <path d="M50 14 C 56 2, 70 6, 68 -2" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />
        <g className={animated ? "anim-bomb-spark" : ""} style={{ transformOrigin: "68px 0px" }}>
          <circle cx="68" cy="0" r="7" fill="var(--boom-yellow)" stroke="#111" strokeWidth="3" />
        </g>

        {/* faces */}
        {p === "sassy" && (
          <>
            <path d="M22 34 q10 -14 22 -6" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
            <circle cx="38" cy="52" r="6" fill="#111" />
            <circle cx="64" cy="52" r="6" fill="#111" />
            <circle cx="40" cy="50" r="2" fill="#fff" />
            <circle cx="66" cy="50" r="2" fill="#fff" />
            <path d="M40 70 q10 10 20 0" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
            <circle cx="28" cy="66" r="5" fill="#fff" opacity="0.6" />
            <circle cx="72" cy="66" r="5" fill="#fff" opacity="0.6" />
          </>
        )}
        {p === "angry" && (
          <>
            <path d="M30 42 l16 8" stroke="#111" strokeWidth="6" strokeLinecap="round" />
            <path d="M70 42 l-16 8" stroke="#111" strokeWidth="6" strokeLinecap="round" />
            <circle cx="39" cy="57" r="5" fill="#111" />
            <circle cx="61" cy="57" r="5" fill="#111" />
            <path d="M38 76 q12 -10 24 0" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
          </>
        )}
        {p === "cool" && (
          <>
            <rect x="26" y="48" width="48" height="14" rx="5" fill="#111" />
            <rect x="30" y="51" width="16" height="6" rx="2" fill="#fff" opacity="0.35" />
            <path d="M40 74 q12 8 22 -2" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
          </>
        )}
        {p === "goofy" && (
          <>
            <circle cx="38" cy="52" r="8" fill="#fff" stroke="#111" strokeWidth="3" />
            <circle cx="63" cy="54" r="6" fill="#fff" stroke="#111" strokeWidth="3" />
            <circle cx="40" cy="53" r="3" fill="#111" />
            <circle cx="64" cy="55" r="2.5" fill="#111" />
            <path d="M38 72 q12 12 24 -2" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M52 74 q6 8 10 0" fill="#ff5a7a" stroke="#111" strokeWidth="3" />
          </>
        )}
        {p === "wild" && (
          <>
            <circle cx="38" cy="52" r="7" fill="#fff" stroke="#111" strokeWidth="3" />
            <circle cx="63" cy="52" r="7" fill="#fff" stroke="#111" strokeWidth="3" />
            <circle cx="38" cy="52" r="3" fill="#111" />
            <circle cx="63" cy="52" r="3" fill="#111" />
            <path d="M34 70 h32 l-6 8 h-20 z" fill="#111" />
          </>
        )}
        {p === "sleepy" && (
          <>
            <path d="M32 52 q6 6 12 0" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M56 52 q6 6 12 0" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
            <ellipse cx="50" cy="74" rx="7" ry="5" fill="#111" />
          </>
        )}
      </svg>
    </div>
  );
}
