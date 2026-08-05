import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { slide } from "@remotion/transitions/slide";
import { Backdrop } from "./components/Backdrop";
import { S1Hook } from "./scenes/S1Hook";
import { S2Join } from "./scenes/S2Join";
import { S3Lobby } from "./scenes/S3Lobby";
import { S4Roll } from "./scenes/S4Roll";
import { S5Judge } from "./scenes/S5Judge";
import { S6Fuse } from "./scenes/S6Fuse";
import { S7Boss } from "./scenes/S7Boss";
import { S8Board } from "./scenes/S8Board";
import { S9End } from "./scenes/S9End";

const T = 14;
export const SCENES: { c: React.FC; d: number }[] = [
  { c: S1Hook, d: 70 },
  { c: S2Join, d: 100 },
  { c: S3Lobby, d: 96 },
  { c: S4Roll, d: 124 },
  { c: S5Judge, d: 100 },
  { c: S6Fuse, d: 82 },
  { c: S7Boss, d: 160 },
  { c: S8Board, d: 110 },
  { c: S9End, d: 70 },
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
          presentation={i % 2 === 0 ? wipe({ direction: "from-left" }) : slide({ direction: "from-right" })}
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