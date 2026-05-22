import { BOARD, BOARD_SIZE, type CellType } from "@/lib/game";
import type { Player, Pod } from "@/hooks/use-room";
import { CELL_FLAVOR } from "@/components/CellMascot";
import { Bomb } from "lucide-react";

const POD_COLORS = ["#fbbf24", "#fb923c", "#4ade80"];
const COLS = 10;

function cellBg(type: CellType) {
  if (type === "start") return "#fff";
  if (type === "finish") return "#fde047";
  return CELL_FLAVOR[type]?.color ?? "#eee";
}

function avatarColor(url: string | null) {
  return url?.startsWith("mascot:") ? url.slice(7) : "#ec4899";
}

/**
 * Static game board for the gym TV. Players from every pod render as
 * colored tokens on their `current_space`. Active player tokens flash.
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
  const activeIds = new Set(pods.map((p) => p.current_turn_player_id).filter(Boolean) as string[]);

  return (
    <div className="ink-border rounded-2xl bg-white p-3 w-full">
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      >
        {BOARD.map((cell, idx) => {
          const row = Math.floor(idx / COLS);
          // serpentine: even rows L→R, odd rows R→L (snake & ladder feel)
          const colInRow = idx % COLS;
          const col = row % 2 === 0 ? colInRow : COLS - 1 - colInRow;
          const here = players.filter((p) => p.current_space === cell.space);
          return (
            <div
              key={cell.space}
              className="relative aspect-square ink-border-sm rounded-lg flex flex-col items-center justify-center text-[10px] font-black"
              style={{
                background: cellBg(cell.type),
                gridColumn: col + 1,
                gridRow: row + 1,
                color: cell.type === "setback" || cell.type === "hard" ? "#fff" : "var(--boom-ink)",
              }}
              title={`Cell ${cell.space}`}
            >
              <div className="opacity-80 leading-none">{cell.space}</div>
              <div className="leading-none truncate w-full text-center" style={{ fontSize: "8px" }}>
                {cell.type.toUpperCase()}
              </div>
              {here.length > 0 && (
                <div className="absolute inset-0 flex flex-wrap gap-0.5 items-end justify-center p-0.5">
                  {here.slice(0, 4).map((pl) => {
                    const slot = podBySlot.get(pl.pod_id ?? "") ?? 1;
                    const podColor = POD_COLORS[slot - 1] ?? "#888";
                    const active = activeIds.has(pl.id);
                    return (
                      <div
                        key={pl.id}
                        className={active ? "rounded-full animate-pulse" : "rounded-full"}
                        style={{
                          width: 14,
                          height: 14,
                          background: avatarColor(pl.avatar_url),
                          boxShadow: `0 0 0 2px ${podColor}, 0 0 0 3px #111${active ? ", 0 0 8px 4px " + podColor : ""}`,
                        }}
                        title={`${pl.username} (Pod ${slot})`}
                      >
                        <Bomb size={8} color="#fff" style={{ margin: 2 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 justify-center mt-3 text-xs font-bold">
        {pods.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: POD_COLORS[p.slot - 1], boxShadow: "0 0 0 1.5px #111" }} />
            <span>{p.name}</span>
            <span className="opacity-60">·{p.current_space}/{BOARD_SIZE}</span>
          </div>
        ))}
      </div>
    </div>
  );
}