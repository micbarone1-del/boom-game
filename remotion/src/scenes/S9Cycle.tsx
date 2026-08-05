import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { BODY, DISPLAY, Kicker, useSpr } from "../components/kit";

const MEMBERS = [
  { src: "roll.png", bg: "#FFD873" },
  { src: "hop.png", bg: "#A9E7FA" },
  { src: "exercise.png", bg: "#FFB3B3" },
  { src: "judge.png", bg: "#D9C6FF" },
  { src: "cheer.png", bg: "#B6F0CC" },
];

const CX = 540;
const CY = 1180;
const R = 360;
const AV = 280;

export const S9Cycle: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = useSpr(4, { damping: 16, stiffness: 110 });
  const spin = frame * 0.9;
  // which member currently "has the phone"
  const active = Math.floor(frame / 16) % MEMBERS.length;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Kicker
          step="STEP 08"
          title={"NOW THE\nJUDGE ROLLS"}
          sub="The phone goes round the pod — roll, hop, sweat, judge, repeat."
          color={C.green}
          align="center"
          size={76}
          style={{ padding: "0 70px" }}
        />
      </AbsoluteFill>

      <svg style={{ position: "absolute", inset: 0 }} viewBox="0 0 1080 1920" width={1080} height={1920}>
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.ink} strokeWidth={10} strokeDasharray="34 26" strokeDashoffset={-spin * 2} opacity={0.55} />
        <circle cx={CX} cy={CY} r={R - 120} fill={C.yellow} opacity={0.25} />
      </svg>

      {MEMBERS.map((m, i) => {
        const a = (i / MEMBERS.length) * Math.PI * 2 - Math.PI / 2;
        const x = CX + Math.cos(a) * R;
        const y = CY + Math.sin(a) * R;
        const on = active === i;
        const pop = useSpr(6 + i * 5, { damping: 13, stiffness: 150 });
        const s = interpolate(pop, [0, 1], [0.2, 1]) * (on ? 1.14 : 1);
        return (
          <div
            key={m.src}
            style={{
              position: "absolute",
              left: x - AV / 2,
              top: y - AV / 2,
              width: AV,
              height: AV,
              borderRadius: "50%",
              background: m.bg,
              border: `8px solid ${C.ink}`,
              boxShadow: `12px 12px 0 ${C.ink}`,
              overflow: "hidden",
              transform: `scale(${s})`,
              opacity: pop,
            }}
          >
            <Img
              src={staticFile(`people/${m.src}`)}
              style={{ width: "150%", height: "150%", objectFit: "cover", objectPosition: "top center", marginLeft: "-25%" }}
            />
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: CX - 190,
          top: CY - 70,
          width: 380,
          textAlign: "center",
          fontFamily: DISPLAY,
          fontSize: 66,
          lineHeight: 0.9,
          color: C.ink,
          transform: `rotate(-3deg) scale(${enter})`,
          textShadow: `6px 6px 0 ${C.green}`,
        }}
      >
        THE POD
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 30, marginTop: 14, letterSpacing: 2 }}>NEVER STOPS</div>
      </div>
    </AbsoluteFill>
  );
};
