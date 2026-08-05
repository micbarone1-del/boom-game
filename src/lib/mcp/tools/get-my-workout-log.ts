import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_workout_log",
  title: "Get my workout log",
  description:
    "List the exercises the signed-in player performed in BOOM! games, newest first, with reps, unit and whether the judge verified the form.",
  inputSchema: {
    limit: z.number().int().describe("How many exercise entries to return (1-100, default 20).").optional(),
    room_code: z.string().trim().describe("Optional room code to filter to a single game.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, room_code }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const take = Math.min(Math.max(limit ?? 20, 1), 100);
    const supabase = supabaseForUser(ctx);

    const { data: playerRows, error: playerError } = await supabase
      .from("players")
      .select("id, room_code")
      .eq("user_id", ctx.getUserId()!);
    if (playerError) return { content: [{ type: "text", text: playerError.message }], isError: true };

    const ids = (playerRows ?? [])
      .filter((row) => !room_code || row.room_code === room_code.toUpperCase())
      .map((row) => row.id);
    if (ids.length === 0)
      return { content: [{ type: "text", text: "No workout entries found for this player." }] };

    const { data, error } = await supabase
      .from("workout_logs")
      .select("exercise_name, target_reps, unit, time_taken_ms, verified_by_judge, room_code, created_at")
      .in("player_id", ids)
      .order("created_at", { ascending: false })
      .limit(take);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const entries = data ?? [];
    return {
      content: [
        { type: "text", text: entries.length ? JSON.stringify(entries) : "No workout entries found." },
      ],
      structuredContent: { entries },
    };
  },
});