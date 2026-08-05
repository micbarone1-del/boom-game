import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { Kicker, Rays } from "../components/kit";
import { PodCircle } from "../components/PodCircle";
import { Mascot } from "../components/Mascot";

export const S9Cycle: React.FC = () => (
  <AbsoluteFill>
    <Rays x={540} y={1150} color={C.green} opacity={0.14} speed={-0.16} />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
      <Kicker
        step="STEP 08"
        title={"NOW THE\nJUDGE ROLLS"}
        sub="Phone in hand, the judge becomes the player — round and round the pod."
        color={C.green}
        align="center"
        size={72}
        style={{ padding: "0 70px" }}
      />
    </AbsoluteFill>
    <PodCircle centerTitle="THE POD" centerSub="NEVER STOPS" color={C.green} step={16} startDelay={4} />
    <Mascot src="bomb-easy.png" size={140} delay={12} style={{ left: 40, top: 620 }} label="EASY" labelColor={C.green} />
    <Mascot src="bomb-hard.png" size={140} delay={26} style={{ right: 40, top: 660 }} label="HARD" labelColor={C.red} />
    <Mascot src="bomb-rest.png" size={140} delay={40} style={{ left: 40, bottom: 250 }} label="REST" labelColor={C.blue} />
    <Mascot src="bomb-boost.png" size={140} delay={54} style={{ right: 40, bottom: 250 }} label="BOOST" labelColor={C.yellow} />
  </AbsoluteFill>
);
