import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import { SpotifyEmbed } from "@/components/SpotifyEmbed";
import { BOARD, CELL_LABEL } from "@/lib/game";
import { ArrowLeft, Save } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";

export const Route = createFileRoute("/gym/$code/customize")({
  component: CustomizePage,
  head: ({ params }) => ({
    meta: [
      { title: `Customise ${params.code} — BOOM!` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Override = {
  exercise?: string;
  reps?: number;
  min_reps?: number;
  max_reps?: number;
  unit?: "reps" | "seconds";
};

function CustomizePage() {
  const { code } = Route.useParams();
  const { room, loading } = useRoom(code);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (room?.board_overrides) {
      setOverrides(room.board_overrides as Record<string, Override>);
    }
  }, [room?.board_overrides]);

  const editableCells = BOARD.map((c, i) => ({ ...c, index: i })).filter(
    (c) =>
      c.type === "easy" ||
      c.type === "medium" ||
      c.type === "hard" ||
      c.type === "surprise" ||
      c.type === "crazy" ||
      c.type === "group",
  );

  const updateCell = (idx: number, patch: Partial<Override>) => {
    setOverrides((prev) => ({ ...prev, [String(idx)]: { ...(prev[String(idx)] ?? {}), ...patch } }));
  };

  const save = async () => {
    setSaving(true);
    await supabase.from("rooms").update({ board_overrides: overrides }).eq("code", code);
    setSaving(false);
    setSavedAt(Date.now());
  };

  if (loading || !room) {
    return <div className="min-h-screen flex items-center justify-center text-2xl">Loading…</div>;
  }

  return (
    <main className="min-h-screen p-4 max-w-3xl mx-auto flex flex-col gap-4">
      <header className="flex items-center gap-3 mt-2">
        <img src={bombMascot} alt="" className="w-10 h-10" />
        <div className="flex-1">
          <h1
            className="text-2xl font-black leading-none"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
          >
            CUSTOMISE
          </h1>
          <div className="text-xs font-bold opacity-70">Room {code}</div>
        </div>
        <Link
          to="/gym/$code"
          params={{ code }}
          className="ink-border-sm rounded-xl px-3 py-2 text-xs font-black bg-white flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      </header>

      <section className="ink-border rounded-2xl bg-white p-4 flex flex-col gap-3">
        <h2 className="text-lg font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
          MUSIC
        </h2>
        <SpotifyEmbed code={code} />
      </section>

      <section className="ink-border rounded-2xl bg-white p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
            TRAINING
          </h2>
          <button
            onClick={save}
            disabled={saving}
            className="ink-border-sm rounded-xl px-3 py-2 text-xs font-black bg-[var(--boom-green)] text-white flex items-center gap-1 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Saving…" : savedAt ? "Saved" : "Save"}
          </button>
        </div>
        <p className="text-xs opacity-70">
          Override the exercise or reps for individual board cells. Leave blank to keep defaults.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {editableCells.map((c) => {
            const ov = overrides[String(c.index)] ?? {};
            return (
              <div
                key={c.index}
                className="ink-border-sm rounded-xl p-2 flex flex-col gap-1 bg-white"
              >
                <div className="text-xs font-black opacity-70">
                  #{c.index} · {CELL_LABEL[c.type] ?? c.type}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Exercise name"
                    value={ov.exercise ?? ""}
                    onChange={(e) => updateCell(c.index, { exercise: e.target.value || undefined })}
                    className="ink-border-sm rounded-lg px-2 py-1 text-sm font-bold"
                  />
                  <input
                    type="number"
                    placeholder="Reps"
                    min={1}
                    value={ov.reps ?? ""}
                    onChange={(e) =>
                      updateCell(c.index, {
                        reps: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="ink-border-sm rounded-lg px-2 py-1 text-sm font-bold"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}