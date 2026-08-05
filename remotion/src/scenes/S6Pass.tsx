import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { Pow, Rays } from "../components/kit";
import { Stage } from "../components/Stage";

export const S6Pass: React.FC = () => (
  <AbsoluteFill>
    <Rays x={540} y={900} color={C.purple} opacity={0.15} speed={0.16} />
    <Stage
      step="STEP 05"
      title="PASS THE PHONE"
      sub="Hand the phone to the next player — they become your judge."
      color={C.purple}
      shot="10-switch-handoff.png"
      phoneHeight={1240}
      left={{ src: "pass.png", blob: "#D9C6FF", height: 700, delay: 8 }}
      right={{ src: "judge.png", blob: "#BFE8FF", height: 660, delay: 20 }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", justifyContent: "center" }}>
        <Pow text="YOUR TURN!" color={C.purple} size={50} delay={26} rotate={-5} style={{ color: "#fff" }} />
      </div>
    </Stage>
  </AbsoluteFill>
);
