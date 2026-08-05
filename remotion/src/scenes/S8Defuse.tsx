import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { DISPLAY, Phone, Pow, Rays, Shock, useSpr } from "../components/kit";
import { Kicker } from "../components/kit";

export const S8Defuse: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useSpr(4, { damping: 16, stiffness: 120 });
  const b = useSpr(30, { damping: 13, stiffness: 130 });
  const pulse = 0.5 + 0.5 * Math.sin(frame / 6);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: C.red, opacity: 0.06 + pulse * 0.1 }} />
      <Rays x={540} y={1000} color={C.red} opacity={0.2} speed={0.3} count={26} />
      <Shock delay={34} x={700} y={1150} max={1600} color={C.red} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Kicker
          step="STEP 07"
          title={"DEFUSE\nOR EXPLODE"}
          sub="Nail it and the judge hits DEFUSE. Miss it and… BOOM."
          color={C.red}
          align="center"
          size={76}
          style={{ padding: "0 70px" }}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 10,
          bottom: -40,
          transform: `translateY(${interpolate(a, [0, 1], [1100, 0])}px) rotate(-4deg)`,
        }}
      >
        <Phone src="15-power-up.png" height={1060} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: -110,
          transform: `translateY(${interpolate(b, [0, 1], [1100, 0])}px) rotate(5deg)`,
          opacity: b,
        }}
      >
        <Phone src="07c-fail-explosion.png" height={1020} />
      </div>
      <div style={{ position: "absolute", left: 60, top: 560 }}>
        <Pow text="DEFUSED!" color={C.green} size={50} delay={16} rotate={-8} />
      </div>
      <div style={{ position: "absolute", right: 50, top: 640 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 96, color: C.red, textShadow: `8px 8px 0 ${C.ink}`, transform: `rotate(9deg) scale(${b})` }}>
          BOOM!
        </div>
      </div>
    </AbsoluteFill>
  );
};
