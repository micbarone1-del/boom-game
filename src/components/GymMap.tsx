import { BOARD, BOARD_SIZE, CELL_LABEL, type CellType } from "@/lib/game";
import type { Player, Pod } from "@/hooks/use-room";
import { CELL_FLAVOR, mascotForCell } from "@/components/CellMascot";
import { Bomb, Flag, Star, Zap, ArrowDown, Sparkles, Users } from "lucide-react";

export const POD_COLORS = ["#fbbf24", "#fb923c", "#4ade80"];
const COLS = 10;

function cellBg(type: CellType) {
  if (type === "start") return "#fff";
  if (type === "finish")
    return "repeating-linear-gradient(45deg,#fde047 0 10px,#f59e0b 10px 20px)";
  return CELL_FLAVOR[type]?.color ?? "#eee";
}

function CellGlyph({ type }: { type: CellType }) {
  const size = 18;
  const props = { size, strokeWidth: 3 as const };
  switch (type) {
    case "boost":
      return <Zap {...props} fill="#fff" color="#111" />;
    case "setback":
      return <ArrowDown {...props} color="#fff" />;
    case "surprise":
      return <Sparkles {...props} color="#fff" />;
    case "crazy":
      return <Star {...props} fill="#fff" color="#111" />;
    case "group":
      return <Users {...props} color="#fff" />;
    case "finish":
      return <Flag {...props} fill="#111" color="#111" />;
    case "start":
      return <span className="text-base">🚀</span>;
    case "easy":
    case "medium":
    case "hard":
      return (
        <img
          src={mascotForCell(type)}
          alt=""
          className="w-5 h-5 object-contain drop-shadow"
          loading="lazy"
        />
      );
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
      className="ink-border rounded-3xl p-3 w-full relative overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, #fff8e6 0%, #fde9b8 60%, #f8d27a 100%)",
      }}
    >
      {/* arcade scanlines */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          background:
            "repeating-linear-gradient(0deg,#000 0 1px,transparent 1px 3px)",
        }}
      />
      <div
        className="relative grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {BOARD.map((cell, idx) => {
          const row = Math.floor(idx / COLS);
          const colInRow = idx % COLS;
          const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;
          const here = players.filter((p) => p.current_space === cell.space);
          const hasActive = here.some((p) => activeIds.has(p.id));
          const dark = cell.type === "setback" || cell.type === "hard" || cell.type === "crazy";
          return (
            <div
              key={cell.space}
              className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] font-black ${hasActive ? "anim-mascot-bounce" : ""}`}
              style={{
                background: cellBg(cell.type),
                gridColumn: col + 1,
                gridRow: row + 1,
                color: dark ? "#fff" : "var(--boom-ink)",
                border: "2.5px solid #111",
                boxShadow: hasActive
                  ? `0 0 0 3px #fff, 0 0 18px 6px ${POD_COLORS[(podBySlot.get(here.find((p) => activeIds.has(p.id))!.pod_id ?? "") ?? 1) - 1] ?? "#fff"}, 2px 2px 0 #111`
                  : "2px 2px 0 #111",
              }}
              title={`Cell ${cell.space} · ${CELL_LABEL[cell.type]}`}
            >
              <div className="absolute top-0.5 left-1 opacity-70 leading-none text-[9px]">
                {cell.space}
              </div>
              <CellGlyph type={cell.type} />
              <div
                className="leading-none mt-0.5"
                style={{ fontSize: "7px", letterSpacing: 0.4 }}
              >
                {CELL_LABEL[cell.type]}
              </div>
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
                          width: 16,
                          height: 16,
                          background: avatarColor(pl.avatar_url),
                          boxShadow: `0 0 0 2px ${podColor}, 0 0 0 3.5px #111${active ? `, 0 0 10px 3px ${podColor}` : ""}`,
                        }}
                        title={`${pl.username} (Pod ${slot})`}
                      >
                        <Bomb size={9} color="#fff" style={{ margin: 2 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="relative flex flex-wrap gap-3 justify-center mt-4 text-[11px] font-bold">
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