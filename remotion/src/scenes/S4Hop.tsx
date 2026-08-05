import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Pow, Rays } from "../components/kit";
import { Stage } from "../components/Stage";

export const S4Hop: React.FC = () => {
  const frame = useCurrentFrame();
  const hop = Math.abs(Math.sin(frame / 7)) * 30;
  return (
    <AbsoluteFill>
      <Rays x={540} y={900} color={C.green} opacity={0.16} speed={0.2} />
      <Stage
        step="STEP 03"
        title="HOP ACROSS THE BOARD"
        sub="Your token hops cell by cell to the square you landed on."
        color={C.green}
        shot="09-hop-zoom-token.png"
        phoneRotate={2}
        right={{ src: "hop.png", blob: "#A9E7FA", height: 720, flip: true, delay: 10 }}
      >
        <div style={{ position: "absolute", left: 70, top: 600, transform: `translateY(${-hop}px)` }}>
          <Pow text="HOP!" color={C.green} size={58} delay={16} rotate={7} />
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
