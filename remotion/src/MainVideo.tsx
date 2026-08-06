import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { wipe } from "@remotion/transitions/wipe";
import { slide } from "@remotion/transitions/slide";
import { Backdrop } from "./components/Backdrop";
import { FinalBlast, FuseLine } from "./components/FuseLine";
import { S1Hook } from "./scenes/S1Hook";
import { A1Step1 } from "./scenes/A1Step1";
import { A2Step2 } from "./scenes/A2Step2";
import { A3Step3 } from "./scenes/A3Step3";
import { A4Loop } from "./scenes/A4Loop";
import { A5Plus } from "./scenes/A5Plus";
import { A6Board } from "./scenes/A6Board";
import { S12End } from "./scenes/S12End";

const T = 12;
export const SCENES: { c: React.FC; d: number }[] = [
  { c: S1Hook, d: 52 },
  { c: A1Step1, d: 306 },
  { c: A2Step2, d: 150 },
  { c: A3Step3, d: 244 },
  { c: A4Loop, d: 132 },
  { c: A5Plus, d: 92 },
  { c: A6Board, d: 130 },
  { c: S12End, d: 56 },
];

export const TOTAL = SCENES.reduce((a, s) => a + s.d, 0) - T * (SCENES.length - 1);

/** absolute start frame of scene index i on the transition-overlapped timeline */
const sceneStart = (i: number) => SCENES.slice(0, i).reduce((a, s) => a + s.d, 0) - T * i;

export const FUSE_START = sceneStart(3); // step 3 — the fuse is burning while you work out
export const FUSE_END = TOTAL - 52;

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
      <FuseLine start={FUSE_START} end={FUSE_END} />
      <FinalBlast at={FUSE_END} />
    </AbsoluteFill>
  );
};
