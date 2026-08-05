import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Kicker, Person, Phone, useSpr } from "./kit";

/** Portrait scene layout: kicker on top, big phone in the middle, cut-out people at the bottom. */
export const Stage: React.FC<{
  step?: string;
  title: string;
  sub?: string;
  color: string;
  shot: string;
  phoneHeight?: number;
  phoneRotate?: number;
  left?: { src: string; blob?: string; height?: number; flip?: boolean; delay?: number };
  right?: { src: string; blob?: string; height?: number; flip?: boolean; delay?: number };
  children?: React.ReactNode;
  phaseShot?: { src: string; from: number }[];
}> = ({ step, title, sub, color, shot, phoneHeight = 980, phoneRotate = -2, left, right, children }) => {
  const frame = useCurrentFrame();
  const p = useSpr(4, { damping: 18, stiffness: 110 });
  const l = useSpr(left?.delay ?? 12, { damping: 15, stiffness: 120 });
  const r = useSpr(right?.delay ?? 24, { damping: 15, stiffness: 120 });
  const float = Math.sin(frame / 25) * 10;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 96 }}>
        <Kicker step={step} title={title} sub={sub} color={color} align="center" size={76} style={{ padding: "0 70px" }} />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -110,
          display: "flex",
          justifyContent: "center",
          transform: `translateY(${interpolate(p, [0, 1], [1200, float])}px) rotate(${phoneRotate}deg) scale(${interpolate(
            p,
            [0, 1],
            [0.86, 1],
          )})`,
        }}
      >
        <Phone src={shot} height={phoneHeight} />
      </div>
      {left ? (
        <div
          style={{
            position: "absolute",
            left: -90,
            bottom: -40,
            transform: `translateX(${interpolate(l, [0, 1], [-800, 0])}px) translateY(${-float * 0.5}px)`,
          }}
        >
          <Person src={left.src} height={left.height ?? 760} blob={left.blob} blobScale={0.78} flip={left.flip} />
        </div>
      ) : null}
      {right ? (
        <div
          style={{
            position: "absolute",
            right: -90,
            bottom: -40,
            transform: `translateX(${interpolate(r, [0, 1], [800, 0])}px) translateY(${float * 0.5}px)`,
          }}
        >
          <Person src={right.src} height={right.height ?? 720} blob={right.blob} blobScale={0.78} flip={right.flip} />
        </div>
      ) : null}
      {children}
    </AbsoluteFill>
  );
};
