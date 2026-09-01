// Mascot illustrations of the mascot performing each default-board exercise.
// Used to make the requested move instantly readable, alongside its name.
import pushups from "@/assets/ex/pushups.png";
import situps from "@/assets/ex/situps.png";
import squats from "@/assets/ex/squats.png";
import jumpingJacks from "@/assets/ex/jumping-jacks.png";
import highKnees from "@/assets/ex/high-knees.png";
import jumpSquats from "@/assets/ex/jump-squats.png";
import lunges from "@/assets/ex/lunges.png";
import mountainClimbers from "@/assets/ex/mountain-climbers.png";
import burpees from "@/assets/ex/burpees.png";
import plankUps from "@/assets/ex/plank-ups.png";
import pikePushups from "@/assets/ex/pike-pushups.png";
import crunches from "@/assets/ex/crunches.png";
import spinBurpee from "@/assets/ex/spin-burpee.png";
import wheelPushup from "@/assets/ex/wheel-pushup.png";
import crabPushups from "@/assets/ex/crab-pushups.png";
import bearCrawlSquats from "@/assets/ex/bear-crawl-squats.png";
import frogJumpsPlank from "@/assets/ex/frog-jumps-plank.png";
import sideRollSitups from "@/assets/ex/side-roll-situps.png";
import donkeyKickPushups from "@/assets/ex/donkey-kick-pushups.png";
import inchwormBurpee from "@/assets/ex/inchworm-burpee.png";
import wallSit from "@/assets/ex/wall-sit.png";
import marching from "@/assets/ex/marching.png";

/** Exact names first, keyword fallbacks after. */
const EXACT: Record<string, string> = {
  "jumping jacks": jumpingJacks,
  "high knees": highKnees,
  "sit-ups": situps,
  crunches: crunches,
  squats: squats,
  lunges: lunges,
  "push-ups": pushups,
  "mountain climbers": mountainClimbers,
  burpees: burpees,
  "plank-ups": plankUps,
  "jump squats": jumpSquats,
  "pike push-ups": pikePushups,
  "spin & burpee": spinBurpee,
  "wheel & pushup": wheelPushup,
  "crab-walk pushups": crabPushups,
  "bear-crawl squats": bearCrawlSquats,
  "frog jumps & plank": frogJumpsPlank,
  "side-roll sit-ups": sideRollSitups,
  "donkey kick pushups": donkeyKickPushups,
  "inchworm burpee": inchwormBurpee,
  "air squats": squats,
  "wall sit": wallSit,
  "plank hold": plankUps,
  "marching in place": marching,
};

const KEYWORDS: [RegExp, string][] = [
  [/spin.*burpee/i, spinBurpee],
  [/wheel/i, wheelPushup],
  [/crab/i, crabPushups],
  [/bear.?crawl/i, bearCrawlSquats],
  [/frog/i, frogJumpsPlank],
  [/side.?roll/i, sideRollSitups],
  [/donkey/i, donkeyKickPushups],
  [/inchworm/i, inchwormBurpee],
  [/wall sit/i, wallSit],
  [/march/i, marching],
  [/jumping ?jack|star jump/i, jumpingJacks],
  [/high knee|sprint|run/i, highKnees],
  [/sit-?up/i, situps],
  [/crunch/i, crunches],
  [/jump squat|squat jump/i, jumpSquats],
  [/squat/i, squats],
  [/lunge/i, lunges],
  [/pike/i, pikePushups],
  [/push-?up|pushup|dip/i, pushups],
  [/mountain climb/i, mountainClimbers],
  [/burpee/i, burpees],
  [/plank|hold/i, plankUps],
];

/** Illustration URL for an exercise, or null when we have no art for it. */
export function exerciseArt(exercise?: string | null): string | null {
  if (!exercise) return null;
  const key = exercise.trim().toLowerCase();
  if (EXACT[key]) return EXACT[key];
  for (const [re, url] of KEYWORDS) if (re.test(key)) return url;
  return null;
}
