/**
 * Big 3-2-1 / GO! countdown card.
 *
 * Renders a fixed-size square card with exactly ONE keyed child so a new tick
 * can never paint on top of the previous number (the old overlap bug). The
 * inner span is absolutely centred and clipped to the card.
 */
export function CountdownNumber({
  value,
  goLabel = "GO!",
  size = "clamp(7rem, 34vw, 11rem)",
  color,
  className = "",
}: {
  value: number;
  goLabel?: string;
  size?: string;
  color?: string;
  className?: string;
}) {
  const done = value <= 0;
  const tone = color ?? (done ? "var(--boom-green)" : "var(--boom-red)");
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-3xl bg-white flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        border: `5px solid ${tone}`,
        boxShadow: `6px 6px 0 #111, 0 0 30px 6px color-mix(in oklab, ${tone} 45%, transparent)`,
      }}
    >
      <span
        key={done ? "go" : `n-${value}`}
        className="anim-count-tick absolute inset-0 flex items-center justify-center text-center tabular-nums"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          color: tone,
          fontSize: done ? "2.6rem" : "5.5rem",
          lineHeight: 1,
          letterSpacing: 0,
        }}
      >
        {done ? goLabel : value}
      </span>
    </div>
  );
}
