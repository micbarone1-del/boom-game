import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Phone, Rays } from "../components/kit";

const shots = ["07-pod-roll.png", "08-hop-board-overview.png", "09-hop-zoom-token.png", "07b-trap-announcement.png"];

export const S4Roll: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Rays x={960} y={620} color={C.yellow} opacity={0.2} speed={0.2} count={24} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 56 }}>
        <Kicker
          step="STEP 03"
          title="ROLL. HOP. SWEAT."
          sub="Tap to roll, watch your token hop the board, land on a cell and get your exercise."
          color={C.red}
          size={82}
          style={{ alignItems: "center" }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 34, paddingBottom: 34 }}>
        {shots.map((s, i) => {
          const d = 16 + i * 13;
          const sp = interpolate(frame - d, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const eased = 1 - Math.pow(1 - sp, 3);
          const float = Math.sin(frame / 22 + i) * 9;
          const tilt = [-4, 2.5, -2, 4][i];
          return (
            <div
              key={s}
              style={{
                transform: `translateY(${interpolate(eased, [0, 1], [760, float])}px) rotate(${tilt}deg) scale(${interpolate(
                  eased,
                  [0, 1],
                  [0.85, 1],
                )})`,
              }}
            >
              <Phone src={s} height={620} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};