import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { savePlayerSession } from "@/lib/game";
import { Bomb, LogIn, LogOut, UserCircle2 } from "lucide-react";

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

  // Auth & profile state
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [savedAvatar, setSavedAvatar] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u) {
        setUserId(u.id);
        setUserEmail(u.email ?? null);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // When signed in, pre-fill from saved profile
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("username, avatar_url, fitness_level")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.username && !username) setUsername(data.username);
        if (data.fitness_level) setFitness(data.fitness_level);
        if (data.avatar_url) setSavedAvatar(data.avatar_url);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!avatarFile) { setPreview(null); return; }
    const url = URL.createObjectURL(avatarFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg(null);
    setAuthBusy(true);
    const fn = authMode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/join" } });
    const { error } = await fn;
    if (error) setAuthMsg(error.message);
    else {
      setAuthMsg(authMode === "signup" ? "Account created — you're in!" : "Signed in!");
      setShowAuth(false);
      setPassword("");
    }
    setAuthBusy(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSavedAvatar(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!code || !username) { setError("Need a code and a name."); return; }
    setSubmitting(true);
    try {
      // verify room
      const { data: room } = await supabase.from("rooms").select("code").eq("code", code).maybeSingle();
      if (!room) { setError("Room not found. Check the code."); setSubmitting(false); return; }

      let avatar_url: string | null = savedAvatar;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop() || "jpg";
        const path = `${code}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        if (!upErr) {
          avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        }
      }

      const { data: inserted, error: insErr } = await supabase.from("players").insert({
        room_code: code, username, fitness_level: fitness, avatar_url, user_id: userId,
      }).select().single();
      if (insErr || !inserted) throw insErr || new Error("insert failed");

      savePlayerSession(code, inserted.id);

      // Persist latest profile choices for signed-in players
      if (userId) {
        await supabase.from("profiles").upsert({
          user_id: userId,
          username,
          fitness_level: fitness,
          avatar_url,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

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

      {/* Auth strip */}
      <div className="ink-border-sm rounded-2xl bg-white p-3 w-full max-w-md mb-3 flex items-center justify-between gap-2">
        {userId ? (
          <>
            <div className="flex items-center gap-2 text-sm font-bold">
              <UserCircle2 size={20} />
              <span className="truncate max-w-[180px]">{userEmail}</span>
            </div>
            <button onClick={signOut} className="text-xs font-black flex items-center gap-1 underline">
              <LogOut size={14}/> Sign out
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-bold opacity-80">Sign in to save your profile across games.</span>
            <button onClick={() => setShowAuth((v) => !v)} className="text-xs font-black flex items-center gap-1 underline">
              <LogIn size={14}/> {showAuth ? "Cancel" : "Sign in"}
            </button>
          </>
        )}
      </div>

      {showAuth && !userId && (
        <form onSubmit={handleAuth} className="ink-border rounded-2xl bg-white p-4 w-full max-w-md mb-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={() => setAuthMode("signin")}
              className={`flex-1 py-1 font-black text-sm rounded-md ${authMode==="signin"?"bg-[var(--boom-yellow)]":""}`}>
              Sign in
            </button>
            <button type="button" onClick={() => setAuthMode("signup")}
              className={`flex-1 py-1 font-black text-sm rounded-md ${authMode==="signup"?"bg-[var(--boom-yellow)]":""}`}>
              Create account
            </button>
          </div>
          <input type="email" required placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)}
            className="ink-border-sm rounded-xl p-2 text-sm font-bold"/>
          <input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)}
            className="ink-border-sm rounded-xl p-2 text-sm font-bold"/>
          {authMsg && <div className="text-xs font-bold" style={{color:"var(--boom-red)"}}>{authMsg}</div>}
          <button disabled={authBusy} className="btn-boom disabled:opacity-50 text-base py-2">
            {authBusy ? "…" : authMode==="signin" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </form>
      )}

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
          {(preview || savedAvatar) && (
            <div className="mt-2 w-24 h-24 rounded-full overflow-hidden ink-border-sm">
              <img src={preview ?? savedAvatar ?? ""} alt="preview" className="w-full h-full object-cover" />
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
