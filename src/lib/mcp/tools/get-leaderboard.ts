import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_leaderboard",
  title: "Get the global leaderboard",
  description:
    "Get the BOOM! global leaderboard: top players ranked by lifetime score, with games finished.",
  inputSchema: {
    limit: z.number().int().describe("How many players to return (1-50, default 10).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const take = Math.min(Math.max(limit ?? 10, 1), 50);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .select("username, lifetime_score, games_finished, fitness_level")
      .order("lifetime_score", { ascending: false })
      .limit(take);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const leaderboard = (data ?? []).map((row, index) => ({ rank: index + 1, ...row }));
    return {
      content: [{ type: "text", text: JSON.stringify(leaderboard) }],
      structuredContent: { leaderboard },
    };
  },
});