import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { BODY, DISPLAY, useSpr } from "./kit";

export const MEMBERS = [
  { src: "roll.png", bg: "#FFD873", name: "ALE" },
  { src: "hop.png", bg: "#A9E7FA", name: "MIA" },
  { src: "exercise.png", bg: "#FFB3B3", name: "LEO" },
  { src: "judge.png", bg: "#D9C6FF", name: "SAM" },
  { src: "cheer.png", bg: "#B6F0CC", name: "KIM" },
];

/** Pod standing in a circle with the phone being handed physically from player to player. */
export const PodCircle: React.FC<{
  cx?: number;
  cy?: number;
  r?: number;
  av?: number;
  /** frames per hand-off */
  step?: number;
  startDelay?: number;
  centerTitle: string;
  centerSub: string;
  color?: string;
}> = ({ cx = 540, cy = 1230, r = 370, av = 270, step = 22, startDelay = 8, centerTitle, centerSub, color = C.green }) => {
  const frame = useCurrentFrame();
  const enter = useSpr(4, { damping: 16, stiffness: 110 });
  const t = Math.max(0, frame - startDelay);
  const idx = t / step; // continuous position around the circle
  const holder = Math.floor(idx) % MEMBERS.length;
  const nextHolder = (holder + 1) % MEMBERS.length;
  const seg = idx - Math.floor(idx);
  // phone travels along the arc between the two players, pausing at each stop
  const travel = interpolate(seg, [0, 0.45, 0.85, 1], [0, 0, 1, 1]);
  const ang = (i: number) => (i / MEMBERS.length) * Math.PI * 2 - Math.PI / 2;
  const a = ang(holder) + ((ang(nextHolder) - ang(holder) + Math.PI * 2) % (Math.PI * 2)) * travel;
  const pr = r - 96;
  const px = cx + Math.cos(a) * pr;
  const py = cy + Math.sin(a) * pr;
  return (
    <>
      <svg style={{ position: "absolute", inset: 0 }} viewBox="0 0 1080 1920" width={1080} height={1920}>
        <circle cx={cx} cy={cy} r={pr} fill="none" stroke={C.ink} strokeWidth={9} strokeDasharray="30 24" strokeDashoffset={-frame * 2.2} opacity={0.5} />
        <circle cx={cx} cy={cy} r={pr - 40} fill={color} opacity={0.18} />
        {MEMBERS.map((m, i) => {
          const aa = ang(i) + 0.34;
          const x = cx + Math.cos(aa) * (pr + 46);
          const y = cy + Math.sin(aa) * (pr + 46);
          return (
            <g key={m.src} transform={`translate(${x} ${y}) rotate(${(aa * 180) / Math.PI + 90})`} opacity={0.75}>
              <path d="M -16 -18 L 0 8 L 16 -18 Z" fill={C.ink} />
            </g>
          );
        })}
      </svg>

      {MEMBERS.map((m, i) => {
        const aa = ang(i);
        const x = cx + Math.cos(aa) * r;
        const y = cy + Math.sin(aa) * r;
        const on = holder === i;
        const pop = useSpr(6 + i * 4, { damping: 13, stiffness: 150 });
        const s = interpolate(pop, [0, 1], [0.2, 1]) * (on ? 1.14 : 1);
        return (
          <div key={m.src} style={{ position: "absolute", left: x - av / 2, top: y - av / 2, opacity: pop }}>
            <div
              style={{
                width: av,
                height: av,
                borderRadius: "50%",
                background: m.bg,
                border: `8px solid ${C.ink}`,
                boxShadow: `${on ? 16 : 10}px ${on ? 16 : 10}px 0 ${C.ink}`,
                overflow: "hidden",
                transform: `scale(${s})`,
              }}
            >
              <Img
                src={staticFile(`people/${m.src}`)}
                style={{ width: "100%", height: "108%", objectFit: "contain", objectPosition: "center bottom", marginTop: "6%" }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: "50%",
                marginLeft: -50,
                bottom: -22,
                width: 100,
                textAlign: "center",
                fontFamily: BODY,
                fontWeight: 900,
                fontSize: 22,
                color: C.ink,
                background: on ? C.yellow : "#fff",
                border: `4px solid ${C.ink}`,
                borderRadius: 999,
                boxShadow: `4px 4px 0 ${C.ink}`,
              }}
            >
              {m.name}
            </div>
          </div>
        );
      })}

      {/* the physical phone travelling hand to hand */}
      <div
        style={{
          position: "absolute",
          left: px - 46,
          top: py - 78,
          width: 92,
          height: 156,
          borderRadius: 16,
          background: C.ink,
          border: `6px solid ${C.ink}`,
          boxShadow: `8px 8px 0 rgba(18,16,14,0.4)`,
          transform: `rotate(${Math.sin(frame / 6) * 8}deg) scale(${interpolate(seg, [0, 0.5, 1], [1, 1.18, 1])})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Img src={staticFile("shots/07-pod-roll.png")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
      </div>

      <div
        style={{
          position: "absolute",
          left: cx - 210,
          top: cy - 66,
          width: 420,
          textAlign: "center",
          fontFamily: DISPLAY,
          fontSize: 60,
          lineHeight: 0.9,
          color: C.ink,
          transform: `rotate(-3deg) scale(${enter})`,
          textShadow: `6px 6px 0 ${color}`,
        }}
      >
        {centerTitle}
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 28, marginTop: 12, letterSpacing: 2 }}>{centerSub}</div>
      </div>
    </>
  );
};
