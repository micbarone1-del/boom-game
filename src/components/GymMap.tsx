import { BOARD, BOARD_SIZE, CELL_LABEL, type CellType } from "@/lib/game";
import type { Player, Pod } from "@/hooks/use-room";
import { mascotForCell } from "@/components/CellMascot";
import { Bomb, Trophy, HelpCircle, Zap, ArrowLeft, AlertTriangle, Users, Flame, Dumbbell } from "lucide-react";

export const POD_COLORS = ["#fbbf24", "#fb923c", "#4ade80"];
export const COLS = 16;
export const ROWS = 7;

/**
 * Snake-with-turn-cells layout that mirrors the published board:
 * row 0: cells 1-15 left→right, row 1: cell 16 turn (col 15),
 * row 2: cells 17-31 right→left, row 3: cell 32 turn (col 0),
 * row 4: cells 33-47 left→right, row 5: cell 48 turn (col 15),
 * row 6: cells 49-60 right→left (finish at col 3).
 */
export function cellPos(idx: number): { row: number; col: number } {
  if (idx <= 14) return { row: 0, col: idx };
  if (idx === 15) return { row: 1, col: 15 };
  if (idx <= 30) return { row: 2, col: 30 - idx };
  if (idx === 31) return { row: 3, col: 0 };
  if (idx <= 46) return { row: 4, col: idx - 32 };
  if (idx === 47) return { row: 5, col: 15 };
  return { row: 6, col: 15 - (idx - 47) };
}

export function cellBg(type: CellType) {
  if (type === "start") return "#3b82f6";
  if (type === "finish")
    return "repeating-linear-gradient(45deg,#fde047 0 10px,#f59e0b 10px 20px)";
  switch (type) {
    case "easy": return "#facc15";       // yellow
    case "medium": return "#22c55e";     // green
    case "hard": return "#ef4444";       // red
    case "surprise": return "#ec4899";   // pink
    case "crazy": return "#22d3ee";      // cyan
    case "group": return "#3b82f6";      // blue
    case "boost": return "#22c55e";      // boost = green lightning
    case "setback": return "#a855f7";    // purple
  }
  return "#eee";
}

function CellGlyph({ type }: { type: CellType }) {
  const size = 26;
  const props = { size, strokeWidth: 3 as const };
  switch (type) {
    case "boost":
      return <Zap {...props} fill="#fff" color="#fff" />;
    case "setback":
      return <ArrowLeft {...props} color="#fff" />;
    case "surprise":
      return <HelpCircle {...props} color="#fff" />;
    case "crazy":
      return <AlertTriangle {...props} color="#fff" />;
    case "group":
      return <Users {...props} color="#fff" />;
    case "finish":
      return <Trophy {...props} color="#111" />;
    case "start":
      return <span className="text-base">🚀</span>;
    case "easy":
    case "medium":
      // dumbbells for easy + medium would clash with boost; use mascot/dumbbell glyph
      return type === "easy"
        ? <Dumbbell {...props} color="#111" />
        : <Zap {...props} fill="#fff" color="#fff" />;
    case "hard":
      return <Flame {...props} color="#fff" />;
  }
}

// Friendly mascot fallback (unused but kept for safety)
function _MascotGlyph({ type }: { type: CellType }) {
  switch (type) {
    case "medium":
    case "hard":
    case "easy":
      return (
        <img
          src={mascotForCell(type)}
          alt=""
          className="w-5 h-5 object-contain drop-shadow"
          loading="lazy"
        />
      );
    default:
      return null;
  }
}

function avatarColor(url: string | null) {
  return url?.startsWith("mascot:") ? url.slice(7) : "#ec4899";
}

/**
 * Big animated board for the gym TV. Players from every pod render as
 * colored tokens on their `current_space`. Active player tokens flash and
 * a moving "spotlight" highlights whichever cell holds an active player.
 */
