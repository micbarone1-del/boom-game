import { useEffect, useState } from "react";
import type { Player, Pod } from "@/hooks/use-room";
import { supabase } from "@/integrations/supabase/client";

type Activity = {
  id: string;
  podSlot: number;
  podName: string;
  message: string;
  at: number;
};

const POD_COLORS = ["#fbbf24", "#fb923c", "#4ade80"];

/**
 * Bottom strip of up to 3 pop-up cards (one per pod), surfacing recent
 * workout activity on the gym map without moving the main board.
 */
export function PodActivityTicker({ roomCode, pods }: { roomCode: string; pods: Pod[] }) {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    if (!roomCode) return;
    const ch = supabase
      .channel(`activity:${roomCode}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "workout_logs", filter: `room_code=eq.${roomCode}` },
        async (payload) => {
          const log = payload.new as { player_id: string; exercise_name: string; target_reps: number; unit: string };
          const { data: pl } = await supabase
            .from("players")
            .select("username,pod_id")
            .eq("id", log.player_id)
            .maybeSingle();
          if (!pl) return;
          const pod = pods.find((p) => p.id === (pl as Player).pod_id);
          if (!pod) return;
          const message = `${pl.username} did ${log.target_reps}${log.unit === "seconds" ? "s" : ""} ${log.exercise_name}!`;
          setItems((arr) => [
            ...arr.filter((a) => a.podSlot !== pod.slot),
            { id: `${pod.id}-${Date.now()}`, podSlot: pod.slot, podName: pod.name, message, at: Date.now() },
          ]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [roomCode, pods]);

  // Auto-dismiss after 4.5s
  useEffect(() => {
    if (items.length === 0) return;
    const t = setInterval(() => {
      setItems((arr) => arr.filter((a) => Date.now() - a.at < 4500));
    }, 500);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  return (
    <div className="fixed bottom-3 left-0 right-0 z-30 flex justify-center gap-2 px-2 pointer-events-none">
      {items.map((a) => (
        <div
          key={a.id}
          className="ink-border rounded-2xl px-3 py-2 max-w-xs anim-fade-in"
          style={{ background: POD_COLORS[a.podSlot - 1] }}
        >
          <div className="text-[10px] font-black uppercase tracking-wide opacity-80">{a.podName}</div>
          <div className="text-sm font-black leading-tight" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            {a.message}
          </div>
        </div>
      ))}
    </div>
  );
}