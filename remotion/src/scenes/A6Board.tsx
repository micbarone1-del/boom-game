import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { BODY, DISPLAY, Kicker, Phone, Rays, useSpr } from "../components/kit";
import { Mascot } from "../components/Mascot";
import { RealPhoto } from "../components/RealPhoto";

const Tag: React.FC<{ text: string; color: string; delay: number; style?: React.CSSProperties }> = ({
  text,
  color,
  delay,
  style,
}) => {
  const s = useSpr(delay, { damping: 11, stiffness: 170 });
  if (s <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        fontFamily: DISPLAY,
        fontSize: 44,
        color: C.ink,
        background: color,
        border: `6px solid ${C.ink}`,
        borderRadius: 999,
        padding: "10px 30px 4px",
        boxShadow: `10px 10px 0 ${C.ink}`,
        transform: `scale(${s}) rotate(-3deg)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/** Wrap-up: final leaderboard + shareable recap video. */
export const A6Board: React.FC = () => {
  const frame = useCurrentFrame();
  const a = useSpr(6, { damping: 15, stiffness: 110 });
  const b = useSpr(20, { damping: 15, stiffness: 110 });
  const c = useSpr(34, { damping: 15, stiffness: 110 });
  return (
    <AbsoluteFill>
      <Rays x={540} y={1150} color={C.yellow} opacity={0.2} speed={0.3} count={24} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 60 }}>
        <Kicker
          title={"LEADERBOARD\n+ SHARE YOUR RECAP"}
          sub="Every game ends with a ranking and a shareable recap video."
          color={C.yellow}
          align="center"
          size={66}
          style={{ padding: "0 60px" }}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 24,
          bottom: 40,
          transform: `translateY(${interpolate(a, [0, 1], [1200, Math.sin(frame / 25) * 8])}px) rotate(-4deg)`,
        }}
      >
        <Phone src="22-wrapup-leaderboard.png" height={1080} aspect={0.46} />
      </div>
      <div
        style={{
          position: "absolute",
          right: 18,
          bottom: 70,
          transform: `translateY(${interpolate(b, [0, 1], [1200, -Math.sin(frame / 25) * 8])}px) rotate(5deg)`,
        }}
      >
        <Phone src="23-recap-video-sharing.png" height={1010} aspect={796 / 1632} />
      </div>
      <Tag text="RANKED" color={C.green} delay={14} style={{ left: 50, top: 660 }} />
      <RealPhoto
        src="real2.jpg"
        width={420}
        height={330}
        rotate={-2}
        delay={10}
        label="REAL CREW"
        labelColor={C.red}
        style={{ left: 330, top: 470 }}
      />
      <Tag text="SHARE IT" color={C.blue} delay={26} style={{ right: 50, top: 730 }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 34,
          textAlign: "center",
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: 30,
          color: C.ink,
          opacity: c,
        }}
      />
      <Mascot src="bomb-boost.png" size={150} delay={22} style={{ left: 24, top: 940 }} />
      <Mascot src="bomb-mascot.png" size={150} delay={40} style={{ right: 26, top: 1000 }} />
    </AbsoluteFill>
  );
};
