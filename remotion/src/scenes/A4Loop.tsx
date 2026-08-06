import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../theme";
import { BODY, DISPLAY, Kicker, Rays, useSpr } from "../components/kit";
import { PodCircle } from "../components/PodCircle";
import { RealClip } from "../components/RealClip";
import { Mascot } from "../components/Mascot";

const STEPS = [
  { n: "1", t: "ROLL & HOP", c: C.yellow },
  { n: "2", t: "PASS RIGHT", c: C.purple },
  { n: "3", t: "SWEAT & DEFUSE", c: C.red },
];

const Chip: React.FC<{ n: string; t: string; c: string; delay: number }> = ({ n, t, c, delay }) => {
  const s = useSpr(delay, { damping: 11, stiffness: 170 });
  if (s <= 0.001) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: "#fff",
        border: `6px solid ${C.ink}`,
        borderRadius: 999,
        padding: "10px 30px 10px 12px",
        boxShadow: `10px 10px 0 ${C.ink}`,
        transform: `scale(${s}) rotate(${-1.5 + Number(n)}deg)`,
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: "50%",
          background: c,
          border: `5px solid ${C.ink}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: DISPLAY,
          fontSize: 38,
          color: C.ink,
          paddingTop: 6,
        }}
      >
        {n}
      </div>
      <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 38, color: C.ink, letterSpacing: 1 }}>{t}</div>
    </div>
  );
};

export const A4Loop: React.FC = () => (
  <AbsoluteFill>
    <Rays x={540} y={1200} color={C.green} opacity={0.14} speed={-0.16} />
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 50 }}>
      <Kicker
        title={"AND REPEAT\nAROUND THE POD"}
        sub="Hot potato: the judge rolls next."
        color={C.green}
        align="center"
        size={72}
        style={{ padding: "0 70px" }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 34 }}>
        {STEPS.map((s, i) => (
          <Chip key={s.n} n={s.n} t={s.t} c={s.c} delay={10 + i * 9} />
        ))}
      </div>
    </AbsoluteFill>
    <PodCircle cy={1400} r={330} av={230} centerTitle="THE POD" centerSub="NEVER STOPS" color={C.green} step={14} startDelay={2} />
    <RealClip name="gym4" total={120} width={260} height={360} rotate={-6} delay={16} label="EVERYONE" style={{ left: 20, top: 690 }} />
    <RealClip name="gym1" total={120} width={260} height={360} rotate={6} delay={30} label="ANY LEVEL" labelColor={C.blue} style={{ right: 20, top: 700 }} />
    <Mascot src="bomb-super.png" size={130} delay={30} style={{ left: 26, bottom: 220 }} />
    <Mascot src="bomb-special.png" size={130} delay={44} style={{ right: 26, bottom: 230 }} />
  </AbsoluteFill>
);
