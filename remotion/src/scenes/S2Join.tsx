import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { Pow, Rays } from "../components/kit";
import { Stage } from "../components/Stage";

export const S2Join: React.FC = () => (
  <AbsoluteFill>
    <Rays x={540} y={900} color={C.blue} opacity={0.16} speed={-0.18} />
    <Stage
      step="STEP 01"
      title="JOIN IN ONE TAP"
      sub="Scan the QR, pick a nickname or sign in — you're in the pod."
      color={C.blue}
      shot="06-join-phone.png"
      left={{ src: "join.png", blob: "#BFE8FF", height: 720, delay: 10 }}
    >
      <div style={{ position: "absolute", right: 90, top: 700 }}>
        <Pow text="I'M IN!" color={C.blue} size={54} delay={22} rotate={8} />
      </div>
    </Stage>
  </AbsoluteFill>
);
