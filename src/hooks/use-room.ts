import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Trap } from "@/lib/game";

export type Room = {
  code: string;
  host_id: string;
  difficulty_multiplier: number;
  current_turn_player_id: string | null;
  locked: boolean;
  trap: Trap | null;
  last_dice: number | null;
  status: string;
  paused?: boolean;
  board_overrides: Record<
    string,
    {
      exercise?: string;
      reps?: number;
      min_reps?: number;
      max_reps?: number;
      unit?: "reps" | "seconds";
    }
  > | null;
};

export type Player = {
  id: string;
  room_code: string;
  username: string;
  fitness_level: number;
  avatar_url: string | null;
  current_space: number;
  status: string;
  joined_at: string;
  score: number;
  finished_at: string | null;
  finish_rank: number | null;
  team_id?: string | null;
  is_team_lead?: boolean | null;
};

export function useRoom(code: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    let mounted = true;

    const fetchAll = async () => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("rooms").select("*").eq("code", code).maybeSingle(),
        supabase.from("players").select("*").eq("room_code", code).order("joined_at"),
      ]);
      if (!mounted) return;
      setRoom((r as Room) ?? null);
      setPlayers((p as Player[]) ?? []);
      setLoading(false);
    };
    fetchAll();

    const channel = supabase
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.eventType === "DELETE") setRoom(null);
          else setRoom(payload.new as Room);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as Player];
            if (payload.eventType === "UPDATE")
              return prev.map((p) =>
                p.id === (payload.new as Player).id ? (payload.new as Player) : p,
              );
            if (payload.eventType === "DELETE")
              return prev.filter((p) => p.id !== (payload.old as Player).id);
            return prev;
          });
        },
      )
      .subscribe();

    // When the tab returns from background/standby, the realtime websocket
    // may have dropped silently. Refetch the latest state and poll briefly
    // so the UI catches up (e.g. trap defused while we were away).
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchAll();
    };
    const onOnline = () => fetchAll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onOnline);

    // Lightweight safety-net poll every 5s to recover from missed realtime
    // events (e.g. when the device was asleep).
    const poll = setInterval(fetchAll, 5000);

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onOnline);
      clearInterval(poll);
    };
  }, [code]);

  return { room, players, loading };
}
