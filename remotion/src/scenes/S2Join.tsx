import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Person, Phone, Pow, Rays, useSpr } from "../components/kit";

export const S2Join: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useSpr(6, { damping: 16, stiffness: 120 });
  const float = Math.sin(frame / 24) * 10;
  return (
    <AbsoluteFill>
      <Rays x={1420} y={540} color={C.blue} opacity={0.18} speed={-0.18} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px", gap: 40 }}>
        <Kicker step="STEP 01" title={"JOIN IN\nONE TAP"} sub="Google, phone number or guest nickname — scan the QR and you're in the pod." size={78} />
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-end", position: "relative" }}>
          <div
            style={{
              position: "relative",
              transform: `translateY(${interpolate(p, [0, 1], [700, float])}px)`,
            }}
          >
            <Person src="join.png" height={800} blob="#BFE8FF" blobScale={0.82} />
            <div style={{ position: "absolute", top: 40, right: -60 }}>
              <Pow text="I'M IN!" color={C.blue} size={48} delay={20} rotate={8} />
            </div>
            <div style={{ position: "absolute", bottom: 0, left: -110, transform: "rotate(-6deg)" }}>
              <Phone src="06-join-phone.png" height={330} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};