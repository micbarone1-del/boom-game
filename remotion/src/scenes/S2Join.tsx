import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Kicker, Phone, Rays, useSpr } from "../components/kit";

export const S2Join: React.FC = () => {
  const frame = useCurrentFrame();
  const p = useSpr(6, { damping: 16, stiffness: 120 });
  const float = Math.sin(frame / 24) * 10;
  return (
    <AbsoluteFill>
      <Rays x={1420} y={540} color={C.blue} opacity={0.18} speed={-0.18} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 130px", gap: 60 }}>
        <Kicker step="STEP 01" title={"JOIN IN\nONE TAP"} sub="Google, phone number or guest nickname — scan the QR and you're in the pod." />
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              transform: `translateY(${interpolate(p, [0, 1], [700, float])}px) rotate(${interpolate(p, [0, 1], [12, -3])}deg)`,
            }}
          >
            <Phone src="06-join-phone.png" height={860} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};