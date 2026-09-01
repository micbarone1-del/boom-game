import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Person, Pow, Rays, useSpr } from "../components/kit";
import { PhoneClip } from "../components/PhoneClip";
import { RealPhoto } from "../components/RealPhoto";
import { Mascot } from "../components/Mascot";

export const A3Step3: React.FC = () => {
  const frame = useCurrentFrame();
  const r = useSpr(14, { damping: 15, stiffness: 120 });
  return (
    <AbsoluteFill>
      <Rays x={540} y={1050} color={C.red} opacity={0.16} speed={-0.2} count={22} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 56 }}>
        <Kicker
          step="STEP 3"
          title={"SWEAT WHILE\nTHEY JUDGE YOU"}
          sub="The judge films your reps. Defuse before the fuse runs out — or BOOM."
          color={C.red}
          align="center"
          size={70}
          style={{ padding: "0 70px" }}
        />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: -70, display: "flex", justifyContent: "center" }}>
        <PhoneClip
          clips={[
            { src: "defuse", dur: 150, total: 240 },
            { src: "judge", dur: 94, total: 255 },
          ]}
          height={1320}
          rotate={2}
        />
      </div>
      <div style={{ position: "absolute", right: -110, bottom: -60, transform: `translateX(${(1 - r) * 800}px)` }}>
        <Person src="judge.png" height={620} blob="#D9C6FF" blobScale={0.74} flip />
      </div>
      <RealPhoto src="real5.jpg" width={300} height={330} rotate={-5} delay={22} label="JUDGE FILMS" style={{ left: 18, top: 1010 }} />
      <RealPhoto src="real6.jpg" width={300} height={400} rotate={4} delay={70} label="REAL REPS" labelColor={C.green} style={{ right: 22, top: 560 }} />
      <div style={{ position: "absolute", left: 70, top: 700 }}>
        <Pow text="8 REPS!" color={C.red} size={50} delay={20} rotate={-8} style={{ color: "#fff" }} />
      </div>
      {frame > 150 ? (
        <div style={{ position: "absolute", right: 90, top: 760 }}>
          <Pow text="DEFUSED!" color={C.green} size={52} delay={160} rotate={8} />
        </div>
      ) : null}
      <Mascot src="bomb-hard.png" size={150} delay={12} style={{ left: 28, bottom: 300 }} label="HARD" labelColor={C.red} />
      <Mascot src="bomb-boost.png" size={140} delay={120} style={{ right: 28, top: 980 }} label="BOOST" labelColor={C.yellow} />
    </AbsoluteFill>
  );
};
