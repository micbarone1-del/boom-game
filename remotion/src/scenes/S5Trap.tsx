import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Pow, Rays, Shock } from "../components/kit";
import { Stage } from "../components/Stage";
import { Mascot } from "../components/Mascot";

export const S5Trap: React.FC = () => {
  const frame = useCurrentFrame();
  const shake = frame > 18 ? Math.sin(frame * 2.6) * 8 : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      <Rays x={540} y={880} color={C.red} opacity={0.2} speed={-0.26} count={22} />
      <Shock delay={16} x={540} y={1080} max={1500} color={C.red} />
      <Stage
        step="STEP 04"
        title="SEE YOUR TRAP"
        sub="The cell reveals your challenge — and the fuse starts burning."
        color={C.red}
        shot="07b-trap-announcement.png"
        phoneRotate={-3}
        left={{ src: "exercise.png", blob: "#FFB3B3", height: 700, delay: 14 }}
      >
        <div style={{ position: "absolute", right: 60, top: 580 }}>
          <Pow text="UH OH!" color={C.red} size={56} delay={18} rotate={9} />
        </div>
        <Mascot src="bomb-easy.png" size={150} delay={8} style={{ left: 40, top: 470 }} label="EASY" labelColor={C.green} />
        <Mascot src="bomb-medium.png" size={150} delay={16} style={{ left: 40, top: 700 }} label="MEDIUM" labelColor={C.yellow} />
        <Mascot src="bomb-hard.png" size={150} delay={24} style={{ right: 30, top: 830 }} label="HARD" labelColor={C.red} />
        <Mascot src="bomb-rest.png" size={150} delay={32} style={{ left: 30, top: 960 }} label="REST" labelColor={C.blue} />
        <Mascot src="bomb-setback.png" size={150} delay={40} style={{ right: 30, top: 1090 }} label="SETBACK" labelColor={C.purple} />
        <Mascot src="bomb-boost.png" size={150} delay={48} style={{ left: 30, top: 1220 }} label="BOOST" labelColor={C.yellow} />
      </Stage>
    </AbsoluteFill>
  );
};
