import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { BODY, DISPLAY, Rays, Shock, useSpr } from "../components/kit";

export const S1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = useSpr(4, { damping: 9, stiffness: 140 });
  const sub = useSpr(20, { damping: 200 });
  const wobble = Math.sin(frame / 9) * 1.6;
  const scale = interpolate(pop, [0, 1], [0.3, 1]);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Rays x={960} y={520} color={C.red} opacity={0.22} speed={0.32} count={22} />
      <Shock delay={6} y={520} max={1700} color={C.red} />
      <Shock delay={14} y={520} max={1500} />
      <div style={{ transform: `scale(${scale}) rotate(${wobble}deg)`, textAlign: "center" }}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 300,
            lineHeight: 0.85,
            color: C.yellow,
            textShadow: `12px 12px 0 ${C.ink}, -4px -4px 0 ${C.ink}, 4px -4px 0 ${C.ink}, -4px 4px 0 ${C.ink}`,
            letterSpacing: 4,
          }}
        >
          BOOM!
        </div>
      </div>
      <div
        style={{
          marginTop: 46,
          opacity: sub,
          transform: `translateY(${interpolate(sub, [0, 1], [40, 0])}px) rotate(-1deg)`,
          fontFamily: BODY,
          fontWeight: 800,
          fontSize: 40,
          color: C.ink,
          background: C.cream,
          padding: "12px 30px",
          border: `6px solid ${C.ink}`,
          borderRadius: 18,
          boxShadow: `10px 10px 0 ${C.ink}`,
          letterSpacing: 1,
        }}
      >
        The party workout game — from login to leaderboard
      </div>
    </AbsoluteFill>
  );
};