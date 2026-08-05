import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Pow, Rays } from "../components/kit";
import { PodCircle } from "../components/PodCircle";
import { Mascot } from "../components/Mascot";

export const S6Pass: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Rays x={540} y={1150} color={C.purple} opacity={0.15} speed={0.16} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Kicker
          step="STEP 05"
          title={"PASS THE PHONE\nHAND TO HAND"}
          sub="One real phone travels round the pod circle — the next player becomes your judge."
          color={C.purple}
          align="center"
          size={70}
          style={{ padding: "0 70px" }}
        />
      </AbsoluteFill>
      <PodCircle centerTitle="ONE PHONE" centerSub="PASSED AROUND" color={C.purple} step={20} />
      <div style={{ position: "absolute", left: 60, top: 640 }}>
        <Pow text="TAKE IT!" color={C.purple} size={44} delay={16} rotate={-7} style={{ color: "#fff" }} />
      </div>
      <div style={{ position: "absolute", right: 60, top: 700 }}>
        <Pow text="GOT IT!" color={C.green} size={44} delay={34} rotate={8} />
      </div>
      <Mascot src="bomb-mascot.png" size={190} delay={10} style={{ right: 40, bottom: 60 }} label="TICK TICK" labelColor={C.red} />
      {frame > 40 ? <Mascot src="bomb-medium.png" size={150} delay={44} style={{ left: 40, bottom: 80 }} /> : null}
    </AbsoluteFill>
  );
};
