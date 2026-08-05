import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Person, Pow, Rays, useSpr } from "../components/kit";
import { PhoneClip } from "../components/PhoneClip";
import { Mascot } from "../components/Mascot";

export const A1Step1: React.FC = () => {
  const frame = useCurrentFrame();
  const l = useSpr(10, { damping: 15, stiffness: 120 });
  return (
    <AbsoluteFill>
      <Rays x={540} y={1050} color={C.yellow} opacity={0.18} speed={0.2} count={24} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 56 }}>
        <Kicker
          step="STEP 1"
          title={"ROLL, HOP,\nGET YOUR MOVE"}
          sub="Tap to roll — your token hops across the board and the cell hands you an exercise."
          color={C.yellow}
          align="center"
          size={74}
          style={{ padding: "0 70px" }}
        />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -70, display: "flex", justifyContent: "center" }}>
        <PhoneClip
          clips={[
            { src: "roll", dur: 100, total: 120 },
            { src: "hop", dur: 100, total: 102 },
            { src: "trap", dur: 106, total: 108 },
          ]}
          height={1320}
        />
      </div>
      <div
        style={{ position: "absolute", left: -110, bottom: -60, transform: `translateX(${(l - 1) * 800}px)` }}
      >
        <Person src="roll.png" height={700} blob="#FFD873" blobScale={0.74} />
      </div>
      <div style={{ position: "absolute", left: 90, top: 690 }}>
        <Pow text="ROLL!" color={C.yellow} size={54} delay={16} rotate={-8} />
      </div>
      {frame > 100 ? (
        <div style={{ position: "absolute", right: 80, top: 700 }}>
          <Pow text="HOP HOP!" color={C.blue} size={50} delay={110} rotate={7} />
        </div>
      ) : null}
      <Mascot src="bomb-easy.png" size={130} delay={30} style={{ right: 34, top: 980 }} label="EASY" labelColor={C.green} />
      <Mascot src="bomb-medium.png" size={130} delay={120} style={{ left: 34, top: 1010 }} label="MEDIUM" labelColor={C.yellow} />
      {frame > 195 ? (
        <Mascot src="bomb-hard.png" size={170} delay={205} style={{ right: 30, bottom: 300 }} label="YOUR TRAP!" labelColor={C.red} />
      ) : null}
    </AbsoluteFill>
  );
};
