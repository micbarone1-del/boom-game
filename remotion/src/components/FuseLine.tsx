import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { BODY } from "./kit";

const Y = 1806;
const X0 = 70;
const X1 = 900;

/** Persistent burning fuse pinned to the bottom of the whole video. */
export const FuseLine: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const frame = useCurrentFrame();
  if (frame < start - 10) return null;
  const p = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(p, [0, 1], [X0, X1]);
  const appear = interpolate(frame, [start - 10, start + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flick = 1 + Math.sin(frame / 3) * 0.12;
  const panic = p > 0.82 ? Math.sin(frame * 2.2) * (p - 0.82) * 40 : 0;
  const blown = frame > end;
  return (
    <AbsoluteFill style={{ opacity: appear, pointerEvents: "none" }}>
      {/* burnt track */}
      <div style={{ position: "absolute", left: X0, top: Y - 5, width: X1 - X0, height: 12, background: "rgba(18,16,14,0.22)", borderRadius: 999 }} />
      {/* remaining rope */}
      {!blown && (
        <div
          style={{
            position: "absolute",
            left: x,
            top: Y - 9,
            width: Math.max(0, X1 - x),
            height: 20,
            background: `repeating-linear-gradient(90deg, ${C.ink} 0 14px, #4a3f33 14px 26px)`,
            borderRadius: 999,
          }}
        />
      )}
      {/* flame */}
      {!blown && (
        <div style={{ position: "absolute", left: x - 40, top: Y - 78, transform: `translateX(${panic}px) scale(${flick})` }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50% 50% 50% 10%",
              background: `radial-gradient(circle at 50% 65%, #FFF3B0 0%, ${C.yellow} 40%, ${C.red} 80%)`,
              transform: "rotate(-45deg)",
              boxShadow: `0 0 46px ${C.yellow}`,
            }}
          />
        </div>
      )}
      {/* bomb at the end */}
      <div style={{ position: "absolute", left: X1 - 20, top: Y - 118, transform: `scale(${1 + (p > 0.7 ? Math.sin(frame / 4) * 0.06 : 0)})` }}>
        <Img src={staticFile("mascots/bomb-mascot.png")} style={{ width: 190, height: 190, objectFit: "contain" }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: X0,
          top: Y - 74,
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: 26,
          letterSpacing: 2,
          color: C.ink,
          background: p > 0.82 ? C.red : C.cream,
          padding: "6px 16px",
          border: `4px solid ${C.ink}`,
          borderRadius: 12,
          boxShadow: `5px 5px 0 ${C.ink}`,
          opacity: blown ? 0 : 1,
        }}
      >
        {p > 0.82 ? "FUSE ALMOST OUT!" : "THE FUSE IS BURNING"}
      </div>
    </AbsoluteFill>
  );
};

/** Full-screen blast that fires when the fuse reaches the bomb. */
export const FinalBlast: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const t = frame - at;
  const flash = interpolate(t, [0, 4, 16], [0, 1, 0], { extrapolateRight: "clamp" });
  const ring = interpolate(t, [0, 26], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 60%, #FFF7D6 0%, ${C.yellow} 35%, ${C.red} 70%, transparent 100%)`, opacity: flash }} />
      <div
        style={{
          position: "absolute",
          left: 540 - (2600 * ring) / 2,
          top: 1200 - (2600 * ring) / 2,
          width: 2600 * ring,
          height: 2600 * ring,
          borderRadius: "50%",
          border: `${34 * (1 - ring)}px solid ${C.ink}`,
          opacity: 1 - ring,
        }}
      />
    </AbsoluteFill>
  );
};
