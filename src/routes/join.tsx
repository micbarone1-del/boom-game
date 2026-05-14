import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { savePlayerSession } from "@/lib/game";
import { Bomb, LogIn, LogOut, UserCircle2 } from "lucide-react";

export const Route = createFileRoute("/join")({
  component: JoinPage,
  validateSearch: (s: Record<string, unknown>) => ({ code: (s.code as string) || "" }),
  head: () => ({
    meta: [
      { title: "Join the Game — BOOM!" },
      { name: "description", content: "Join a BOOM! workout game from your phone. Enter your room code, set your fitness level, and get ready to roll." },
      { property: "og:title", content: "Join the Game — BOOM!" },
      { property: "og:description", content: "Join a BOOM! workout game from your phone. Enter your room code and play with friends." },
      { property: "og:url", content: "https://boom-game.lovable.app/join" },
    ],
    links: [{ rel: "canonical", href: "https://boom-game.lovable.app/join" }],
  }),
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

  const clearProfileFields = () => {
    setUsername("");
    setFitness(5);
    setAvatarFile(null);
    setSavedAvatar(null);
  };

  const deleteSavedProfile = async () => {
    if (!userId) return;
    if (!confirm("Delete your saved BOOM profile? Your name, avatar and fitness level will be wiped.")) return;
    // Best-effort: clear out the row's profile fields (RLS only allows update on own row)
    await supabase.from("profiles").update({
      username: null,
      avatar_url: null,
      fitness_level: 5,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    clearProfileFields();
  };

  const oauth = async (provider: "google" | "apple") => {
    setAuthMsg(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/join" + (code ? `?code=${code}` : ""),
    });
    if (result.error) setAuthMsg((result.error as Error).message ?? "Sign-in failed");
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

      // If signed in, reuse an existing player row in this room instead of duplicating.
      let playerRowId: string | null = null;
      if (userId) {
        const { data: existing } = await supabase
          .from("players")
          .select("id")
          .eq("room_code", code)
          .eq("user_id", userId)
          .maybeSingle();
        if (existing) {
          await supabase
            .from("players")
            .update({ username, fitness_level: fitness, avatar_url, status: "active" })
            .eq("id", existing.id);
          playerRowId = existing.id;
        }
      }
      if (!playerRowId) {
        const { data: inserted, error: insErr } = await supabase.from("players").insert({
          room_code: code, username, fitness_level: fitness, avatar_url, user_id: userId,
        }).select().single();
        if (insErr || !inserted) throw insErr || new Error("insert failed");
        playerRowId = inserted.id;
      }

      savePlayerSession(code, playerRowId);

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
            <div className="flex items-center gap-3">
              <button onClick={deleteSavedProfile} className="text-xs font-black underline" style={{color:"var(--boom-red)"}}>
                Delete profile
              </button>
              <button onClick={signOut} className="text-xs font-black flex items-center gap-1 underline">
                <LogOut size={14}/> Sign out
              </button>
            </div>
          </>
        ) : (
          <>
          <span className="text-xs font-bold text-foreground">Sign in to save your profile across games.</span>
            <button onClick={() => setShowAuth((v) => !v)} className="text-xs font-black flex items-center gap-1 underline">
              <LogIn size={14}/> {showAuth ? "Cancel" : "Sign in"}
            </button>
          </>
        )}
      </div>

      {showAuth && !userId && (
        <form onSubmit={handleAuth} className="ink-border rounded-2xl bg-white p-4 w-full max-w-md mb-3 flex flex-col gap-2">
          <div className="flex flex-col gap-2 mb-1">
            <button type="button" onClick={() => oauth("google")}
              className="ink-border-sm rounded-xl py-2 font-black text-sm bg-white flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.5 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.2-.1-2.3-.4-3.5z"/>
              </svg>
              Continue with Google
            </button>
            <button type="button" onClick={() => oauth("apple")}
              className="ink-border-sm rounded-xl py-2 font-black text-sm flex items-center justify-center gap-2"
              style={{ background: "var(--boom-ink)", color: "white" }}>
              <svg width="16" height="18" viewBox="0 0 384 512" fill="currentColor" aria-hidden>
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM256.6 84.5c19.6-23.3 17.8-44.5 17.2-52.5-17.3 1-37.3 11.8-48.7 25.1-12.6 14.3-20 32-18.4 51.1 18.7 1.4 35.7-8.2 49.9-23.7z"/>
              </svg>
              Continue with Apple
            </button>
            <div className="text-center text-[10px] font-bold text-foreground/80">— or use email —</div>
          </div>
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
          <div className="flex justify-between text-xs font-bold text-foreground/80">
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
            <div className="mt-2 flex items-center gap-3">
              <div className="w-24 h-24 rounded-full overflow-hidden ink-border-sm">
                <img src={preview ?? savedAvatar ?? ""} alt={`${username || "Player"} selfie preview`} className="w-full h-full object-cover" />
              </div>
              <button type="button" onClick={clearProfileFields}
                className="text-xs font-black underline" style={{color:"var(--boom-red)"}}>
                Clear
              </button>
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
