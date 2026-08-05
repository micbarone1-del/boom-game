import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { DISPLAY, Kicker, Person, Phone, Pow, Rays, Shock, useSpr } from "../components/kit";

const beats: { src: string; from: number; to: number }[] = [
  { src: "17-boss-intro.png", from: 0, to: 44 },
  { src: "18-boss-wheel-spin.png", from: 44, to: 72 },
  { src: "19b-boss-attack.png", from: 72, to: 104 },
  { src: "20b-boss-shake.png", from: 104, to: 124 },
  { src: "21-boss-you-win.png", from: 124, to: 999 },
];

export const S7Boss: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = useSpr(2, { damping: 15, stiffness: 120 });
  // Boss shake ramps up before the kill, then a big pop on the win frame.
  const shakeAmt = interpolate(frame, [96, 124], [0, 26], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dying = frame >= 104 && frame < 124;
  const shake = dying ? Math.sin(frame * 3.1) * shakeAmt : Math.sin(frame * 1.4) * 3;
  const win = useSpr(124, { damping: 8, stiffness: 150 });
  const winScale = frame >= 124 ? interpolate(win, [0, 1], [0.75, 1.06]) : 1;
  const fighter = useSpr(8, { damping: 14, stiffness: 120 });
  const jab = Math.max(0, Math.sin(frame / 5)) * 40;
  return (
    <AbsoluteFill>
      <Rays x={960} y={560} color={frame >= 124 ? C.yellow : C.red} opacity={frame >= 124 ? 0.34 : 0.2} speed={0.4} count={26} />
      {frame >= 104 &&
        [0, 6, 12, 18, 24].map((d) => <Shock key={d} delay={104 + d} x={760 + d * 34} y={420 + (d % 3) * 160} max={900} color={C.red} />)}
      {frame >= 124 && <Shock delay={124} max={2400} color={C.yellow} />}
      <div
        style={{
          position: "absolute",
          left: 40,
          bottom: -20,
          transform: `translateX(${interpolate(fighter, [0, 1], [-700, jab])}px)`,
        }}
      >
        <Person src="punch.png" height={700} blob="#FFB3B3" blobScale={0.8} />
      </div>
      {frame >= 124 && (
        <div
          style={{ position: "absolute", right: 60, bottom: -20, transform: `translateY(${interpolate(win, [0, 1], [700, 0])}px)` }}
        >
          <Person src="cheer.png" height={600} />
        </div>
      )}
      <div style={{ position: "absolute", left: 580, top: 460 }}>
        <Pow text="POW!" color={C.yellow} size={70} delay={78} rotate={-10} />
      </div>
      <AbsoluteFill style={{ alignItems: "flex-start", paddingTop: 70, paddingLeft: 110 }}>
        <Kicker step="STEP 05" title={"BEAT THE\nBOSS"} sub="Spin the wheel, land special moves, and the whole pod smashes the boss together." color={C.red} size={80} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${shake}px, ${-shake * 0.6}px) scale(${interpolate(enter, [0, 1], [0.7, 1]) * winScale})`,
        }}
      >
        {beats.map((b) => {
          const o = interpolate(frame, [b.from - 5, b.from + 5, b.to - 5, b.to + 5], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          if (o <= 0.01) return null;
          return (
            <AbsoluteFill key={b.src} style={{ alignItems: "center", justifyContent: "center", opacity: o, marginTop: 40 }}>
              <Phone src={b.src} height={760} />
            </AbsoluteFill>
          );
        })}
      </AbsoluteFill>
      {frame >= 128 && (
        <div
          style={{
            position: "absolute",
            right: 90,
            bottom: 90,
            fontFamily: DISPLAY,
            fontSize: 130,
            color: C.yellow,
            textShadow: `10px 10px 0 ${C.ink}`,
            transform: `rotate(-6deg) scale(${interpolate(win, [0, 1], [0.4, 1])})`,
          }}
        >
          YOU WIN!
        </div>
      )}
    </AbsoluteFill>
  );
};