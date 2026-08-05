import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_room_status",
  title: "Get game room status",
  description:
    "Look up a BOOM! game room by its 4-6 character room code and return its live status: phase, boss HP, pods and players with their scores.",
  inputSchema: {
    room_code: z.string().trim().describe("The room code shown on the gym screen, e.g. 'AB12'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ room_code }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const code = room_code.toUpperCase();
    const supabase = supabaseForUser(ctx);

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("code, status, phase, game_state, paused, boss_hp, boss_max_hp, boss_defeated_at, game_started_at, game_ends_at")
      .eq("code", code)
      .maybeSingle();
    if (roomError) return { content: [{ type: "text", text: roomError.message }], isError: true };
    if (!room)
      return { content: [{ type: "text", text: `No room found with code ${code}.` }], isError: true };

    const [{ data: pods }, { data: players }] = await Promise.all([
      supabase.from("pods").select("id, name, slot, score, current_space, status").eq("room_code", code).order("slot"),
      supabase
        .from("players")
        .select("username, pod_id, score, current_space, status, finish_rank")
        .eq("room_code", code),
    ]);

    const payload = { room, pods: pods ?? [], players: players ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});