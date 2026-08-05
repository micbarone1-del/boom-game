import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { DISPLAY, Kicker, Person, Phone, Pow, Rays, Shock, useSpr } from "../components/kit";

const beats = [
  { src: "17-boss-intro.png", from: 0, to: 40 },
  { src: "18-boss-wheel-spin.png", from: 40, to: 66 },
  { src: "19b-boss-attack.png", from: 66, to: 92 },
  { src: "20b-boss-shake.png", from: 92, to: 112 },
  { src: "21-boss-you-win.png", from: 112, to: 999 },
];

export const S10Boss: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = useSpr(2, { damping: 16, stiffness: 120 });
  const shakeAmt = interpolate(frame, [86, 112], [0, 24], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dying = frame >= 92 && frame < 112;
  const shake = dying ? Math.sin(frame * 3.1) * shakeAmt : Math.sin(frame * 1.4) * 3;
  const win = useSpr(112, { damping: 8, stiffness: 150 });
  const fighter = useSpr(8, { damping: 14, stiffness: 120 });
  const jab = Math.max(0, Math.sin(frame / 5)) * 34;
  return (
    <AbsoluteFill>
      <Rays x={540} y={1000} color={frame >= 112 ? C.yellow : C.red} opacity={frame >= 112 ? 0.3 : 0.18} speed={0.4} count={26} />
      {frame >= 92 && [0, 6, 12, 18].map((d) => <Shock key={d} delay={92 + d} x={380 + d * 30} y={900 + (d % 3) * 180} max={800} color={C.red} />)}
      {frame >= 112 && <Shock delay={112} x={540} y={1000} max={2200} color={C.yellow} />}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Kicker
          step="STEP 09"
          title="BEAT THE BOSS"
          sub="Spin the wheel, land special moves, smash the boss as a pod."
          color={C.red}
          align="center"
          size={76}
          style={{ padding: "0 70px" }}
        />
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: -60,
          display: "flex",
          justifyContent: "center",
          transform: `translate(${shake}px, ${-shake * 0.5}px) scale(${interpolate(enter, [0, 1], [0.8, 1])})`,
        }}
      >
        <div style={{ position: "relative", width: 620, height: 1340 }}>
          {beats.map((b) => {
            const o = interpolate(frame, [b.from - 5, b.from + 5, b.to - 5, b.to + 5], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (o <= 0.01) return null;
            return (
              <div key={b.src} style={{ position: "absolute", inset: 0, opacity: o }}>
                <Phone src={b.src} height={1340} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ position: "absolute", left: -110, bottom: -60, transform: `translateX(${interpolate(fighter, [0, 1], [-800, jab])}px)` }}>
        <Person src="punch.png" height={720} blob="#FFB3B3" blobScale={0.76} />
      </div>
      {frame >= 112 && (
        <div style={{ position: "absolute", right: -90, bottom: -60, transform: `translateY(${interpolate(win, [0, 1], [800, 0])}px)` }}>
          <Person src="cheer.png" height={680} />
        </div>
      )}
      <div style={{ position: "absolute", left: 40, top: 620 }}>
        <Pow text="POW!" color={C.yellow} size={62} delay={70} rotate={-10} />
      </div>
      {frame >= 116 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 560,
            textAlign: "center",
            fontFamily: DISPLAY,
            fontSize: 120,
            color: C.yellow,
            textShadow: `10px 10px 0 ${C.ink}`,
            transform: `rotate(-4deg) scale(${interpolate(win, [0, 1], [0.4, 1])})`,
          }}
        >
          YOU WIN!
        </div>
      )}
    </AbsoluteFill>
  );
};
