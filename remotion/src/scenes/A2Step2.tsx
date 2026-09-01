import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { Kicker, Phone, Pow, Rays } from "../components/kit";
import { PodCircle } from "../components/PodCircle";
import { Mascot } from "../components/Mascot";

export const A2Step2: React.FC = () => (
  <AbsoluteFill>
    <Rays x={540} y={1180} color={C.purple} opacity={0.15} speed={0.16} />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 56 }}>
      <Kicker
        step="STEP 2"
        title={"PASS THE PHONE\nTO YOUR RIGHT"}
        sub="One real phone, handed over for real — that player is now your judge."
        color={C.purple}
        align="center"
        size={70}
        style={{ padding: "0 70px" }}
      />
    </AbsoluteFill>
    <PodCircle centerTitle="ONE PHONE" centerSub="PASSED AROUND" color={C.purple} step={22} />
    <div style={{ position: "absolute", left: 56, top: 660 }}>
      <Pow text="TAKE IT!" color={C.purple} size={44} delay={14} rotate={-7} style={{ color: "#fff" }} />
    </div>
    <div style={{ position: "absolute", right: 56, top: 720 }}>
      <Pow text="GOT IT!" color={C.green} size={44} delay={34} rotate={8} />
    </div>
    <Mascot src="bomb-mascot.png" size={170} delay={10} style={{ right: 28, bottom: 240 }} label="TICK TICK" labelColor={C.red} />
    <Mascot src="bomb-rest.png" size={140} delay={46} style={{ left: 28, bottom: 250 }} label="REST" labelColor={C.blue} />
    <div style={{ position: "absolute", left: 24, bottom: -330, transform: "rotate(-8deg)" }}>
      <Phone src="26-create-pod.png" height={620} aspect={0.462} />
    </div>
  </AbsoluteFill>
);
