import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Person, Phone, Pow, Rays, useSpr } from "../components/kit";

export const S5Judge: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useSpr(4, { damping: 15, stiffness: 130 });
  const b = useSpr(24, { damping: 12, stiffness: 150 });
  const float = Math.sin(frame / 21) * 9;
  return (
    <AbsoluteFill>
      <Rays x={520} y={520} color={C.purple} opacity={0.16} speed={0.14} />
      <AbsoluteFill style={{ alignItems: "flex-end", justifyContent: "flex-start", paddingTop: 60, paddingRight: 90 }}>
        <Kicker
          step="STEP 04"
          title={"PASS THE\nPHONE"}
          sub="The next player becomes the judge, films your form and hits DEFUSE if you nail it."
          color={C.purple}
          align="right"
          size={72}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-start", paddingLeft: 70, paddingBottom: 0, gap: 20 }}>
        <div
          style={{
            position: "relative",
            transform: `translateX(${interpolate(a, [0, 1], [-700, 0])}px) translateY(${float}px)`,
          }}
        >
          <Person src="pass.png" height={720} blob="#D9C6FF" blobScale={0.78} />
          <div style={{ position: "absolute", top: 30, left: 200 }}>
            <Pow text="YOUR TURN!" color={C.purple} size={44} delay={12} rotate={-6} style={{ color: "#fff" }} />
          </div>
          <div style={{ position: "absolute", bottom: 0, right: -40, transform: "rotate(5deg)" }}>
            <Phone src="10-switch-handoff.png" height={260} />
          </div>
        </div>
        <div
          style={{
            position: "relative",
            transform: `translateY(${interpolate(b, [0, 1], [780, -float])}px)`,
            opacity: b,
          }}
        >
          <Person src="judge.png" height={640} blob="#BFE8FF" blobScale={0.84} />
          <div style={{ position: "absolute", top: 10, right: -30 }}>
            <Pow text="JUDGE" color={C.green} size={44} delay={34} rotate={7} />
          </div>
          <div style={{ position: "absolute", bottom: -10, right: -70, transform: "rotate(-4deg)" }}>
            <Phone src="11-judge-camera.png" height={280} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};