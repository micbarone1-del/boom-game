import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Phone, Rays, useSpr } from "../components/kit";

export const S8Board: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useSpr(3, { damping: 16, stiffness: 120 });
  const b = useSpr(28, { damping: 13, stiffness: 140 });
  const pan = interpolate(frame, [12, 100], [0, 0.42], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const float = Math.sin(frame / 23) * 8;
  return (
    <AbsoluteFill>
      <Rays x={960} y={540} color={C.green} opacity={0.16} speed={-0.2} />
      <AbsoluteFill style={{ alignItems: "flex-end", paddingTop: 66, paddingRight: 110 }}>
        <Kicker
          step="STEP 06"
          title={"LEADERBOARD\n& RECAPS"}
          sub="Final ranking, all-time leaderboard, and a shareable recap video for every player."
          color={C.yellow}
          align="right"
          size={74}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 46, paddingTop: 120 }}>
        <div style={{ transform: `translateY(${interpolate(a, [0, 1], [700, float])}px) rotate(-3deg)` }}>
          <Phone src="22-wrapup-leaderboard.png" height={800} pan={pan} aspect={0.46} />
        </div>
        <div style={{ transform: `translateY(${interpolate(b, [0, 1], [760, -float])}px) rotate(4deg)`, opacity: b }}>
          <Phone src="23-recap-video-sharing.png" height={720} aspect={796 / 1632} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};