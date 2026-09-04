import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { C } from "./theme";
import { BODY, DISPLAY, useSpr } from "./components/kit";

/* ------------------------------------------------------------------ *
 * One continuous team-to-game tutorial built from the supplied realistic
 * footage and current app captures. Only instructional captions and genuine
 * app screens are superimposed, keeping the mechanics easy to follow.
 * ------------------------------------------------------------------ */

/** Full-bleed real footage (JPEG sequence — the compositor can't decode mp4). */
const Clip: React.FC<{ name: string; total: number; from?: number; rate?: number }> = ({
  name,
  total,
  from = 0,
  rate = 1,
}) => {
  const frame = useCurrentFrame();
  const i = Math.min(total, Math.max(1, Math.floor(from + frame * rate) + 1));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Img
        src={staticFile(`frames/${name}/${String(i).padStart(4, "0")}.jpg`)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </AbsoluteFill>
  );
};

/** Real app screen recording, shown whole (never cropped). */
const AppClip: React.FC<{ name: string; total: number; from?: number; rate?: number }> = ({
  name,
  total,
  from = 0,
  rate = 1,
}) => {
  const frame = useCurrentFrame();
  const i = Math.min(total, Math.max(1, Math.floor(from + frame * rate) + 1));
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "flex-start", paddingTop: 60 }}>
      <div
        style={{
          height: 1390,
          border: `8px solid #000`,
          borderRadius: 28,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <Img
          src={staticFile(`frames/${name}/${String(i).padStart(4, "0")}.jpg`)}
          style={{ height: "100%", width: "auto", display: "block" }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Static app screenshot, shown whole. */
const AppStill: React.FC<{ src: string }> = ({ src }) => (
  <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "flex-start", paddingTop: 60 }}>
    <div style={{ height: 1390, border: `8px solid #000`, borderRadius: 28, overflow: "hidden", background: "#000" }}>
      <Img src={staticFile(`shots/${src}`)} style={{ height: "100%", width: "auto", display: "block" }} />
    </div>
  </AbsoluteFill>
);

/** A current app screenshot floating over realistic footage. */
const AppOverlay: React.FC<{ src: string }> = ({ src }) => {
  const a = useSpr(10, { damping: 200 });
  return (
    <div
      style={{
        position: "absolute",
        top: 84,
        right: 48,
        height: 920,
        border: `8px solid ${C.ink}`,
        borderRadius: 28,
        overflow: "hidden",
        background: C.ink,
        boxShadow: `12px 12px 0 ${C.ink}`,
        opacity: a,
        transform: `translateY(${interpolate(a, [0, 1], [70, 0])}px) rotate(2deg)`,
      }}
    >
      <Img src={staticFile(`shots/${src}`)} style={{ height: "100%", width: "auto", display: "block" }} />
    </div>
  );
};

/** One clean caption band at the bottom. */
const Caption: React.FC<{ step?: string; title: string; sub: string; color?: string }> = ({
  step,
  title,
  sub,
  color = C.yellow,
}) => {
  const a = useSpr(4, { damping: 200 });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "0 44px 70px" }}>
      <div
        style={{
          width: "100%",
          background: C.cream,
          border: `8px solid ${C.ink}`,
          borderRadius: 26,
          boxShadow: `12px 12px 0 ${C.ink}`,
          padding: "26px 34px 30px",
          opacity: a,
          transform: `translateY(${interpolate(a, [0, 1], [70, 0])}px)`,
        }}
      >
        {step ? (
          <div
            style={{
              display: "inline-block",
              fontFamily: DISPLAY,
              fontSize: 30,
              letterSpacing: 2,
              color: C.ink,
              background: color,
              border: `5px solid ${C.ink}`,
              borderRadius: 999,
              padding: "6px 20px 2px",
              marginBottom: 12,
            }}
          >
            {step}
          </div>
        ) : null}
        <div style={{ fontFamily: DISPLAY, fontSize: 74, lineHeight: 0.98, color: C.ink }}>{title}</div>
        <div style={{ marginTop: 12, fontFamily: BODY, fontWeight: 800, fontSize: 36, lineHeight: 1.2, color: C.ink }}>
          {sub}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* end ---------------------------------------------------------------- */

const TEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = useSpr(2, { damping: 9, stiffness: 150 });
  const url = useSpr(26, { damping: 200 });
  const flash = interpolate(frame, [0, 8, 22], [1, 0.35, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: C.yellow, opacity: flash }} />
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 250,
          color: C.yellow,
          textShadow: `14px 14px 0 ${C.red}`,
          transform: `scale(${interpolate(pop, [0, 1], [0.3, 1])})`,
        }}
      >
        BOOM!
      </div>
      <div
        style={{
          marginTop: 30,
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: 54,
          letterSpacing: 2,
          color: C.ink,
          background: C.yellow,
          padding: "14px 42px",
          border: `7px solid ${C.ink}`,
          borderRadius: 20,
          boxShadow: `12px 12px 0 ${C.red}`,
          opacity: url,
          transform: `translateY(${interpolate(url, [0, 1], [50, 0])}px)`,
        }}
      >
        boomworkout.fun
      </div>
    </AbsoluteFill>
  );
};

/* scenes -------------------------------------------------------------- */

const TPodReal: React.FC = () => (
  <AbsoluteFill>
    <Clip name="press" total={240} rate={0.85} />
    <AppOverlay src="26-create-pod.png" />
    <Caption
      step="STEP 1"
      title="MAKE A POD"
      sub="2 to 4 players, one phone. Add everyone's name and pick your bomb."
      color={C.blue}
    />
  </AbsoluteFill>
);

const TRoll: React.FC = () => (
  <AbsoluteFill>
    <AppClip name="roll" total={120} rate={0.8} />
    <Caption step="STEP 2" title="ROLL THE DICE" sub="On your turn, tap the dice to roll." />
  </AbsoluteFill>
);

const THop: React.FC = () => (
  <AbsoluteFill>
    <AppClip name="hop" total={102} rate={0.8} />
    <Caption title="YOUR BOMB HOPS" sub="It hops along the board and the cell it lands on decides your workout." />
  </AbsoluteFill>
);

const TTrap: React.FC = () => (
  <AbsoluteFill>
    <AppClip name="trap" total={108} rate={0.85} />
    <Caption
      step="STEP 3"
      title="LAND ON A TRAP"
      sub="The trap shows the exercise and the reps you have to do."
      color={C.red}
    />
  </AbsoluteFill>
);

const TSwitch: React.FC = () => (
  <AbsoluteFill>
    <AppClip name="switch" total={66} rate={0.7} />
    <Caption
      step="STEP 4"
      title="PASS THE PHONE"
      sub="The next player becomes the judge and films your form."
      color={C.green}
    />
  </AbsoluteFill>
);

const TJudgeKid: React.FC = () => (
  <AbsoluteFill>
    <Clip name="defuse" total={240} from={0} rate={0.72} />
    <Caption title="THE JUDGE FILMS & COUNTS" sub="Keep the player in view and tap DEFUSE once for every completed rep." color={C.green} />
  </AbsoluteFill>
);

const TDefuse: React.FC = () => (
  <AbsoluteFill>
    <AppClip name="judge" total={255} from={75} rate={0.72} />
    <Caption
      step="STEP 5"
      title="DEFUSE THE BOMB"
      sub="The judge taps DEFUSE once per rep. Finish before the fuse burns out — or BOOM."
      color={C.red}
    />
  </AbsoluteFill>
);

const TBoss: React.FC = () => (
  <AbsoluteFill>
    <AppStill src="18-boss-wheel-spin.png" />
    <Caption step="STEP 6" title="BEAT THE BOSS" sub="Reach the end and the whole pod fights the boss together." />
  </AbsoluteFill>
);

const TBoard: React.FC = () => (
  <AbsoluteFill>
    <AppStill src="22-wrapup-leaderboard.png" />
    <Caption title="SCORES & RECAPS" sub="Points, leaderboard and your video highlights to share." color={C.blue} />
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ */

const T = 9;
const SCENES: { c: React.FC; d: number }[] = [
  { c: TPodReal, d: 145 },
  { c: TRoll, d: 105 },
  { c: THop, d: 105 },
  { c: TTrap, d: 115 },
  { c: TSwitch, d: 100 },
  { c: TJudgeKid, d: 145 },
  { c: TDefuse, d: 150 },
  { c: TBoss, d: 95 },
  { c: TBoard, d: 95 },
  { c: TEnd, d: 95 },
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
