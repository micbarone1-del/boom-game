import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Room = {
  code: string;
  host_id: string;
  difficulty_multiplier: number;
  current_turn_player_id: string | null;
  locked: boolean;
  trap: any;
  last_dice: number | null;
  status: string;
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
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        (payload) => {
          if (payload.eventType === "DELETE") setRoom(null);
          else setRoom(payload.new as Room);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` },
        (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as Player];
            if (payload.eventType === "UPDATE")
              return prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as Player) : p));
            if (payload.eventType === "DELETE")
              return prev.filter((p) => p.id !== (payload.old as Player).id);
            return prev;
          });
        })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [code]);

  return { room, players, loading };
}
