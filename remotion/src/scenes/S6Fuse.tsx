import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { DISPLAY, Phone, Screen, Shock, useSpr } from "../components/kit";

export const S6Fuse: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useSpr(2, { damping: 20, stiffness: 100 });
  const late = useSpr(38, { damping: 11 });
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  const shake = frame > 44 ? Math.sin(frame * 2.4) * Math.min(10, (frame - 44) * 0.25) : 0;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: C.red, opacity: 0.08 + pulse * 0.12 }} />
      <div style={{ transform: `scale(${interpolate(a, [0, 1], [1.25, 1])}) translate(${shake}px, ${-shake}px)` }}>
        <Screen src="04-gym-live-map.png" width={1200} />
      </div>
      <Shock delay={48} max={2200} color={C.red} />
      <div
        style={{
          position: "absolute",
          left: 84,
          top: 78,
          fontFamily: DISPLAY,
          fontSize: 92,
          color: C.cream,
          textShadow: `8px 8px 0 ${C.ink}`,
          transform: `rotate(-3deg) scale(${1 + pulse * 0.03})`,
        }}
      >
        THE FUSE IS BURNING
      </div>
      <div
        style={{
          position: "absolute",
          right: 70,
          bottom: 30,
          transform: `translateY(${interpolate(late, [0, 1], [640, 0])}px) rotate(6deg)`,
        }}
      >
        <Phone src="07c-fail-explosion.png" height={540} />
      </div>
    </AbsoluteFill>
  );
};