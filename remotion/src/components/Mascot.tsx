import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { DISPLAY, useSpr } from "./kit";

/** Bomb mascot that pops in, bobs and (optionally) carries a label chip. */
export const Mascot: React.FC<{
  src: string;
  size: number;
  label?: string;
  labelColor?: string;
  delay?: number;
  style?: React.CSSProperties;
  bob?: number;
  spin?: number;
  out?: number;
}> = ({ src, size, label, labelColor = C.yellow, delay = 0, style, bob = 12, spin = 4, out }) => {
  const frame = useCurrentFrame();
  const pop = useSpr(delay, { damping: 9, stiffness: 190 });
  const gone = out !== undefined ? interpolate(frame, [out, out + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  if (pop <= 0.001 || gone <= 0.01) return null;
  const t = frame - delay;
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        opacity: gone,
        transform: `translateY(${Math.sin(t / 11) * bob}px) rotate(${Math.sin(t / 15) * spin}deg) scale(${interpolate(pop, [0, 1], [0.2, 1])})`,
        ...style,
      }}
    >
      <Img
        src={staticFile(`mascots/${src}`)}
        style={{ width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 14px 18px rgba(18,16,14,0.35))" }}
      />
      {label ? (
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: Math.max(20, size * 0.15),
            color: C.ink,
            background: labelColor,
            padding: "6px 16px 2px",
            border: `5px solid ${C.ink}`,
            borderRadius: 999,
            boxShadow: `6px 6px 0 ${C.ink}`,
            whiteSpace: "nowrap",
            marginTop: -size * 0.08,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
