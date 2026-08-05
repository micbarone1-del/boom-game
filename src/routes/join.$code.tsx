import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoom } from "@/hooks/use-room";
import { Bomb, Camera as CameraIcon, Plus, Trash2, X } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { useAuth } from "@/hooks/use-auth";
import { JoinAsModal } from "@/components/JoinAsModal";
import { saveGuestMap, loadGuestMap } from "@/lib/guest";

export const Route = createFileRoute("/join/$code")({
  component: JoinView,
  validateSearch: (s: Record<string, unknown>) => ({
    auto: s.auto === 1 || s.auto === "1" ? 1 : undefined,
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Join ${params.code} — BOOM!` },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const MASCOT_COLORS = [
  "#ec4899", "#22d3ee", "#a3e635", "#fbbf24", "#fb923c", "#a78bfa",
];
const LEVELS = [
  { label: "Base", value: 3 },
  { label: "Intermediate", value: 6 },
  { label: "Advanced", value: 9 },
] as const;
const POD_BG = ["var(--boom-yellow)", "var(--boom-orange)", "var(--boom-green)"];

type Slot = { name: string; avatar: string | null; fitness: number };

function emptySlot(i: number): Slot {
  return { name: "", avatar: `mascot:${MASCOT_COLORS[i % MASCOT_COLORS.length]}`, fitness: 6 };
}

function JoinView() {
  const { code } = Route.useParams();
  const { auto } = Route.useSearch();
  const navigate = useNavigate();
  const { room, players, pods, loading } = useRoom(code);
  const [chosenSlot, setChosenSlot] = useState<number | null>(null);
  const [podName, setPodName] = useState("");
  const [slots, setSlots] = useState<Slot[]>(() => [emptySlot(0), emptySlot(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [attachToSlotIdx, setAttachToSlotIdx] = useState<number | null>(null);
  const [guestProfile, setGuestProfile] = useState<{ username: string; avatar_url: string } | null>(null);

  // If the user is signed in, pull their profile info.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("username, avatar_url").eq("user_id", user.id).maybeSingle();
      if (!data) return;
      setGuestProfile({ username: data.username ?? user.email?.split("@")[0] ?? "Player", avatar_url: data.avatar_url ?? `mascot:${MASCOT_COLORS[0]}` });
    })();
  }, [user]);

  // Pre-fill the first slot with the authenticated user's profile or a remembered guest.
  useEffect(() => {
    if (user) {
      // Already handled by the profile fetch above; it sets guestProfile.
      return;
    }
    const remembered = loadGuestMap(code);
    if (remembered) {
      setGuestProfile({ username: remembered.username, avatar_url: remembered.avatar_url });
    }
  }, [user, code]);

  // When the modal returns an identity, apply it to the selected slot (or the first slot).
  const handleIdentity = (identity: { username: string; avatar_url: string }) => {
    const idx = attachToSlotIdx ?? 0;
    setGuestProfile(identity);
    setSlotField(idx, { name: identity.username, avatar: identity.avatar_url });
    setAttachToSlotIdx(null);
  };

  const openJoinModal = (slotIdx?: number) => {
    setAttachToSlotIdx(slotIdx ?? null);
    setJoinModalOpen(true);
  };

  const takenSlots = useMemo(() => new Set(pods.map((p) => p.slot)), [pods]);
  const availableSlots = useMemo(
    () => [1, 2, 3].filter((s) => !takenSlots.has(s)),
    [takenSlots],
  );

  // Auto-pick first free slot when arriving via Start Playing.
  useEffect(() => {
    if (!auto || loading || !room) return;
    if (chosenSlot === null && availableSlots.length > 0) {
      setChosenSlot(availableSlots[0]);
      setPodName((prev) => prev || `Pod ${availableSlots[0]}`);
    }
  }, [auto, loading, room, chosenSlot, availableSlots]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-2xl">Loading room…</div>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 text-center">
        <img src={bombMascot} alt="" className="w-24 h-24 opacity-60" />
        <h1 className="text-3xl font-black" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
          Room {code} not found
        </h1>
        <p className="opacity-70 text-sm">Double check the code with your host.</p>
      </main>
    );
  }

  // If a pod is already selected and locked in (post-create), redirect.
  // (Used when re-opening the join URL after creation.)

  const setSlotField = (i: number, patch: Partial<Slot>) =>
    setSlots((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addPlayer = () => {
    if (slots.length >= 4) return;
    setSlots((arr) => [...arr, emptySlot(arr.length)]);
  };
  const removePlayer = (i: number) => {
    if (slots.length <= 2) return;
    setSlots((arr) => arr.filter((_, idx) => idx !== i));
  };

  const canSubmit =
    chosenSlot !== null &&
    podName.trim().length > 0 &&
    slots.length >= 2 &&
    slots.length <= 4 &&
    slots.every((s) => s.name.trim().length > 0) &&
    !submitting;

  const submit = async () => {
    if (!canSubmit || chosenSlot === null) return;
    setSubmitting(true);
    setError(null);
    const { data: pod, error: podErr } = await supabase
      .from("pods")
      .insert({
        room_code: code,
        slot: chosenSlot,
        name: podName.trim(),
      })
      .select()
      .single();
    if (podErr || !pod) {
      setSubmitting(false);
      setError(podErr?.message ?? "Could not create pod (slot may have just been taken).");
      return;
    }
    const now = Date.now();
    const rows = slots.map((s, i) => ({
      room_code: code,
      pod_id: pod.id,
      username: s.name.trim(),
      avatar_url: s.avatar,
      fitness_level: s.fitness,
      current_space: 0,
      score: 0,
      joined_at: new Date(now + i).toISOString(),
      user_id: attachToSlotIdx === i && user ? user.id : null,
    }));
    const { error: pErr } = await supabase.from("players").insert(rows);
    if (pErr) {
      setSubmitting(false);
      setError(pErr.message);
      return;
    }
    // If this is the first pod AND they came via auto (solo flow), auto-start
    // the room with the 15-min fuse so they don't need a host screen.
    if (auto && pods.length === 0) {
      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + 15 * 60 * 1000);
      await supabase
        .from("rooms")
        .update({
          status: "playing",
          game_started_at: startedAt.toISOString(),
          game_ends_at: endsAt.toISOString(),
          game_state: "playing",
        })
        .eq("code", code);
      await supabase.from("pods").update({ status: "playing" }).eq("id", pod.id);
    }
    navigate({ to: "/pod/$code/$podId", params: { code, podId: pod.id } });
  };

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col gap-4">
      <header className="flex items-center gap-3 mt-2">
        <img src={bombMascot} alt="" className="w-12 h-12 anim-fuse" />
        <div className="flex-1">
          <h1
            className="text-3xl font-black leading-none"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
          >
            JOIN A POD
          </h1>
          <p className="text-xs font-bold opacity-70">Room {code} · 2–4 players per pod</p>
        </div>
        {user ? (
          <div className="text-[10px] font-bold opacity-70 text-right">
            <div>signed in</div>
            <button onClick={() => supabase.auth.signOut()} className="underline">sign out</button>
          </div>
        ) : (
          <button
            onClick={() => setAuthOpen(true)}
            className="ink-border-sm rounded-xl px-3 py-2 text-xs font-black bg-white"
          >
            Sign in
          </button>
        )}
      </header>

      {/* Slot picker */}
      <div className="ink-border rounded-2xl p-3 bg-white">
        <div className="text-xs font-bold opacity-60 uppercase tracking-wider mb-2">
          Pick your pod
        </div>
        {availableSlots.length === 0 ? (
          <p className="text-sm font-bold text-[var(--boom-red)]">
            All 3 pods are taken — wait for the host to start.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((slot) => {
              const taken = takenSlots.has(slot);
              const active = chosenSlot === slot;
              return (
                <button
                  key={slot}
                  disabled={taken}
                  onClick={() => setChosenSlot(slot)}
                  className="ink-border-sm rounded-xl py-3 font-black text-sm disabled:opacity-40"
                  style={{
                    background: active ? POD_BG[slot - 1] : "white",
                    fontFamily: "'Luckiest Guy', cursive",
                  }}
                >
                  POD {slot}
                  {taken && <div className="text-[10px] opacity-70">taken</div>}
                </button>
              );
            })}
          </div>
        )}

        <input
          type="text"
          value={podName}
          onChange={(e) => setPodName(e.target.value)}
          placeholder="Pod name (e.g. The Dynamite Trio)"
          className="mt-3 w-full ink-border-sm rounded-xl px-3 py-2 text-base font-bold bg-white"
        />
      </div>

      {/* Players */}
      <div className="flex flex-col gap-3">
        {slots.map((slot, i) => (
          <div key={i} className="flex flex-col gap-1">
            <SlotCard
              label={`Player ${String.fromCharCode(65 + i)}`}
              slot={slot}
              mascotColor={MASCOT_COLORS[i % MASCOT_COLORS.length]}
              canRemove={slots.length > 2}
              onRemove={() => removePlayer(i)}
              onChange={(patch) => setSlotField(i, patch)}
            />
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAttachToSlotIdx(i);
                  setAuthOpen(true);
                } else {
                  setAttachToSlotIdx(attachToSlotIdx === i ? null : i);
                }
              }}
              className="text-[11px] font-black self-end underline opacity-80"
              style={{ color: attachToSlotIdx === i ? "var(--boom-red)" : "var(--boom-ink)" }}
            >
              {attachToSlotIdx === i ? "✓ this is me" : "this is me →"}
            </button>
          </div>
        ))}
        {slots.length < 4 && (
          <button
            type="button"
            onClick={addPlayer}
            className="ink-border-sm rounded-xl py-3 font-black flex items-center justify-center gap-2 bg-white"
          >
            <Plus size={16} /> Add player
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm font-black text-[var(--boom-red)] text-center">{error}</p>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="btn-boom text-2xl py-4 disabled:opacity-50"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          background: canSubmit ? "var(--boom-red)" : "#999",
        }}
      >
        <Bomb className="inline mr-2" /> READY!
      </button>
      <p className="text-[11px] opacity-60 text-center">
        {players.filter((p) => p.pod_id).length} players · {pods.length}/3 pods in this room
      </p>
      <AuthSheet
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="Sign in to BOOM!"
        subtitle="Track your scores on the global leaderboard"
      />
    </main>
  );
}

function SlotCard({
  label,
  slot,
  mascotColor,
  canRemove,
  onRemove,
  onChange,
}: {
  label: string;
  slot: Slot;
  mascotColor: string;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (patch: Partial<Slot>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isMascot = slot.avatar?.startsWith("mascot:");
  const mascotHex = isMascot ? slot.avatar!.slice(7) : mascotColor;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Please choose an image file.");
      e.target.value = "";
      return;
    }
    if (f.size > 1_048_576) {
      alert("Photo is too large. Please choose an image under 1 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ avatar: String(reader.result) });
    reader.readAsDataURL(f);
  };

  return (
    <div className="ink-border rounded-2xl p-3 bg-white flex flex-col gap-3 relative">
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 ink-border-sm rounded-full p-1 bg-white opacity-70"
          aria-label="Remove player"
        >
          <Trash2 size={12} />
        </button>
      )}
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
          <span className="absolute bottom-0 right-0 bg-white rounded-full p-1 ink-border-sm">
            <CameraIcon size={12} />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleFile}
        />
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="text"
            value={slot.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={label}
            className="ink-border-sm rounded-xl px-3 py-2 text-lg font-bold bg-white"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs font-black opacity-80 flex items-center gap-1"
            >
              <CameraIcon size={12} /> {isMascot ? "Add photo" : "Change photo"}
            </button>
            {!isMascot && (
              <button
                type="button"
                onClick={() => onChange({ avatar: `mascot:${mascotColor}` })}
                className="text-xs opacity-60 flex items-center gap-1"
                aria-label="Remove photo"
              >
                <X size={14} /> Remove
              </button>
            )}
          </div>
        </div>
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