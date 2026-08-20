import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode, BOARD_SIZE } from "@/lib/game";

export const Route = createFileRoute("/boss-test")({
  component: BossTestPage,
  validateSearch: (s: Record<string, unknown>) => ({
    hp: s['hp'] ? Number(s['hp']) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Boss test — BOOM!" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/**
 * Dev shortcut: spin up a throwaway room already in the BOSS phase with a
 * single pod + two players parked at the finish line, then jump straight
 * into the player UI so we can iterate on the boss fight.
 */
function BossTestPage() {
  const navigate = useNavigate();
  const { hp } = Route.useSearch();
  const [status, setStatus] = useState("Booting boss test…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const code = generateRoomCode();
        setStatus("Creating room…");
        const now = new Date();
        const ends = new Date(now.getTime() + 15 * 60 * 1000);
        const maxHp = hp && hp > 0 ? hp : 2 * 220;
        const { error: rErr } = await supabase.from("rooms").insert({
          code,
          status: "playing",
          game_started_at: now.toISOString(),
          game_ends_at: ends.toISOString(),
          game_state: "playing",
          phase: "boss",
          boss_hp: maxHp,
          boss_max_hp: maxHp,
          boss_started_at: now.toISOString(),
        });
        if (rErr) throw rErr;

        setStatus("Creating pod…");
        const { data: pod, error: pErr } = await supabase
          .from("pods")
          .insert({ room_code: code, slot: 1, name: "Test Pod" })
          .select()
          .single();
        if (pErr || !pod) throw pErr ?? new Error("No pod");

        setStatus("Adding players…");
        const t = Date.now();
        const rows = [
          { name: "Alpha", color: "#ec4899" },
          { name: "Bravo", color: "#22d3ee" },
        ].map((p, i) => ({
          room_code: code,
          pod_id: pod.id,
          username: p.name,
          avatar_url: `mascot:${p.color}`,
          fitness_level: 2,
          current_space: BOARD_SIZE,
          score: 0,
          joined_at: new Date(t + i).toISOString(),
        }));
        const { error: plErr } = await supabase.from("players").insert(rows);
        if (plErr) throw plErr;

        setStatus("Loading boss fight…");
        navigate({
          to: "/pod/$code/$podId",
          params: { code, podId: pod.id },
        });
      } catch (e) {
        setStatus(
          `Failed: ${e instanceof Error ? e.message : "unknown error"}`,
        );
      }
    })();
  }, [navigate, hp]);

  return (
    <main className="min-h-screen flex items-center justify-center text-xl font-black p-6 text-center">
      {status}
    </main>
  );
}