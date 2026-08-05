import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

export const DISPLAY = "'Luckiest Guy', system-ui";
export const BODY = "'Archivo', system-ui";

export const useSpr = (delay = 0, config: Parameters<typeof spring>[0]["config"] = { damping: 14, stiffness: 160 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
};

/** Chunky ink-bordered container with a hard offset shadow. */
export const Ink: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  radius?: number;
  bg?: string;
  shadow?: number;
}> = ({ children, style, radius = 28, bg = "#fff", shadow = 16 }) => (
  <div
    style={{
      background: bg,
      border: `6px solid ${C.ink}`,
      borderRadius: radius,
      boxShadow: `${shadow}px ${shadow}px 0 ${C.ink}`,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Phone mock. Height drives the size; aspect is locked to the captures. */
export const Phone: React.FC<{
  src: string;
  height: number;
  style?: React.CSSProperties;
  /** 0..1 vertical pan through a tall screenshot */
  pan?: number;
  aspect?: number;
}> = ({ src, height, style, pan, aspect = 780 / 1688 }) => {
  const width = height * aspect;
  return (
    <Ink radius={38} shadow={18} bg={C.ink} style={{ width, height, position: "relative", ...style }}>
      <Img
        src={staticFile(`shots/${src}`)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          ...(pan === undefined
            ? { height: "100%", objectFit: "cover", objectPosition: "top" }
            : { transform: `translateY(${-pan * 100}%)` }),
        }}
      />
    </Ink>
  );
};

/** Big-screen (desktop) mock, 16:10 captures. */
export const Screen: React.FC<{
  src: string;
  width: number;
  style?: React.CSSProperties;
  /** height / width of the visible crop (defaults to the full 16:10 capture) */
  ratio?: number;
}> = ({ src, width, style, ratio = 800 / 1280 }) => (
  <Ink radius={20} shadow={20} bg={C.ink} style={{ width, height: width * ratio, ...style }}>
    <Img
      src={staticFile(`shots/${src}`)}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  </Ink>
);

/** Step label: number chip + title + subtitle, wipe-revealed. */
export const Kicker: React.FC<{
  step?: string;
  title: string;
  sub?: string;
  delay?: number;
  color?: string;
  align?: "left" | "right";
  size?: number;
  style?: React.CSSProperties;
}> = ({ step, title, sub, delay = 0, color = C.yellow, align = "left", size = 92, style }) => {
  const frame = useCurrentFrame();
  const s = useSpr(delay, { damping: 200 });
  const s2 = useSpr(delay + 7, { damping: 200 });
  const drift = Math.sin((frame - delay) / 26) * 4;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "left" ? "flex-start" : "flex-end",
        gap: 14,
        transform: `translateY(${drift}px)`,
        ...style,
      }}
    >
      {step ? (
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: 30,
            letterSpacing: 2,
            color: C.ink,
            background: color,
            padding: "6px 20px 2px",
            border: `5px solid ${C.ink}`,
            borderRadius: 999,
            boxShadow: `8px 8px 0 ${C.ink}`,
            transform: `scale(${s}) rotate(-2.5deg)`,
            opacity: s,
          }}
        >
          {step}
        </div>
      ) : null}
      <div
        style={{
          clipPath: `inset(-20% ${(1 - s) * 100}% -30% 0)`,
          fontFamily: DISPLAY,
          fontSize: size,
          lineHeight: 0.95,
          color: C.ink,
          textShadow: `6px 6px 0 ${color}, 10px 10px 0 rgba(18,16,14,0.25)`,
          textAlign: align,
          maxWidth: 720,
          whiteSpace: "pre-line",
        }}
      >
        {title}
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: BODY,
            fontWeight: 700,
            fontSize: 30,
            color: C.ink,
            background: C.cream,
            padding: "8px 18px",
            border: `4px solid ${C.ink}`,
            borderRadius: 14,
            boxShadow: `7px 7px 0 ${C.ink}`,
            opacity: s2,
            transform: `translateX(${interpolate(s2, [0, 1], [align === "left" ? -40 : 40, 0])}px) rotate(1.2deg)`,
            maxWidth: 680,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** Comic-style speed rays radiating from a point. */
export const Rays: React.FC<{ x: number; y: number; color?: string; count?: number; speed?: number; opacity?: number }> = ({
  x,
  y,
  color = C.yellow,
  count = 18,
  speed = 0.25,
  opacity = 0.35,
}) => {
  const frame = useCurrentFrame();
  return (
    <svg
      style={{ position: "absolute", inset: 0, opacity }}
      viewBox="0 0 1920 1080"
      width={1920}
      height={1080}
    >
      <g transform={`rotate(${frame * speed} ${x} ${y})`}>
        {new Array(count).fill(0).map((_, i) => {
          const a = (i / count) * Math.PI * 2;
          const a2 = a + Math.PI / count / 1.6;
          const R = 2400;
          return (
            <path
              key={i}
              d={`M ${x} ${y} L ${x + Math.cos(a) * R} ${y + Math.sin(a) * R} L ${x + Math.cos(a2) * R} ${
                y + Math.sin(a2) * R
              } Z`}
              fill={color}
            />
          );
        })}
      </g>
    </svg>
  );
};

/** Expanding ink ring shockwave. */
export const Person: React.FC<{
  src: string;
  height: number;
  /** colored blob behind the person */
  blob?: string;
  blobScale?: number;
  flip?: boolean;
  style?: React.CSSProperties;
}> = ({ src, height, blob, blobScale = 0.86, flip, style }) => (
  <div style={{ position: "relative", height, display: "flex", alignItems: "flex-end", ...style }}>
    {blob ? (
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: height * blobScale,
          height: height * blobScale,
          marginLeft: (-height * blobScale) / 2,
          marginTop: (-height * blobScale) / 2,
          borderRadius: "50%",
          background: blob,
          border: `7px solid ${C.ink}`,
          boxShadow: `14px 14px 0 ${C.ink}`,
        }}
      />
    ) : null}
    <Img
      src={staticFile(`people/${src}`)}
      style={{
        position: "relative",
        height,
        width: "auto",
        objectFit: "contain",
        transform: flip ? "scaleX(-1)" : undefined,
        filter: `drop-shadow(0 18px 26px rgba(18,16,14,0.35))`,
      }}
    />
  </div>
);

/** Comic action word bubble. */
export const Pow: React.FC<{
  text: string;
  color?: string;
  size?: number;
  delay?: number;
  style?: React.CSSProperties;
  rotate?: number;
}> = ({ text, color = C.yellow, size = 62, delay = 0, style, rotate = -7 }) => {
  const s = useSpr(delay, { damping: 9, stiffness: 200 });
  if (s <= 0.001) return null;
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        fontSize: size,
        color: C.ink,
        background: color,
        padding: "12px 26px 6px",
        border: `6px solid ${C.ink}`,
        borderRadius: 20,
        boxShadow: `10px 10px 0 ${C.ink}`,
        transform: `rotate(${rotate}deg) scale(${interpolate(s, [0, 1], [0.3, 1])})`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {text}
    </div>
  );
};

export const Shock: React.FC<{ delay?: number; x?: number; y?: number; color?: string; max?: number }> = ({
  delay = 0,
  x = 960,
  y = 540,
  color = C.ink,
  max = 1400,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame < delay) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: max * t,
        height: max * t,
        marginLeft: (-max * t) / 2,
        marginTop: (-max * t) / 2,
        borderRadius: "50%",
        border: `${20 * (1 - t)}px solid ${color}`,
        opacity: 1 - t,
      }}
    />
  );
};