// Mascot illustrations of the mascot performing each default-board exercise.
// Used to make the requested move instantly readable, alongside its name.
import pushupsAsset from "@/assets/ex/pushups.asset.json";
import situpsAsset from "@/assets/ex/situps.asset.json";
import squatsAsset from "@/assets/ex/squats.asset.json";
import jumpingJacksAsset from "@/assets/ex/jumping-jacks.asset.json";
import highKneesAsset from "@/assets/ex/high-knees.asset.json";
import jumpSquatsAsset from "@/assets/ex/jump-squats.asset.json";
import lunges from "@/assets/ex/lunges.png";
import mountainClimbers from "@/assets/ex/mountain-climbers.png";
import burpees from "@/assets/ex/burpees.png";
import plankUps from "@/assets/ex/plank-ups.png";
import pikePushups from "@/assets/ex/pike-pushups.png";
import crunches from "@/assets/ex/crunches.png";

/** Exact names first, keyword fallbacks after. */
const EXACT: Record<string, string> = {
  "jumping jacks": jumpingJacksAsset.url,
  "high knees": highKneesAsset.url,
  "sit-ups": situpsAsset.url,
  crunches: crunches,
  squats: squatsAsset.url,
  lunges: lunges,
  "push-ups": pushupsAsset.url,
  "mountain climbers": mountainClimbers,
  burpees: burpees,
  "plank-ups": plankUps,
  "jump squats": jumpSquatsAsset.url,
  "pike push-ups": pikePushups,
};

const KEYWORDS: [RegExp, string][] = [
  [/jumping ?jack|star jump/i, jumpingJacksAsset.url],
  [/high knee|sprint|run/i, highKneesAsset.url],
  [/sit-?up/i, situpsAsset.url],
  [/crunch/i, crunches],
  [/jump squat|squat jump/i, jumpSquatsAsset.url],
  [/squat/i, squatsAsset.url],
  [/lunge/i, lunges],
  [/pike/i, pikePushups],
  [/push-?up|pushup|dip/i, pushupsAsset.url],
  [/mountain climb|bear crawl|crab/i, mountainClimbers],
  [/burpee/i, burpees],
  [/plank|hold|wall sit/i, plankUps],
];

/** Illustration URL for an exercise, or null when we have no art for it. */
export function exerciseArt(exercise?: string | null): string | null {
  if (!exercise) return null;
  const key = exercise.trim().toLowerCase();
  if (EXACT[key]) return EXACT[key];
  for (const [re, url] of KEYWORDS) if (re.test(key)) return url;
  return null;
}
