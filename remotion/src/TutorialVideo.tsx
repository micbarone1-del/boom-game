import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { C } from "./theme";
import { BODY, DISPLAY, Ink, Kicker, Pow, Rays, Shock, useSpr } from "./components/kit";
import { Mascot } from "./components/Mascot";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Full-bleed realistic footage, played back as a JPEG frame sequence
 * (the sandbox compositor cannot decode mp4 during a render).
 * After `cut` the footage drops into slow motion so the superimposed
 * explanation can be read.
 */
const Footage: React.FC<{ name: string; total: number; cut?: number; rate?: number; from?: number }> = ({
  name,
  total,
  cut = 9999,
  rate = 0.3,
  from = 0,
}) => {
  const frame = useCurrentFrame();
  const adv = frame < cut ? frame : cut + (frame - cut) * rate;
  const i = Math.min(total, Math.max(1, Math.floor(from + adv) + 1));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img
        src={staticFile(`frames/${name}/${String(i).padStart(4, "0")}.jpg`)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(18,16,14,0.6) 0%, rgba(18,16,14,0.05) 38%, rgba(18,16,14,0.72) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** App screenshot in a chunky arcade phone frame that pops in. */
const AppShot: React.FC<{
  src: string;
  height: number;
  delay?: number;
  rotate?: number;
  style?: React.CSSProperties;
}> = ({ src, height, delay = 0, rotate = -4, style }) => {
  const frame = useCurrentFrame();
  const p = useSpr(delay, { damping: 15, stiffness: 130 });
  if (p <= 0.001) return null;
  const float = Math.sin((frame - delay) / 26) * 8;
  return (
    <div
      style={{
        position: "absolute",
        transform: `translateY(${interpolate(p, [0, 1], [520, float])}px) scale(${interpolate(
          p,
          [0, 1],
          [0.7, 1],
        )}) rotate(${rotate}deg)`,
        opacity: p,
        ...style,
      }}
    >
      <Ink radius={34} shadow={18} bg={C.ink} style={{ height, width: height * (780 / 1688) }}>
        <Img
          src={staticFile(`shots/${src}`)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
        />
      </Ink>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 1. welcome — zoom on the home-screen icon                           */
/* ------------------------------------------------------------------ */

const TWelcome: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 70, 150], [1, 1.9, 2.15], { extrapolateRight: "clamp" });
  const px = interpolate(frame, [0, 70], [0, -60], { extrapolateRight: "clamp" });
  const py = interpolate(frame, [0, 70], [0, 210], { extrapolateRight: "clamp" });
  const glow = interpolate(frame, [46, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const title = useSpr(78, { damping: 200 });
  const sub = useSpr(94, { damping: 200 });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${px}px, ${py}px)` }}>
        <Img
          src={staticFile("shots/phone-homescreen.jpg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* BOOM icon replaces one of the grid slots and lights up */}
        <div
          style={{
            position: "absolute",
            left: 383,
            top: 812,
            width: 90,
            height: 90,
            borderRadius: 22,
            overflow: "hidden",
            background: C.yellow,
            boxShadow: `0 0 ${glow * 70}px ${glow * 26}px rgba(255,198,26,${glow * 0.9})`,
            transform: `scale(${1 + glow * 0.12})`,
          }}
        >
          <Img src={staticFile("mascots/app-icon.png")} style={{ width: "100%", height: "100%" }} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `rgba(18,16,14,${0.15 + glow * 0.45})` }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 190 }}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 132,
            lineHeight: 0.9,
            color: C.yellow,
            textShadow: `10px 10px 0 ${C.ink}`,
            opacity: title,
            transform: `scale(${interpolate(title, [0, 1], [0.6, 1])})`,
            textAlign: "center",
          }}
        >
          WELCOME{"\n"}TO BOOM!
        </div>
        <div
          style={{
            marginTop: 30,
            maxWidth: 860,
            textAlign: "center",
            fontFamily: BODY,
            fontWeight: 900,
            fontSize: 38,
            color: C.ink,
            background: C.cream,
            border: `6px solid ${C.ink}`,
            borderRadius: 18,
            padding: "14px 26px",
            boxShadow: `10px 10px 0 ${C.ink}`,
            opacity: sub,
            transform: `translateY(${interpolate(sub, [0, 1], [40, 0])}px) rotate(-1.2deg)`,
          }}
        >
          The first party workout game that makes fitness fun
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* 2. make a pod                                                       */
/* ------------------------------------------------------------------ */

const TPod: React.FC = () => {
  return (
    <AbsoluteFill>
      <Footage name="podform" total={361} cut={46} rate={0.35} />
      <Rays x={540} y={1400} color={C.blue} opacity={0.14} speed={-0.2} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 80 }}>
        <Kicker
          step="STEP 01"
          title={"MAKE A POD"}
          sub="2 to 4 players share one phone. Add names, pick your bombs."
          color={C.blue}
          align="center"
          size={92}
          style={{ padding: "0 60px" }}
        />
      </AbsoluteFill>
      <AppShot src="26-create-pod.png" height={980} delay={48} rotate={-5} style={{ left: 70, bottom: -120 }} />
      <div style={{ position: "absolute", right: 70, bottom: 420 }}>
        <Pow text="WE'RE IN!" color={C.blue} size={52} delay={70} rotate={7} />
      </div>
      <Mascot src="bomb-mascot.png" size={190} delay={58} style={{ right: 90, bottom: 120 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* 3. roll & hop                                                       */
/* ------------------------------------------------------------------ */

const TRoll: React.FC = () => {
  return (
    <AbsoluteFill>
      <Footage name="passreal" total={155} cut={40} rate={0.3} />
      <Rays x={540} y={300} color={C.yellow} opacity={0.14} speed={0.2} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 80 }}>
        <Kicker
          step="STEP 02"
          title={"ROLL & HOP"}
          sub="Tap to roll. Your bomb hops across the board."
          color={C.yellow}
          align="center"
          size={92}
          style={{ padding: "0 60px" }}
        />
      </AbsoluteFill>
      <AppShot src="07-pod-roll.png" height={900} delay={42} rotate={4} style={{ right: 60, bottom: -80 }} />
      <AppShot src="09-hop-zoom-token.png" height={720} delay={78} rotate={-7} style={{ left: 50, bottom: 60 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* 4. land on a trap                                                   */
/* ------------------------------------------------------------------ */

const TTrap: React.FC = () => {
  return (
    <AbsoluteFill>
      <Footage name="podreal" total={155} cut={34} rate={0.3} />
      <Shock delay={36} x={540} y={1100} max={1700} color={C.red} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 80 }}>
        <Kicker
          step="STEP 03"
          title={"LAND ON A TRAP"}
          sub="Every cell is a workout: reps, holds, group hits or VS duels."
          color={C.red}
          align="center"
          size={86}
          style={{ padding: "0 60px" }}
        />
      </AbsoluteFill>
      <AppShot src="07b-trap-announcement.png" height={980} delay={38} rotate={-4} style={{ left: 90, bottom: -120 }} />
      <div style={{ position: "absolute", right: 60, bottom: 520 }}>
        <Pow text="10 SQUAT JUMPS!" color={C.red} size={44} delay={62} rotate={8} />
      </div>
      <Mascot src="bomb-hard.png" size={200} delay={54} style={{ right: 80, bottom: 150 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* 5. pass the phone — the judge films you, you defuse                 */
/* ------------------------------------------------------------------ */

const TJudge: React.FC = () => {
  const frame = useCurrentFrame();

  const ring = useSpr(96, { damping: 12, stiffness: 150 });
  const reps = Math.min(10, Math.max(0, Math.floor((frame - 100) / 7)));
  return (
    <AbsoluteFill>
      <Footage name="press" total={240} cut={44} rate={0.35} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
        <Kicker
          step="STEP 04"
          title={"PASS & DEFUSE"}
          sub="Pass the phone: the next player films you and taps per rep. Finish before the fuse burns out."
          color={C.green}
          align="center"
          size={82}
          style={{ padding: "0 60px" }}
        />
      </AbsoluteFill>
      <AppShot src="10-switch-handoff.png" height={760} delay={46} rotate={-6} style={{ left: 50, bottom: 700 }} />
      <AppShot src="11-judge-camera.png" height={880} delay={70} rotate={5} style={{ right: 50, bottom: 330 }} />
      {/* live DEFUSE dial */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 120,
          marginLeft: -190,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: C.red,
          border: `12px solid ${C.ink}`,
          boxShadow: `16px 16px 0 ${C.ink}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${interpolate(ring, [0, 1], [0.2, 1]) * (1 + 0.03 * Math.sin(frame / 4))})`,
          opacity: ring,
        }}
      >
        <div style={{ fontFamily: DISPLAY, fontSize: 86, color: "#fff", textShadow: `6px 6px 0 ${C.ink}` }}>DEFUSE</div>
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 46, color: "#fff" }}>{reps} / 10</div>
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 24, color: "#fff", letterSpacing: 2 }}>TAP PER REP</div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* 6. boom logo end                                                    */
/* ------------------------------------------------------------------ */

const TEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = useSpr(2, { damping: 8, stiffness: 150 });
  const url = useSpr(24, { damping: 200 });
  const wob = Math.sin(frame / 9) * 1.6;
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center" }}>
      <Rays x={540} y={960} color={C.yellow} opacity={0.32} speed={0.6} count={26} />
      <Shock delay={0} x={540} y={960} max={2400} color={C.red} />
      <Shock delay={10} x={540} y={960} max={2000} color={C.yellow} />
      <Mascot src="bomb-super.png" size={300} delay={16} style={{ left: 70, bottom: 420 }} />
      <Mascot src="bomb-mascot.png" size={260} delay={22} style={{ right: 70, bottom: 460 }} />
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 240,
          color: C.yellow,
          textShadow: `14px 14px 0 ${C.red}, -5px -5px 0 #000`,
          transform: `scale(${interpolate(pop, [0, 1], [0.3, 1])}) rotate(${wob}deg)`,
        }}
      >
        BOOM!
      </div>
      <div
        style={{
          marginTop: 28,
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: 52,
          letterSpacing: 2,
          color: C.ink,
          background: C.yellow,
          padding: "14px 40px",
          border: `6px solid ${C.ink}`,
          borderRadius: 20,
          boxShadow: `12px 12px 0 ${C.red}`,
          opacity: url,
          transform: `translateY(${interpolate(url, [0, 1], [50, 0])}px) rotate(-1.5deg)`,
        }}
      >
        boomworkout.fun
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */

const T = 10;
const SCENES: { c: React.FC; d: number }[] = [
  { c: TWelcome, d: 150 },
  { c: TPod, d: 170 },
  { c: TRoll, d: 150 },
  { c: TTrap, d: 150 },
  { c: TJudge, d: 210 },
  { c: TEnd, d: 110 },
];

export const TUT_TOTAL = SCENES.reduce((a, s) => a + s.d, 0) - T * (SCENES.length - 1);

const timing = springTiming({ config: { damping: 200 }, durationInFrames: T });

export const TutorialVideo: React.FC = () => {
  const children: React.ReactNode[] = [];
  SCENES.forEach(({ c: Comp, d }, i) => {
    if (i > 0) {
      children.push(<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={timing} />);
    }
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={d}>
        <Comp />
      </TransitionSeries.Sequence>,
    );
  });
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
};
