import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { slide } from "@remotion/transitions/slide";
import { Backdrop } from "./components/Backdrop";
import { S1Hook } from "./scenes/S1Hook";
import { S2Join } from "./scenes/S2Join";
import { S3Roll } from "./scenes/S3Roll";
import { S4Hop } from "./scenes/S4Hop";
import { S5Trap } from "./scenes/S5Trap";
import { S6Pass } from "./scenes/S6Pass";
import { S7Exercise } from "./scenes/S7Exercise";
import { S8Defuse } from "./scenes/S8Defuse";
import { S9Cycle } from "./scenes/S9Cycle";
import { S10Boss } from "./scenes/S10Boss";
import { S11Board } from "./scenes/S11Board";
import { S12End } from "./scenes/S12End";

const T = 12;
export const SCENES: { c: React.FC; d: number }[] = [
  { c: S1Hook, d: 58 },
  { c: S2Join, d: 76 },
  { c: S3Roll, d: 76 },
  { c: S4Hop, d: 76 },
  { c: S5Trap, d: 72 },
  { c: S6Pass, d: 78 },
  { c: S7Exercise, d: 84 },
  { c: S8Defuse, d: 80 },
  { c: S9Cycle, d: 92 },
  { c: S10Boss, d: 132 },
  { c: S11Board, d: 92 },
  { c: S12End, d: 62 },
];

export const TOTAL = SCENES.reduce((a, s) => a + s.d, 0) - T * (SCENES.length - 1);

const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

export const MainVideo: React.FC = () => {
  const children: React.ReactNode[] = [];
  SCENES.forEach(({ c: Comp, d }, i) => {
    if (i > 0) {
      children.push(
        <TransitionSeries.Transition
          key={`t${i}`}
          presentation={i % 2 === 0 ? wipe({ direction: "from-bottom" }) : slide({ direction: "from-right" })}
          timing={timing}
        />,
      );
    }
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d}>
        <Comp />
      </TransitionSeries.Sequence>,
    );
  });
  return (
    <AbsoluteFill>
      <Backdrop />
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
};
