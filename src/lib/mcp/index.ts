import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getLeaderboardTool from "./tools/get-leaderboard";
import getMyGameHistoryTool from "./tools/get-my-game-history";
import getMyProfileTool from "./tools/get-my-profile";
import getMyWorkoutLogTool from "./tools/get-my-workout-log";
import getRoomStatusTool from "./tools/get-room-status";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "boom",
  title: "Boom!",
  version: "0.1.0",
  instructions:
    "Tools for BOOM!, a real-time multiplayer party-fitness game. Read the signed-in player's profile, game history and workout log, check the global leaderboard, and look up the live status of a game room by its code.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getMyProfileTool,
    getMyGameHistoryTool,
    getMyWorkoutLogTool,
    getLeaderboardTool,
    getRoomStatusTool,
  ],
});