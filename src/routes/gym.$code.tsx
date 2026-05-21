import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode } from "@/lib/game";
import { Bomb, Camera as CameraIcon, X } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";

export const Route = createFileRoute("/gym/$code")({
  component: GymView,
  head: ({ params }) => ({
    meta: [
      { title: `Build your Pod — BOOM! ${params.code}` },
      {
        name: "description",
        content: "Set up your 3-player BOOM! pod. Add names, photos and fitness levels — then pass the phone.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const MASCOT_COLORS = [
  "#ec4899",
  "#22d3ee",
  "#a3e635",
  "#fbbf24",
  "#fb923c",
  "#a78bfa",
];

const LEVELS = [
  { label: "Base", value: 3 },
  { label: "Intermediate", value: 6 },
  { label: "Advanced", value: 9 },
] as const;

type Slot = {
  name: string;
  avatar: string | null; // dataURL OR "mascot:<hex>"
  fitness: number;
};

const EMPTY_SLOTS = (): Slot[] => [
  { name: "", avatar: `mascot:${MASCOT_COLORS[0]}`, fitness: 6 },
  { name: "", avatar: `mascot:${MASCOT_COLORS[1]}`, fitness: 6 },
  { name: "", avatar: `mascot:${MASCOT_COLORS[2]}`, fitness: 6 },
];

function GymView() {
  const { code: codeParam } = Route.useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(codeParam === "new" ? null : codeParam);

  useEffect(() => {
    if (codeParam !== "new") {
      setCode(codeParam);
      return;
    }
    (async () => {
      const newCode = generateRoomCode();
      const { error } = await supabase.from("rooms").insert({ code: newCode });
      if (!error) {
        setCode(newCode);
        navigate({ to: "/gym/$code", params: { code: newCode }, replace: true });
      }
    })();
  }, [codeParam, navigate]);

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center text-3xl">Igniting fuse…</div>
    );
  }

  return <Setup code={code} />;
}

function Setup({ code }: { code: string }) {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<Slot[]>(EMPTY_SLOTS);
  const [starting, setStarting] = useState(false);

  const canStart = slots.every((s) => s.name.trim().length > 0) && !starting;

  const start = async () => {
    if (!canStart) return;
    setStarting(true);
    // Clear any prior players in this room (fresh pod).
    await supabase.from("players").delete().eq("room_code", code);
    const now = Date.now();
    const rows = slots.map((s, i) => ({
      room_code: code,
      username: s.name.trim(),
      avatar_url: s.avatar,
      fitness_level: s.fitness,
      current_space: 0,
      score: 0,
      // joined_at ordering preserves A→B→C rotation.
      joined_at: new Date(now + i).toISOString(),
    }));
    const { error } = await supabase.from("players").insert(rows);
    if (error) {
      setStarting(false);
      alert(error.message);
      return;
    }
    await supabase.from("rooms").update({ status: "playing", trap: null, locked: false }).eq("code", code);
    navigate({ to: "/pod/$code", params: { code } });
  };

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col gap-4">
      <header className="flex items-center gap-3 mt-2">
        <img src={bombMascot} alt="" className="w-12 h-12 anim-fuse" />
        <div>
          <h1
            className="text-3xl font-black"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
          >
            BUILD YOUR POD
          </h1>
          <p className="text-xs font-bold opacity-70">Room {code} · 3 players, 1 phone</p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {slots.map((slot, i) => (
          <SlotCard
            key={i}
            label={`Player ${String.fromCharCode(65 + i)}`}
            slot={slot}
            mascotColor={MASCOT_COLORS[i]}
            onChange={(patch) =>
              setSlots((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
            }
          />
        ))}
      </div>

      <button
        onClick={start}
        disabled={!canStart}
        className="btn-boom mt-4 text-2xl py-4 disabled:opacity-50"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          background: canStart ? "var(--boom-red)" : "#999",
        }}
      >
        <Bomb className="inline mr-2" /> START!
      </button>
    </main>
  );
}

function SlotCard({
  label,
  slot,
  mascotColor,
  onChange,
}: {
  label: string;
  slot: Slot;
  mascotColor: string;
  onChange: (patch: Partial<Slot>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isMascot = slot.avatar?.startsWith("mascot:");
  const mascotHex = isMascot ? slot.avatar!.slice(7) : mascotColor;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ avatar: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <div className="ink-border rounded-2xl p-3 bg-white flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center shrink-0"
          style={{
            background: isMascot ? mascotHex : "#eee",
            boxShadow: `0 0 0 3px ${mascotHex}, 0 0 0 5px #111`,
          }}
          aria-label="Choose photo or mascot"
        >
          {isMascot ? (
            <Bomb size={36} color="white" fill="white" />
          ) : (
            <img src={slot.avatar!} alt="" className="w-full h-full object-cover" />
          )}
          {!isMascot && (
            <span className="absolute bottom-0 right-0 bg-white rounded-full p-0.5">
              <CameraIcon size={12} />
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={handleFile} />
        <input
          type="text"
          value={slot.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={label}
          className="flex-1 ink-border-sm rounded-xl px-3 py-2 text-lg font-bold bg-white"
        />
        {!isMascot && (
          <button
            onClick={() => onChange({ avatar: `mascot:${mascotColor}` })}
            className="text-xs opacity-60"
            aria-label="Remove photo"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <span className="text-xs font-bold opacity-60 self-center mr-1">Mascot:</span>
        {MASCOT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ avatar: `mascot:${c}` })}
            className="w-6 h-6 rounded-full"
            style={{
              background: c,
              boxShadow:
                isMascot && mascotHex === c
                  ? "0 0 0 2px #111, 0 0 0 4px white, 0 0 0 6px #111"
                  : "0 0 0 1.5px #111",
            }}
            aria-label={`Mascot color ${c}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            onClick={() => onChange({ fitness: l.value })}
            className="ink-border-sm rounded-xl py-2 text-sm font-black"
            style={{
              background: slot.fitness === l.value ? "var(--boom-yellow)" : "white",
              color: "var(--boom-ink)",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}