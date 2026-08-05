import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { BODY, DISPLAY, Rays, Shock, useSpr } from "../components/kit";
import { Mascot } from "../components/Mascot";

export const S12End: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = useSpr(2, { damping: 8, stiffness: 150 });
  const url = useSpr(18, { damping: 200 });
  const wob = Math.sin(frame / 10) * 1.4;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Mascot src="bomb-mascot.png" size={300} delay={16} style={{ left: 60, bottom: 420 }} />
      <Mascot src="bomb-super.png" size={230} delay={24} style={{ right: 70, bottom: 460 }} />
      <Rays x={540} y={900} color={C.yellow} opacity={0.3} speed={0.5} count={26} />
      <Shock delay={2} x={540} y={900} max={2200} color={C.red} />
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 210,
          color: C.red,
          textShadow: `12px 12px 0 ${C.ink}`,
          transform: `scale(${interpolate(pop, [0, 1], [0.4, 1])}) rotate(${wob}deg)`,
        }}
      >
        BOOM!
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: 52,
          letterSpacing: 2,
          color: C.ink,
          background: C.yellow,
          padding: "14px 40px",
          border: `6px solid ${C.ink}`,
          borderRadius: 20,
          boxShadow: `12px 12px 0 ${C.ink}`,
          opacity: url,
          transform: `translateY(${interpolate(url, [0, 1], [50, 0])}px) rotate(-1.5deg)`,
        }}
      >
        boomworkout.fun
      </div>
    </AbsoluteFill>
  );
};