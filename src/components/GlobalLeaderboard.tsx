import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy } from "lucide-react";

type Row = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_score: number;
  games: number;
};

/**
 * Global all-time leaderboard. Aggregates `game_results` client-side
 * (top 50 rows) to compute total score per user.
 */
export function GlobalLeaderboard({
  highlightUserId,
  limit = 10,
}: {
  highlightUserId?: string | null;
  limit?: number;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("game_results")
        .select("user_id, username, avatar_url, score")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!mounted) return;
      const acc = new Map<string, Row>();
      for (const r of data ?? []) {
        const cur = acc.get(r.user_id) ?? {
          user_id: r.user_id,
          username: r.username,
          avatar_url: r.avatar_url,
          total_score: 0,
          games: 0,
        };
        cur.total_score += r.score ?? 0;
        cur.games += 1;
        cur.username = r.username || cur.username;
        cur.avatar_url = r.avatar_url || cur.avatar_url;
        acc.set(r.user_id, cur);
      }
      const sorted = [...acc.values()]
        .sort((a, b) => b.total_score - a.total_score)
        .slice(0, limit);
      setRows(sorted);
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
        <div className="text-xl arcade-heading text-white">Global Leaderboard</div>
      </div>
      {loading && <div className="text-xs opacity-60">Loading…</div>}
      {!loading && rows.length === 0 && (
        <div className="text-xs opacity-60">No scores yet — be the first!</div>
      )}
      <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1 pb-1">
      {rows.map((r, i) => {
        const me = highlightUserId === r.user_id;
        return (
          <div
            key={r.user_id}
            className="arcade-card-sm w-full flex items-center gap-3 py-2 px-3"
            style={{ background: me ? "var(--boom-yellow)" : "#fff" }}
          >
            <Trophy
              size={18}
              style={{
                color:
                  i === 0 ? "#f5b301" : i === 1 ? "#9ca3af" : i === 2 ? "#c2703c" : "#111",
                opacity: i > 2 ? 0.35 : 1,
              }}
            />
            <div
              className="text-xl font-black w-6 text-center"
              style={{ fontFamily: "'Luckiest Guy', cursive" }}
            >
              {i + 1}
            </div>
            <Swatch url={r.avatar_url} name={r.username} />
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{r.username}</div>
              <div className="text-[10px] opacity-60">{r.games} game{r.games === 1 ? "" : "s"}</div>
            </div>
            <div
              className="font-black text-2xl tabular-nums"
              style={{ color: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}
            >
              {r.total_score}
            </div>
          </div>
        );
      })}
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