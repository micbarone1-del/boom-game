import React from "react";
import { Composition } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/LuckiestGuy";
import { loadFont as loadBody } from "@remotion/google-fonts/Archivo";
import { MainVideo, TOTAL } from "./MainVideo";
import { TutorialVideo, TUT_TOTAL } from "./TutorialVideo";
import { StepRollSquat } from "./StepRollSquat";

loadDisplay("normal", { weights: ["400"], subsets: ["latin"] });
loadBody("normal", { weights: ["700", "800", "900"], subsets: ["latin"] });

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="main" component={MainVideo} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="tutorial" component={TutorialVideo} durationInFrames={TUT_TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="step-roll-squat" component={StepRollSquat} durationInFrames={150} fps={30} width={720} height={1560} />
  </>
);