import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { savePlayerSession } from "@/lib/game";
import { Bomb } from "lucide-react";

export const Route = createFileRoute("/join")({
  component: JoinPage,
  validateSearch: (s: Record<string, unknown>) => ({ code: (s.code as string) || "" }),
});

function JoinPage() {
  const { code: prefill } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState(prefill?.toUpperCase() || "");
  const [username, setUsername] = useState("");
  const [fitness, setFitness] = useState(5);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarFile) { setPreview(null); return; }
    const url = URL.createObjectURL(avatarFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code || !username) { setError("Need a code and a name."); return; }
    setSubmitting(true);
    try {
      // verify room
      const { data: room } = await supabase.from("rooms").select("code").eq("code", code).maybeSingle();
      if (!room) { setError("Room not found. Check the code."); setSubmitting(false); return; }

      let avatar_url: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "jpg";
        const path = `${code}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        if (!upErr) {
          avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        }
      }

      const { data: inserted, error: insErr } = await supabase.from("players").insert({
        room_code: code, username, fitness_level: fitness, avatar_url,
      }).select().single();
      if (insErr || !inserted) throw insErr || new Error("insert failed");

      savePlayerSession(code, inserted.id);
      navigate({ to: "/play/$code", params: { code } });
    } catch (err: any) {
      setError(err?.message || "Something blew up.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-6 flex flex-col items-center">
      <div className="flex items-center gap-2 mb-4">
        <Bomb size={32} />
        <h1 className="text-3xl font-black comic-shadow" style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}>
          JOIN THE BOOM
        </h1>
      </div>
      <form onSubmit={submit} className="ink-border rounded-3xl bg-white p-6 w-full max-w-md flex flex-col gap-4">
        <label className="block">
          <div className="font-black mb-1">ROOM CODE</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="GYM-XXXX"
            className="w-full ink-border-sm rounded-xl p-3 text-2xl font-black tracking-widest text-center"
            style={{ fontFamily: "'Luckiest Guy', cursive" }}
          />
        </label>
        <label className="block">
          <div className="font-black mb-1">USERNAME</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
            className="w-full ink-border-sm rounded-xl p-3 text-lg font-bold"
          />
        </label>
        <label className="block">
          <div className="font-black mb-1">FITNESS LEVEL: {fitness}</div>
          <input
            type="range" min={1} max={10} value={fitness}
            onChange={(e) => setFitness(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs font-bold opacity-70">
            <span>Couch potato</span><span>Beast mode</span>
          </div>
        </label>
        <label className="block">
          <div className="font-black mb-1">SELFIE (optional)</div>
          <input
            type="file" accept="image/*" capture="user"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          {preview && (
            <div className="mt-2 w-24 h-24 rounded-full overflow-hidden ink-border-sm">
              <img src={preview} alt="preview" className="w-full h-full object-cover" />
            </div>
          )}
        </label>
        {error && <div className="text-red-600 font-bold">{error}</div>}
        <button
          disabled={submitting}
          className="btn-boom disabled:opacity-50"
          style={{ fontFamily: "'Luckiest Guy', cursive" }}
        >
          {submitting ? "JOINING…" : "LET'S GO!"}
        </button>
      </form>
    </main>
  );
}
