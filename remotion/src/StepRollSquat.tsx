import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const ink = "#15110e";
const yellow = "#ffd31a";
const cream = "#fff8dc";
const pink = "#ec4899";
const blue = "#22c8e5";

const chunky: React.CSSProperties = {
  fontFamily: "Luckiest Guy, Impact, sans-serif",
  letterSpacing: 0,
  color: ink,
};

const TrapReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 8, stiffness: 220 } });
  const shake = frame > 4 && frame < 15 ? Math.sin(frame * 2.7) * 8 : 0;
  const rays = interpolate(frame, [0, 24], [0, 18]);
  return (
    <AbsoluteFill style={{ background: "rgba(15,13,10,0.86)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: -280, transform: `rotate(${rays}deg)`, opacity: 0.34 }}>
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: "50%", top: "50%", width: 14, height: 1100, background: i % 2 ? yellow : "#fff", transformOrigin: "7px 0", transform: `rotate(${i * 20}deg)` }} />
        ))}
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: `translateX(${shake}px) scale(${0.55 + pop * 0.45})` }}>
        <div style={{ width: 610, height: 820, border: `10px solid ${ink}`, borderRadius: 44, background: yellow, boxShadow: `18px 18px 0 ${ink}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "42px 34px 38px" }}>
          <div style={{ ...chunky, color: "#fff", fontSize: 82, lineHeight: 0.9, WebkitTextStroke: `5px ${ink}`, paintOrder: "stroke fill" }}>EASY PEASY!</div>
          <Img src={staticFile("step-roll/squats.png")} style={{ width: 560, height: 490, objectFit: "contain", marginTop: 12, filter: "drop-shadow(0 12px 0 rgba(0,0,0,.25))" }} />
          <div style={{ width: "88%", background: "#fff", border: `8px solid ${ink}`, borderRadius: 30, boxShadow: `10px 10px 0 ${ink}`, textAlign: "center", padding: "18px 12px 12px" }}>
            <div style={{ ...chunky, fontSize: 92, lineHeight: 0.95 }}>SQUATS</div>
            <div style={{ ...chunky, fontFamily: "Archivo, Arial, sans-serif", fontSize: 36, fontWeight: 900, marginTop: 8 }}>12 REPS</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Token: React.FC<{ color: string; label: string; name: string; blind?: boolean }> = ({ color, label, name, blind }) => (
  <div style={{ width: 248, textAlign: "center" }}>
    <div style={{ width: 218, height: 218, margin: "0 auto", borderRadius: "50%", border: `9px solid ${ink}`, background: color, boxShadow: `10px 10px 0 ${ink}`, display: "grid", placeItems: "center", position: "relative" }}>
      <div style={{ width: 170, height: 170, borderRadius: "50%", border: `6px solid ${ink}`, background: "rgba(255,255,255,.16)", display: "grid", placeItems: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: 36, left: 40, width: 18, height: 25, borderRadius: 20, background: ink }} />
        <div style={{ position: "absolute", top: 36, right: 40, width: 18, height: 25, borderRadius: 20, background: ink }} />
        {blind ? <div style={{ width: 125, height: 28, borderRadius: 20, background: ink }} /> : <div style={{ position: "absolute", top: 91, width: 76, height: 38, borderBottom: `9px solid ${ink}`, borderRadius: "0 0 60px 60px" }} />}
        <div style={{ position: "absolute", top: -38, width: 34, height: 50, border: `7px solid ${ink}`, borderRadius: "12px 12px 4px 4px", background: "#3d3530" }} />
        <div style={{ position: "absolute", top: -55, right: 54, width: 22, height: 28, borderRadius: "50%", background: yellow, border: `5px solid ${ink}` }} />
      </div>
    </div>
    <div style={{ ...chunky, fontSize: 34, marginTop: 25 }}>{label}</div>
    <div style={{ ...chunky, fontSize: 51, marginTop: 6 }}>{name}</div>
  </div>
);

const SwitchScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 15, stiffness: 180 } });
  const count = frame < 12 ? 3 : frame < 24 ? 2 : 1;
  return (
    <AbsoluteFill style={{ background: "#fff", padding: 26 }}>
      <div style={{ position: "absolute", inset: 15, border: `10px solid ${ink}`, borderRadius: 46 }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${0.93 + enter * 0.07})` }}>
        <Img src={staticFile("step-roll/squats.png")} style={{ width: 490, height: 430, objectFit: "contain", marginTop: -18, filter: "drop-shadow(0 10px 0 rgba(0,0,0,.22))" }} />
        <div style={{ ...chunky, fontSize: 62, color: yellow, WebkitTextStroke: `4px ${ink}`, paintOrder: "stroke fill", lineHeight: 1 }}>EASY PEASY!</div>
        <div style={{ marginTop: 18, padding: "16px 52px 10px", background: "#fff", border: `8px solid ${ink}`, borderRadius: 28, boxShadow: `10px 10px 0 ${ink}`, textAlign: "center" }}>
          <div style={{ ...chunky, fontSize: 67, lineHeight: 0.95 }}>SQUATS</div>
          <div style={{ ...chunky, fontFamily: "Archivo, Arial, sans-serif", fontWeight: 900, fontSize: 31, marginTop: 10 }}>12 REPS</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 44, marginTop: 74 }}>
          <Token color={pink} label="PLAYER" name="SAM" />
          <div style={{ ...chunky, fontSize: 96, width: 108, height: 108, border: `7px solid ${ink}`, borderRadius: 24, background: yellow, boxShadow: `8px 8px 0 ${ink}`, display: "grid", placeItems: "center" }}>→</div>
          <Token color={blue} label="JUDGE" name="LEO" blind />
        </div>
        <div style={{ ...chunky, color: "#ed1c2e", fontSize: 100, width: 210, height: 190, border: "8px solid #ed1c2e", borderRadius: 32, boxShadow: `10px 10px 0 ${ink}`, display: "grid", placeItems: "center", marginTop: 65 }}>{count}</div>
        <div style={{ ...chunky, fontSize: 47, marginTop: 70 }}>PASS THE PHONE TO LEO</div>
      </div>
    </AbsoluteFill>
  );
};

export const StepRollSquat: React.FC = () => (
  <AbsoluteFill style={{ background: cream }}>
    <Sequence durationInFrames={90}>
      <RollFrames />
    </Sequence>
    <Sequence from={90} durationInFrames={24}><TrapReveal /></Sequence>
    <Sequence from={114} durationInFrames={36}><SwitchScreen /></Sequence>
  </AbsoluteFill>
);

const RollFrames: React.FC = () => {
  const frame = useCurrentFrame();
  const index = Math.min(90, Math.max(1, frame + 1));
  return <Img src={staticFile(`step-roll/frames/${String(index).padStart(4, "0")}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
};