export function GymMap({
  players,
  pods,
}: {
  players: Player[];
  pods: Pod[];
}) {
  const podBySlot = new Map<string, number>();
  pods.forEach((p) => podBySlot.set(p.id, p.slot));
  const activeIds = new Set(
    pods.map((p) => p.current_turn_player_id).filter(Boolean) as string[],
  );

  return (
    <div
      className="ink-border rounded-3xl p-4 w-full relative overflow-hidden bg-white"
    >
      <div
        className="relative grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
        }}
      >
        {BOARD.map((cell, idx) => {
          const { row, col } = cellPos(idx);
          const here = players.filter((p) => p.current_space === cell.space);
          const hasActive = here.some((p) => activeIds.has(p.id));
          const dark = cell.type !== "easy" && cell.type !== "finish";
          const showStartLabel = cell.type === "start";
          return (
            <div
              key={cell.space}
              className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center font-black ${hasActive ? "anim-mascot-bounce" : ""}`}
              style={{
                background: cellBg(cell.type),
                gridColumn: col + 1,
                gridRow: row + 1,
                color: dark ? "#fff" : "var(--boom-ink)",
                border: "3px solid #111",
                boxShadow: hasActive
                  ? `0 0 0 3px #fff, 0 0 22px 8px ${POD_COLORS[(podBySlot.get(here.find((p) => activeIds.has(p.id))!.pod_id ?? "") ?? 1) - 1] ?? "#fff"}, 3px 3px 0 #111`
                  : "3px 3px 0 #111",
              }}
              title={`Cell ${cell.space} · ${CELL_LABEL[cell.type]}`}
            >
              <div className="absolute top-0.5 left-1.5 leading-none text-[11px] opacity-90">
                {cell.space}
              </div>
              <CellGlyph type={cell.type} />
              {showStartLabel && (
                <div
                  className="absolute -bottom-5 left-0 right-0 text-center text-[11px] font-black tracking-wider"
                  style={{ color: "#111", fontFamily: "'Luckiest Guy', cursive" }}
                >
                  START
                </div>
              )}
              {cell.type === "finish" && (
                <div
                  className="absolute -top-5 left-0 right-0 text-center text-[11px] font-black tracking-wider"
                  style={{ color: "#111", fontFamily: "'Luckiest Guy', cursive" }}
                >
                  FINISH
                </div>
              )}
              {/* Player tokens stacked at the bottom of the cell */}
              {here.length > 0 && (
                <div className="absolute -bottom-1 left-0 right-0 flex items-end justify-center gap-0.5">
                  {here.slice(0, 4).map((pl) => {
                    const slot = podBySlot.get(pl.pod_id ?? "") ?? 1;
                    const podColor = POD_COLORS[slot - 1] ?? "#888";
                    const active = activeIds.has(pl.id);
                    return (
                      <div
                        key={pl.id}
                        className={`rounded-full ${active ? "anim-fuse" : ""}`}
                        style={{
                          width: 22,
                          height: 22,
                          background: avatarColor(pl.avatar_url),
                          boxShadow: `0 0 0 2.5px ${podColor}, 0 0 0 4px #111${active ? `, 0 0 12px 4px ${podColor}` : ""}`,
                        }}
                        title={`${pl.username} (Pod ${slot})`}
                      >
                        <Bomb size={12} color="#fff" style={{ margin: 3 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend chips (mirrors published gym) */}
      <div className="relative flex flex-wrap gap-2 justify-center items-center mt-6 text-[11px] font-black">
        {[
          ["EASY", "#facc15"],
          ["MEDIUM", "#fb923c"],
          ["HARD", "#ef4444"],
          ["SURPRISE", "#ec4899"],
          ["CRAZY", "#22d3ee"],
          ["ALL TOGETHER", "#3b82f6"],
          ["VS BATTLE", "#fff"],
          ["BLAST +", "#22c55e"],
          ["SETBACK -", "#a855f7"],
        ].map(([label, bg]) => (
          <span
            key={label}
            className="px-2.5 py-1 rounded-full ink-border-sm"
            style={{
              background: bg,
              color: "#111",
              fontFamily: "'Luckiest Guy', cursive",
              letterSpacing: 0.4,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Pod legend */}
      <div className="relative flex flex-wrap gap-3 justify-center mt-3 text-[11px] font-bold">
        {pods.map((p) => {
          const podPlayers = players.filter((pl) => pl.pod_id === p.id);
          const lead = podPlayers.reduce(
            (m, pl) => Math.max(m, pl.current_space ?? 0),
            0,
          );
          return (
            <div
              key={p.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full ink-border-sm bg-white"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  background: POD_COLORS[p.slot - 1],
                  boxShadow: "0 0 0 1.5px #111",
                }}
              />
              <span style={{ fontFamily: "'Luckiest Guy', cursive" }}>
                {p.name}
              </span>
              <span className="opacity-60">
                · {lead}/{BOARD_SIZE}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Per-pod scoreboard column for the gym TV.
 * Shows the pod color block, each player's score, and the lead position.
 */
export function GymScoreboard({
  players,
  pods,
}: {
  players: Player[];
  pods: Pod[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {pods.map((pod) => {
        const podPlayers = players
          .filter((p) => p.pod_id === pod.id)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const totalScore = podPlayers.reduce((s, p) => s + (p.score ?? 0), 0);
        const lead = Math.max(0, ...podPlayers.map((p) => p.current_space ?? 0));
        const color = POD_COLORS[pod.slot - 1] ?? "#888";
        return (
          <div
            key={pod.id}
            className="ink-border rounded-2xl bg-white overflow-hidden"
          >
            <div
              className="px-3 py-1.5 flex items-center justify-between"
              style={{ background: color }}
            >
              <div
                className="font-black text-base"
                style={{ fontFamily: "'Luckiest Guy', cursive", color: "#111" }}
              >
                {pod.name}
              </div>
              <div className="text-xs font-black" style={{ color: "#111" }}>
                {totalScore} pts · {lead}/{BOARD_SIZE}
              </div>
            </div>
            <ul className="divide-y divide-black/10">
              {podPlayers.length === 0 && (
                <li className="px-3 py-2 text-xs opacity-60">No players</li>
              )}
              {podPlayers.map((p) => (
                <li
                  key={p.id}
                  className="px-3 py-1.5 flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="w-4 h-4 rounded-full inline-block shrink-0"
                      style={{
                        background: avatarColor(p.avatar_url),
                        boxShadow: "0 0 0 1.5px #111",
                      }}
                    />
                    <span className="truncate font-bold">{p.username}</span>
                  </span>
                  <span className="text-xs opacity-70 tabular-nums">
                    #{p.current_space} · {p.score ?? 0}p
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}