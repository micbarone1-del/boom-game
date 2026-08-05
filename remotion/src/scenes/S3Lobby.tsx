import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Screen, useSpr } from "../components/kit";

export const S3Lobby: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useSpr(4, { damping: 18, stiffness: 110 });
  const b = useSpr(34, { damping: 14, stiffness: 130 });
  const float = Math.sin(frame / 26) * 8;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "flex-start", paddingTop: 74, paddingLeft: 120 }}>
        <Kicker
          step="STEP 02"
          title="BUILD YOUR PODS"
          sub="Room code, QR, teams — then customise the training and the music."
          color={C.green}
          align="left"
          size={78}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 380,
          transform: `translateX(${interpolate(a, [0, 1], [-900, 0])}px) translateY(${float}px) rotate(-2deg)`,
        }}
      >
        <Screen src="02-gym-lobby.png" width={1000} ratio={0.53} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 250,
          transform: `translateY(${interpolate(b, [0, 1], [500, -float])}px) rotate(3deg) scale(${interpolate(b, [0, 1], [0.8, 1])})`,
          opacity: b,
        }}
      >
        <Screen src="03-customise.png" width={700} ratio={0.56} />
      </div>
    </AbsoluteFill>
  );
};