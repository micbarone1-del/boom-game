import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_game_history",
  title: "Get my game history",
  description:
    "List the signed-in player's most recent BOOM! game results, newest first, with room code, score and finish rank.",
  inputSchema: {
    limit: z.number().int().describe("How many recent games to return (1-50, default 10).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const take = Math.min(Math.max(limit ?? 10, 1), 50);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("game_results")
      .select("room_code, score, finish_rank, username, created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(take);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const games = data ?? [];
    return {
      content: [
        {
          type: "text",
          text: games.length
            ? JSON.stringify(games)
            : "No recorded games yet for this player.",
        },
      ],
      structuredContent: { games },
    };
  },
});