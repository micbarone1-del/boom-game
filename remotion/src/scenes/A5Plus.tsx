import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { BODY, DISPLAY, Phone, Rays, Shock, useSpr } from "../components/kit";
import { Mascot } from "../components/Mascot";

export const A5Plus: React.FC = () => {
  const frame = useCurrentFrame();
  const t = useSpr(2, { damping: 200 });
  const shots = [
    { src: "21-boss-you-win.png", rot: -6, x: -230 },
    { src: "22-wrapup-leaderboard.png", rot: 5, x: 230 },
  ];
  return (
    <AbsoluteFill>
      <Rays x={540} y={1150} color={C.yellow} opacity={0.22} speed={0.4} count={26} />
      <Shock delay={4} x={540} y={1150} max={1800} color={C.red} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 110 }}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 96,
            color: C.ink,
            textShadow: `8px 8px 0 ${C.yellow}`,
            transform: `scale(${interpolate(t, [0, 1], [0.5, 1])}) rotate(-2deg)`,
            textAlign: "center",
            lineHeight: 0.95,
          }}
        >
          {"PLUS: BOSS FIGHTS\n& LEADERBOARDS"}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: BODY,
            fontWeight: 900,
            fontSize: 32,
            color: C.ink,
            background: C.cream,
            padding: "10px 26px",
            border: `5px solid ${C.ink}`,
            borderRadius: 16,
            boxShadow: `8px 8px 0 ${C.ink}`,
            opacity: t,
          }}
        >
          the extras — not extra steps
        </div>
      </AbsoluteFill>
      {shots.map((s, i) => {
        const sp = useSpr(8 + i * 10, { damping: 13, stiffness: 130 });
        return (
          <div
            key={s.src}
            style={{
              position: "absolute",
              left: 540 + s.x - 260,
              bottom: -180,
              transform: `translateY(${interpolate(sp, [0, 1], [900, Math.sin((frame + i * 20) / 24) * 10])}px) rotate(${s.rot}deg)`,
            }}
          >
            <Phone src={s.src} height={1000} />
          </div>
        );
      })}
      <Mascot src="boss-mascot.png" size={220} delay={16} style={{ left: 20, top: 620 }} />
      <Mascot src="bomb-boost.png" size={150} delay={30} style={{ right: 24, top: 640 }} />
    </AbsoluteFill>
  );
};
