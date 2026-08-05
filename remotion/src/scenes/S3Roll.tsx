import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { Pow, Rays } from "../components/kit";
import { Stage } from "../components/Stage";
import { Mascot } from "../components/Mascot";

export const S3Roll: React.FC = () => (
  <AbsoluteFill>
    <Rays x={540} y={980} color={C.yellow} opacity={0.2} speed={0.22} count={24} />
    <Stage
      step="STEP 02"
      title="ROLL THE DICE"
      sub="Tap to roll — the dice decides how far your token travels."
      color={C.yellow}
      shot="07-pod-roll.png"
      left={{ src: "roll.png", blob: "#FFD873", height: 740, delay: 8 }}
    >
      <div style={{ position: "absolute", right: 70, top: 600 }}>
        <Pow text="ROLL!" color={C.yellow} size={58} delay={18} rotate={-8} />
      </div>
      <Mascot src="bomb-mascot.png" size={190} delay={12} style={{ right: 40, top: 1180 }} label="ROLL ME" />
    </Stage>
  </AbsoluteFill>
);
