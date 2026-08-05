import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Pow, Rays } from "../components/kit";
import { Stage } from "../components/Stage";

export const S7Exercise: React.FC = () => {
  const frame = useCurrentFrame();
  const rep = Math.abs(Math.sin(frame / 8)) * 22;
  return (
    <AbsoluteFill>
      <Rays x={540} y={950} color={C.yellow} opacity={0.18} speed={0.24} count={24} />
      <Stage
        step="STEP 06"
        title="SWEAT WHILE THEY FILM"
        sub="Do the exercise — the judge records you and checks your form."
        color={C.yellow}
        shot="11-judge-camera.png"
        phoneRotate={3}
        left={{ src: "exercise.png", blob: "#FFD873", height: 740, delay: 8 }}
        right={{ src: "judge.png", blob: "#BFE8FF", height: 620, delay: 18 }}
      >
        <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", justifyContent: "center", transform: `translateY(${-rep}px)` }}>
          <Pow text="SWEAT!" color={C.red} size={54} delay={20} rotate={-7} />
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
