import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { BODY, Ink, useSpr } from "./kit";

/**
 * Real gym footage (face-free crops) played back as a JPEG frame sequence,
 * framed like a taped-on polaroid.
 */
export const RealClip: React.FC<{
  name: string;
  total: number;
  width: number;
  height: number;
  rotate?: number;
  delay?: number;
  label?: string;
  labelColor?: string;
  style?: React.CSSProperties;
}> = ({ name, total, width, height, rotate = -3, delay = 0, label, labelColor = C.yellow, style }) => {
  const frame = useCurrentFrame();
  const p = useSpr(delay, { damping: 16, stiffness: 120 });
  if (p <= 0.001) return null;
  const i = (Math.max(0, frame - delay) % total) + 1;
  const float = Math.sin(frame / 24) * 6;
  return (
    <div
      style={{
        position: "absolute",
        transform: `translateY(${interpolate(p, [0, 1], [420, float])}px) scale(${interpolate(
          p,
          [0, 1],
          [0.8, 1],
        )}) rotate(${rotate}deg)`,
        opacity: p,
        ...style,
      }}
    >
      <Ink radius={26} shadow={14} bg={C.ink} style={{ width, height, position: "relative" }}>
        <Img
          src={staticFile(`frames/${name}/${String(i).padStart(4, "0")}.jpg`)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </Ink>
      {label ? (
        <div
          style={{
            position: "absolute",
            left: -14,
            bottom: -22,
            fontFamily: BODY,
            fontWeight: 900,
            fontSize: 26,
            color: C.ink,
            background: labelColor,
            border: `5px solid ${C.ink}`,
            borderRadius: 12,
            padding: "4px 16px",
            boxShadow: `6px 6px 0 ${C.ink}`,
            transform: "rotate(-3deg)",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
