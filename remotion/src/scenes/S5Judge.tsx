import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Phone, Rays, useSpr } from "../components/kit";

export const S5Judge: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useSpr(4, { damping: 15, stiffness: 130 });
  const b = useSpr(24, { damping: 12, stiffness: 150 });
  const float = Math.sin(frame / 21) * 9;
  return (
    <AbsoluteFill>
      <Rays x={520} y={520} color={C.purple} opacity={0.16} speed={0.14} />
      <AbsoluteFill style={{ flexDirection: "row-reverse", alignItems: "center", padding: "0 110px", gap: 40 }}>
        <Kicker
          step="STEP 04"
          title={"PASS THE\nPHONE"}
          sub="The next player becomes the judge, films your form and hits DEFUSE if you nail it."
          color={C.purple}
          align="right"
          size={84}
        />
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 30 }}>
          <div style={{ transform: `translateY(${interpolate(a, [0, 1], [620, float])}px) rotate(-5deg)` }}>
            <Phone src="10-switch-handoff.png" height={700} />
          </div>
          <div style={{ transform: `translateY(${interpolate(b, [0, 1], [700, -float])}px) rotate(4deg)`, opacity: b }}>
            <Phone src="11-judge-camera.png" height={790} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};