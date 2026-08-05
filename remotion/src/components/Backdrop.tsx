import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";

/** Persistent full-video layer: warm paper base, halftone dots, drifting blobs. */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (speed: number, amp: number, phase = 0) => Math.sin(frame * speed + phase) * amp;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 30% 10%, #FFF7EA 0%, ${C.cream} 45%, #F3D9AE 100%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${C.ink} 2px, transparent 2px)`,
          backgroundSize: "26px 26px",
          opacity: 0.07,
          transform: `translate(${drift(0.01, 14)}px, ${drift(0.013, 14, 1)}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: C.yellow,
          opacity: 0.5,
          filter: "blur(90px)",
          left: -260 + drift(0.008, 60),
          top: -300 + drift(0.011, 50, 2),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          background: C.red,
          opacity: 0.28,
          filter: "blur(110px)",
          right: -220 + drift(0.009, 70, 1),
          bottom: -280 + drift(0.007, 60, 3),
        }}
      />
      {/* thin ink frame */}
      <AbsoluteFill
        style={{
          border: `14px solid ${C.ink}`,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
        }}
      />
    </AbsoluteFill>
  );
};