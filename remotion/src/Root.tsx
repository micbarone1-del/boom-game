import React from "react";
import { Composition } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/LuckiestGuy";
import { loadFont as loadBody } from "@remotion/google-fonts/Archivo";
import { MainVideo, TOTAL } from "./MainVideo";

loadDisplay("normal", { weights: ["400"], subsets: ["latin"] });
loadBody("normal", { weights: ["700", "800", "900"], subsets: ["latin"] });

export const RemotionRoot: React.FC = () => (
  <Composition id="main" component={MainVideo} durationInFrames={TOTAL} fps={30} width={1920} height={1080} />
);