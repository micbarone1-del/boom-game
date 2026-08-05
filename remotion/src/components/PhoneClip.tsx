import React from "react";
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Ink, useSpr } from "./kit";

export type Clip = { src: string; dur: number; total: number; startFrom?: number };

const Frames: React.FC<{ name: string; total: number; startFrom?: number }> = ({ name, total, startFrom = 0 }) => {
  const frame = useCurrentFrame();
  const i = Math.min(total, Math.max(1, startFrom + frame + 1));
  const pad = String(i).padStart(4, "0");
  return (
    <Img
      src={staticFile(`frames/${name}/${pad}.jpg`)}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

/** Phone mock playing real recorded gameplay clips back to back. */
export const PhoneClip: React.FC<{
  clips: Clip[];
  height?: number;
  rotate?: number;
  enterDelay?: number;
  style?: React.CSSProperties;
}> = ({ clips, height = 1400, rotate = -2, enterDelay = 3, style }) => {
  const frame = useCurrentFrame();
  const width = height * (720 / 1560);
  const p = useSpr(enterDelay, { damping: 18, stiffness: 110 });
  const float = Math.sin(frame / 26) * 8;
  let acc = 0;
  return (
    <div
      style={{
        transform: `translateY(${interpolate(p, [0, 1], [1300, float])}px) rotate(${rotate}deg) scale(${interpolate(
          p,
          [0, 1],
          [0.88, 1],
        )})`,
        ...style,
      }}
    >
      <Ink radius={40} shadow={20} bg={C.ink} style={{ width, height, position: "relative" }}>
        {clips.map((c) => {
          const from = acc;
          acc += c.dur;
          return (
            <Sequence key={c.src + from} from={from} durationInFrames={c.dur} layout="none">
              <AbsoluteFill>
                <Frames name={c.src} total={c.total} startFrom={c.startFrom} />
              </AbsoluteFill>
            </Sequence>
          );
        })}
      </Ink>
    </div>
  );
};
