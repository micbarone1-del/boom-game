import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Person, Phone, Rays, useSpr } from "../components/kit";

export const S11Board: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useSpr(3, { damping: 16, stiffness: 120 });
  const b = useSpr(26, { damping: 13, stiffness: 140 });
  const crew = useSpr(12, { damping: 14 });
  const pan = interpolate(frame, [12, 92], [0, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const float = Math.sin(frame / 23) * 9;
  return (
    <AbsoluteFill>
      <Rays x={540} y={900} color={C.green} opacity={0.15} speed={-0.2} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 96 }}>
        <Kicker
          step="STEP 10"
          title={"LEADERBOARD\n& RECAPS"}
          sub="Final ranking, all-time board and a shareable recap video for everyone."
          color={C.yellow}
          align="center"
          size={72}
          style={{ padding: "0 70px" }}
        />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 30, bottom: -80, transform: `translateY(${interpolate(a, [0, 1], [1200, float])}px) rotate(-4deg)` }}>
        <Phone src="22-wrapup-leaderboard.png" height={900} pan={pan} aspect={0.46} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: -150,
          transform: `translateY(${interpolate(b, [0, 1], [1200, -float])}px) rotate(5deg)`,
          opacity: b,
        }}
      >
        <Phone src="23-recap-video-sharing.png" height={860} aspect={796 / 1632} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -40,
          display: "flex",
          justifyContent: "center",
          transform: `translateY(${interpolate(crew, [0, 1], [700, float * 0.5])}px)`,
        }}
      >
        <Person src="cheer.png" height={620} />
      </div>
    </AbsoluteFill>
  );
};
