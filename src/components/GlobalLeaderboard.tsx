import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";

type PastGame = {
  key: string;
  room_code: string;
  played_at: string;
  entries: { user_id: string; username: string; score: number; avatar_url: string | null }[];
};

/**
 * Leaderboard: the current game plus previous games, newest first.
 */
export function GlobalLeaderboard({
  highlightUserId,
  limit = 10,
}: {
  highlightUserId?: string | null;
  limit?: number;
}) {
  const [games, setGames] = useState<PastGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("game_results")
        .select("user_id, username, avatar_url, score, room_code, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!mounted) return;
      const byGame = new Map<string, PastGame>();
      for (const r of data ?? []) {
        // Group each row into its game (room + day) for the history tab.
        const day = (r.created_at ?? "").slice(0, 10);
        const key = `${r.room_code ?? "?"}-${day}`;
        const g =
          byGame.get(key) ??
          ({ key, room_code: r.room_code ?? "—", played_at: r.created_at ?? "", entries: [] } as PastGame);
        g.entries.push({ user_id: r.user_id, username: r.username, score: r.score ?? 0, avatar_url: r.avatar_url });
        byGame.set(key, g);
      }
      setGames(
        [...byGame.values()]
          .map((g) => ({ ...g, entries: g.entries.sort((a, b) => b.score - a.score) }))
          .slice(0, 15),
      );
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [limit]);

  return (
    <div className="arcade-card p-4 bg-white flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <Trophy size={20} style={{ color: "var(--boom-yellow)" }} />
        <div className="text-xl arcade-heading text-white">Leaderboard</div>
      </div>
      {loading && <div className="text-xs opacity-60">Loading\u2026</div>}
      {!loading && games.length === 0 && (
        <div className="text-xs opacity-60">No scores yet \u2014 be the first!</div>
      )}
      <div className="flex flex-col gap-2 max-h-[460px] overflow-y-auto pr-1 pb-1">
        {games.map((g, gi) => (
          <div key={g.key} className="arcade-card-sm w-full py-2 px-3 bg-white">
            <div className="flex items-center justify-between text-[10px] font-black opacity-70">
              <span>{gi === 0 ? "THIS GAME" : `ROOM ${g.room_code}`}</span>
              <span>{g.played_at ? new Date(g.played_at).toLocaleDateString() : ""}</span>
            </div>
            <div className="flex flex-col gap-1 mt-1">
              {g.entries.map((e, i) => (
                <div
                  key={`${g.key}-${i}`}
                  className="flex items-center gap-2 rounded-lg px-1 py-0.5"
                  style={{
                    background:
                      highlightUserId && e.user_id === highlightUserId
                        ? "var(--boom-yellow)"
                        : "transparent",
                  }}
                >
                  <div
                    className="text-lg font-black w-5 text-center"
                    style={{ fontFamily: "'Luckiest Guy', cursive" }}
                  >
                    {i + 1}
                  </div>
                  <Swatch url={e.avatar_url} name={e.username} />
                  <div className="flex-1 truncate font-bold text-sm">{e.username}</div>
                  <div
                    className="font-black tabular-nums text-xl"
                    style={{ color: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}
                  >
                    {e.score}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Swatch({ url, name }: { url: string | null; name: string }) {
  const isMascot = url?.startsWith("mascot:");
  const isImg = url && !isMascot;
  const color = isMascot ? url!.slice(7) : "#ec4899";
  return (
    <div
      className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-black shrink-0"
      style={{ background: color, boxShadow: "0 0 0 3px #000" }}
    >
      {isImg ? (
        <img src={url!} alt={name} className="w-full h-full object-cover" />
      ) : (
        (name || "?").slice(0, 1).toUpperCase()
      )}
    </div>
  );
}