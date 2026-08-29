import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BombAvatar } from "@/components/BombAvatar";
import { useRoom } from "@/hooks/use-room";
import { Bomb, Camera as CameraIcon, Plus, Trash2, X } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";
import { useAuth } from "@/hooks/use-auth";
import { JoinAsModal } from "@/components/JoinAsModal";
import { saveGuestMap, loadGuestMap } from "@/lib/guest";
import { fileToAvatarDataUrl } from "@/lib/image";
import { useAttractVideo } from "@/hooks/use-attract-video";

export const Route = createFileRoute("/join/$code")({
  component: JoinView,
  validateSearch: (s: Record<string, unknown>) => ({
    auto: s.auto === 1 || s.auto === "1" ? 1 : undefined,
    join: s.join === 1 || s.join === "1" ? 1 : undefined,
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
const POD_CAP = 4;

type Slot = { name: string; avatar: string | null; fitness: number };

function emptySlot(i: number): Slot {
  return { name: "", avatar: `mascot:${MASCOT_COLORS[i % MASCOT_COLORS.length]}`, fitness: 6 };
}

function JoinView() {
  const { code } = Route.useParams();
  const { auto, join } = Route.useSearch();
  const navigate = useNavigate();
  const { room, players, pods, loading } = useRoom(code);
  const [chosenSlot, setChosenSlot] = useState<number | null>(null);
  const [podName, setPodName] = useState("");
  const [slots, setSlots] = useState<Slot[]>(() => [emptySlot(0), emptySlot(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [attachToSlotIdx, setAttachToSlotIdx] = useState<number | null>(null);
  const [stampedSlot, setStampedSlot] = useState<number | null>(null);
  const attractVideoRef = useRef<HTMLVideoElement>(null);
  useAttractVideo(attractVideoRef);
  // Fire the arcade "stamp" landing animation on a freshly populated slot.
  const stampSlot = (idx: number) => {
    setStampedSlot(idx);
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("anim-stamp-quake");
      setTimeout(() => document.documentElement.classList.remove("anim-stamp-quake"), 400);
    }
    setTimeout(() => setStampedSlot((cur) => (cur === idx ? null : cur)), 900);
  };
  const [guestProfile, setGuestProfile] = useState<
    { username: string; avatar_url: string; fitness?: number } | null
  >(null);

  // If the user is signed in, pull their profile info.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url, fitness_level")
        .eq("user_id", user.id)
        .maybeSingle();
      const fallbackName = user.email?.split("@")[0] ?? user.phone ?? "Player";
      const name = data?.username ?? fallbackName;
      const avatar = data?.avatar_url ?? `mascot:${MASCOT_COLORS[0]}`;
      setGuestProfile({ username: name, avatar_url: avatar, fitness: data?.fitness_level ?? 6 });
    })();
  }, [user]);

  // When a profile (auth or remembered guest) becomes available, fill the first
  // empty slot so returning players don't have to re-type their name.
  useEffect(() => {
    if (!guestProfile) return;
    const firstEmpty = slots.findIndex((s) => !s.name.trim());
    if (firstEmpty < 0) return;
    setSlotField(firstEmpty, {
      name: guestProfile.username,
      avatar: guestProfile.avatar_url,
      ...(guestProfile.fitness ? { fitness: guestProfile.fitness } : {}),
    });
    // The returning/authenticated player owns this card.
    setAttachToSlotIdx((cur) => (cur === null ? firstEmpty : cur));
    stampSlot(firstEmpty);
  }, [guestProfile, slots]);

  // Remember a guest identity from a previous visit on this device.
  useEffect(() => {
    if (user) return;
    const remembered = loadGuestMap(code);
    if (remembered) {
      setGuestProfile({ username: remembered.username, avatar_url: remembered.avatar_url });
    }
  }, [user, code]);

  const ATTACH_KEY = `boom.attach.${code}`;

  // Restore the slot a user was trying to link before an OAuth redirect.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(ATTACH_KEY);
    if (saved !== null) {
      setAttachToSlotIdx(Number(saved));
      sessionStorage.removeItem(ATTACH_KEY);
    }
  }, [ATTACH_KEY]);

  // When the modal returns an identity, apply it to the selected slot (or the first slot).
  const handleIdentity = (identity: {
    username: string;
    avatar_url: string;
    fitness?: number;
  }) => {
    const idx = attachToSlotIdx ?? 0;
    setGuestProfile(identity);
    setSlotField(idx, {
      name: identity.username,
      avatar: identity.avatar_url,
      ...(identity.fitness ? { fitness: identity.fitness } : {}),
    });
    if (typeof window !== "undefined") sessionStorage.removeItem(ATTACH_KEY);
    setAttachToSlotIdx(null);
    stampSlot(idx);
  };

  const openJoinModal = (slotIdx?: number) => {
    const idx = slotIdx ?? null;
    setAttachToSlotIdx(idx);
    if (typeof window !== "undefined" && idx !== null) {
      sessionStorage.setItem(ATTACH_KEY, String(idx));
    }
    setJoinModalOpen(true);
  };

  // Pod occupancy per slot (1..3): existing pod + its current player count.
  const podSlots = useMemo(
    () =>
      [1, 2, 3].map((slot) => {
        const pod = pods.find((p) => Number(p.slot) === slot) ?? null;
        const count = pod
          ? players.filter((p) => (p.pod_id ?? p.team_id) === pod.id).length
          : 0;
        return { slot, pod, count, full: !!pod && count >= POD_CAP };
      }),
    [pods, players],
  );
  const openSlots = useMemo(
    () => podSlots.filter((s) => !s.full).map((s) => s.slot),
    [podSlots],
  );
  const currentPodSlot = useMemo(
    () => podSlots.find((s) => s.slot === chosenSlot) ?? null,
    [podSlots, chosenSlot],
  );
  const joiningExisting = !!currentPodSlot?.pod;

  // Auto-distribution: drop the player into the first pod with a free seat,
  // cascading POD 1 → POD 2 → POD 3.
  useEffect(() => {
    if (loading || !room) return;
    if (chosenSlot === null && openSlots.length > 0) {
      setChosenSlot(openSlots[0]);
    }
  }, [loading, room, chosenSlot, openSlots]);

  // If the pod we're sitting on fills up (someone else took the last seat),
  // cascade to the next pod with room.
  useEffect(() => {
    if (chosenSlot === null) return;
    if (currentPodSlot?.full && openSlots.length > 0) setChosenSlot(openSlots[0]);
  }, [chosenSlot, currentPodSlot, openSlots]);

  // Keep the pod-name field in sync with the selected tab.
  useEffect(() => {
    if (chosenSlot === null) return;
    if (currentPodSlot?.pod) setPodName(currentPodSlot.pod.name);
    else setPodName((prev) => (prev && !prev.startsWith("Pod ") ? prev : `Pod ${chosenSlot}`));
  }, [chosenSlot, currentPodSlot]);

  // QR deep link (/join?room=CODE): open the "Join the game" modal straight
  // away, unless we already have an identity (returning from OAuth, or a
  // remembered guest on this device).
  const deepLinkKey = `boom.deeplink.${code}`;
  useEffect(() => {
    if (!join || loading || authLoading || !room) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(deepLinkKey)) return;
    sessionStorage.setItem(deepLinkKey, "1");
    if (user || guestProfile) return;
    setAttachToSlotIdx(0);
    setJoinModalOpen(true);
  }, [join, loading, authLoading, room, user, guestProfile, deepLinkKey]);

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

  const activeSlots = joiningExisting ? slots.slice(0, 1) : slots;
  const remainingSeats = currentPodSlot ? POD_CAP - currentPodSlot.count : POD_CAP;

  const canSubmit =
    chosenSlot !== null &&
    !currentPodSlot?.full &&
    podName.trim().length > 0 &&
    activeSlots.length >= (joiningExisting ? 1 : 2) &&
    activeSlots.length <= remainingSeats &&
    activeSlots.every((s) => s.name.trim().length > 0) &&
    !submitting;

  const submit = async () => {
    if (!canSubmit || chosenSlot === null) return;
    setSubmitting(true);
    setError(null);
    let pod = currentPodSlot?.pod ?? null;
    if (!pod) {
      const { data: created, error: podErr } = await supabase
        .from("pods")
        .insert({
          room_code: code,
          slot: chosenSlot,
          name: podName.trim(),
        })
        .select()
        .single();
      if (podErr || !created) {
        setSubmitting(false);
        setError(podErr?.message ?? "Could not create pod (slot may have just been taken).");
        return;
      }
      pod = created;
    }
    const now = Date.now();
    const rows = activeSlots.map((s, i) => ({
      room_code: code,
      pod_id: pod.id,
      username: s.name.trim(),
      avatar_url: s.avatar,
      fitness_level: s.fitness,
      current_space: 0,
      score: 0,
      joined_at: new Date(now + i).toISOString(),
      user_id: user && attachToSlotIdx === i ? user.id : null,
    }));
    const { error: pErr, data: createdPlayers } = await supabase.from("players").insert(rows).select();
    if (pErr) {
      setSubmitting(false);
      setError(pErr.message);
      return;
    }
    // Remember the guest identity on this device so the same browser can
    // reclaim the same slot when rejoining the same room.
    if (!user && createdPlayers && createdPlayers.length > 0) {
      const me = createdPlayers[attachToSlotIdx ?? 0] ?? createdPlayers[0];
      if (me) {
        saveGuestMap(code, me.id, me.username, me.avatar_url ?? `mascot:${MASCOT_COLORS[0]}`);
      }
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
    <main className="relative min-h-screen p-4 flex flex-col gap-4 overflow-hidden">
      <video
        ref={attractVideoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/media/attract-poster.jpg"
        aria-hidden="true"
        className="fixed inset-0 h-full w-full object-cover pointer-events-none"
      />
      <div className="fixed inset-0 bg-black/55 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-4">
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
            onClick={() => openJoinModal()}
            className="ink-border-sm rounded-xl px-3 py-2 text-xs font-black bg-white"
          >
            Join as…
          </button>
        )}
      </header>

      {/* Pod tabs */}
      <div className="ink-border rounded-2xl p-3 bg-white">
        <div className="text-xs font-bold opacity-60 uppercase tracking-wider mb-2">
          Pick your pod
        </div>
        {openSlots.length === 0 ? (
          <p className="text-sm font-bold text-[var(--boom-red)] mb-2">
            All 3 pods are full — wait for the host to start.
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          {podSlots.map(({ slot, pod, count, full }) => {
            const active = chosenSlot === slot;
            return (
              <button
                key={slot}
                disabled={full}
                onClick={() => !full && setChosenSlot(slot)}
                aria-disabled={full}
                className={`ink-border-sm rounded-xl py-3 font-black text-sm transition-transform ${
                  full ? "opacity-40 cursor-not-allowed grayscale" : "arcade-press"
                }`}
                style={{
                  background: full ? "#d4d4d4" : active ? POD_BG[slot - 1] : "white",
                  fontFamily: "'Luckiest Guy', cursive",
                  color: "var(--boom-ink)",
                }}
              >
                POD {slot}
                <div className="text-[10px] opacity-70">
                  {full ? "FULL" : pod ? `${count}/${POD_CAP}` : "empty"}
                </div>
              </button>
            );
          })}
        </div>

        {joiningExisting ? (
          <div className="mt-3 text-sm font-black">
            Joining <span style={{ color: "var(--boom-red)" }}>{podName}</span> ·{" "}
            {remainingSeats} seat{remainingSeats === 1 ? "" : "s"} left
          </div>
        ) : (
          <input
            type="text"
            value={podName}
            onChange={(e) => setPodName(e.target.value)}
            placeholder="Pod name (e.g. The Dynamite Trio)"
            className="mt-3 w-full ink-border-sm rounded-xl px-3 py-2 text-base font-bold bg-white"
          />
        )}
      </div>

      {/* Live roster of who is already in the chosen pod */}
      {joiningExisting && currentPodSlot?.pod && (
        <div className="ink-border rounded-2xl p-3 bg-white flex flex-wrap gap-2">
          {players
            .filter((p) => (p.pod_id ?? p.team_id) === currentPodSlot.pod!.id)
            .map((p) => (
              <span
                key={p.id}
                className="ink-border-sm rounded-full px-3 py-1 text-xs font-black"
                style={{ background: POD_BG[(chosenSlot ?? 1) - 1] }}
              >
                {p.username}
              </span>
            ))}
        </div>
      )}

      {/* Players */}
      <div className="flex flex-col gap-3">
        {activeSlots.map((slot, i) => (
          <div key={i} className="flex flex-col gap-1">
            <SlotCard
              label={`Player ${String.fromCharCode(65 + i)}`}
              slot={slot}
              mascotColor={MASCOT_COLORS[i % MASCOT_COLORS.length]}
              stamped={stampedSlot === i}
              canRemove={!joiningExisting && slots.length > 2}
              onRemove={() => removePlayer(i)}
              onChange={(patch) => setSlotField(i, patch)}
            />
            <button
              type="button"
              onClick={() => {
                if (user) {
                  setAttachToSlotIdx(attachToSlotIdx === i ? null : i);
                } else {
                  openJoinModal(i);
                }
              }}
              className="text-[11px] font-black self-end underline opacity-80"
              style={{ color: attachToSlotIdx === i ? "var(--boom-red)" : "var(--boom-ink)" }}
            >
              {user && attachToSlotIdx === i ? "✓ this is me" : "this is me →"}
            </button>
          </div>
        ))}
        {!joiningExisting && slots.length < 4 && (
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
        className="btn-massive"
        style={{ background: canSubmit ? "var(--boom-red)" : "#999" }}
      >
        <Bomb className="inline mr-2" /> READY!
      </button>
      <p className="text-[11px] opacity-60 text-center">
        {players.filter((p) => p.pod_id ?? p.team_id).length} players · {pods.length}/3 pods in this room
      </p>
      <JoinAsModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onSignedIn={() => {
          // The user state and profile useEffect will fill the first empty slot.
          setJoinModalOpen(false);
        }}
        onGuestChosen={(guest) => {
          handleIdentity(guest);
          setJoinModalOpen(false);
        }}
        title="Join the game"
        subtitle="Choose how you want to play"
      />
      </div>
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
  stamped = false,
}: {
  label: string;
  slot: Slot;
  mascotColor: string;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (patch: Partial<Slot>) => void;
  stamped?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isMascot = slot.avatar?.startsWith("mascot:");
  const mascotHex = isMascot ? slot.avatar!.slice(7) : mascotColor;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Please choose an image file.");
      e.target.value = "";
      return;
    }
    try {
      // Any size is fine — we downscale + recompress on device.
      const dataUrl = await fileToAvatarDataUrl(f);
      onChange({ avatar: dataUrl });
    } catch {
      alert("Could not read that photo. Try another one.");
    }
    e.target.value = "";
  };


  return (
    <div
      key={stamped ? `stamped-${slot.name}` : "idle"}
      className={`ink-border rounded-2xl p-3 bg-white flex flex-col gap-3 relative ${
        stamped ? "anim-stamp-in" : ""
      }`}
    >
      {stamped && <StampBurst />}
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
            <BombAvatar color={mascotHex} size={64} />
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
          capture="user"
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
/** Small particle burst played when a player card stamps into the lobby. */
function StampBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-20">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 block rounded-full anim-stamp-spark"
          style={{
            width: 10,
            height: 10,
            background: i % 2 ? "var(--boom-yellow)" : "var(--boom-red)",
            boxShadow: "0 0 0 2px #000",
            ["--sx" as string]: `${Math.cos((i / 10) * Math.PI * 2) * 90}px`,
            ["--sy" as string]: `${Math.sin((i / 10) * Math.PI * 2) * 60}px`,
            animationDelay: `${i * 12}ms`,
          }}
        />
      ))}
    </div>
  );
}
