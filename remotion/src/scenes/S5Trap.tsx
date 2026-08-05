import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Pow, Rays, Shock } from "../components/kit";
import { Stage } from "../components/Stage";

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
        <div style={{ position: "absolute", right: 60, top: 720 }}>
          <Pow text="UH OH!" color={C.red} size={56} delay={18} rotate={9} />
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
