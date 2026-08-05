import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Person, Phone, Pow, Rays, useSpr } from "../components/kit";

const beats: { person: string; shot: string; word: string; color: string; from: number; blob: string; flip?: boolean }[] = [
  { person: "roll.png", shot: "07-pod-roll.png", word: "ROLL!", color: C.yellow, from: 10, blob: "#FFD873" },
  { person: "hop.png", shot: "09-hop-zoom-token.png", word: "HOP!", color: C.blue, from: 46, blob: "#A9E7FA", flip: true },
  { person: "exercise.png", shot: "07b-trap-announcement.png", word: "SWEAT!", color: C.red, from: 84, blob: "#FFB3B3" },
];

export const S4Roll: React.FC = () => {
  const frame = useCurrentFrame();
  const active = beats.reduce((acc, b, i) => (frame >= b.from ? i : acc), 0);
  return (
    <AbsoluteFill>
      <Rays x={960} y={620} color={C.yellow} opacity={0.2} speed={0.2} count={24} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 40 }}>
        <Kicker
          step="STEP 03"
          title="ROLL. HOP. SWEAT."
          sub="Tap to roll, hop your token across the board, land on a cell and do the move."
          color={C.red}
          size={74}
          style={{ alignItems: "center" }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 90, paddingBottom: 10 }}>
        {beats.map((b, i) => {
          const sp = interpolate(frame - b.from, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const eased = 1 - Math.pow(1 - sp, 3);
          const on = active === i;
          const bounce = i === 1 ? Math.abs(Math.sin((frame - b.from) / 7)) * 34 : Math.sin(frame / 20 + i) * 8;
          return (
            <div
              key={b.person}
              style={{
                position: "relative",
                transform: `translateY(${interpolate(eased, [0, 1], [820, -bounce])}px) scale(${
                  interpolate(eased, [0, 1], [0.8, 1]) * (on ? 1.06 : 0.92)
                })`,
                opacity: interpolate(eased, [0, 1], [0, on ? 1 : 0.78]),
              }}
            >
              <Person src={b.person} height={620} blob={b.blob} blobScale={0.9} flip={b.flip} />
              <div style={{ position: "absolute", top: -10, left: i === 2 ? -70 : "auto", right: i === 2 ? "auto" : -60 }}>
                <Pow text={b.word} color={b.color} size={54} delay={b.from + 6} rotate={i % 2 ? 6 : -8} />
              </div>
              <div style={{ position: "absolute", bottom: 30, right: -50, transform: "rotate(6deg)" }}>
                <Phone src={b.shot} height={230} />
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};