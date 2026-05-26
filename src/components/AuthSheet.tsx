import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { X, Mail, LogIn } from "lucide-react";

/**
 * Lightweight login sheet — Google, Apple, or email/password.
 * Renders nothing if `open` is false.
 */
export function AuthSheet({
  open,
  onClose,
  onSignedIn,
  title = "Connect your profile",
  subtitle = "Save your scores to the leaderboard",
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
  title?: string;
  subtitle?: string;
}) {
  const [mode, setMode] = useState<"choose" | "email-in" | "email-up">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!open) return null;

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.href,
    });
    if (result.error) {
      setError(result.error.message ?? "Sign in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return; // browser is navigating
    onSignedIn?.();
    onClose();
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "email-up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.href },
        });
        if (error) throw error;
        setInfo("Check your inbox to confirm your email, then sign in.");
        setMode("email-in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSignedIn?.();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-2">
      <div className="ink-border rounded-3xl bg-white w-full max-w-sm p-5 flex flex-col gap-3 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 ink-border-sm rounded-full p-1 bg-white"
          aria-label="Close"
        >
          <X size={14} />
        </button>
        <div className="text-center">
          <h2
            className="text-2xl font-black"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
          >
            {title}
          </h2>
          <p className="text-xs font-bold opacity-70 mt-1">{subtitle}</p>
        </div>

        {error && (
          <p className="text-xs font-bold text-[var(--boom-red)] text-center">{error}</p>
        )}
        {info && <p className="text-xs font-bold text-center opacity-80">{info}</p>}

        {mode === "choose" && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => oauth("google")}
              className="ink-border-sm rounded-xl py-3 font-black bg-white flex items-center justify-center gap-2"
            >
              <GoogleG /> Continue with Google
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => oauth("apple")}
              className="ink-border-sm rounded-xl py-3 font-black text-white flex items-center justify-center gap-2"
              style={{ background: "#000" }}
            >
               Continue with Apple
            </button>
            <div className="flex items-center gap-2 my-1 opacity-60 text-[10px] font-bold uppercase">
              <span className="flex-1 h-px bg-black/20" /> or <span className="flex-1 h-px bg-black/20" />
            </div>
            <button
              type="button"
              onClick={() => setMode("email-in")}
              className="ink-border-sm rounded-xl py-3 font-black bg-white flex items-center justify-center gap-2"
            >
              <Mail size={16} /> Email & password
            </button>
          </div>
        )}

        {(mode === "email-in" || mode === "email-up") && (
          <form onSubmit={submitEmail} className="flex flex-col gap-2">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ink-border-sm rounded-xl px-3 py-2 font-bold"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password (6+ chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ink-border-sm rounded-xl px-3 py-2 font-bold"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-boom py-3 mt-1 disabled:opacity-50"
              style={{ background: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}
            >
              <LogIn className="inline mr-1" size={16} />
              {mode === "email-up" ? "Create account" : "Sign in"}
            </button>
            <div className="flex justify-between text-xs font-bold opacity-70">
              <button type="button" onClick={() => setMode("choose")}>
                ← back
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === "email-up" ? "email-in" : "email-up")}
              >
                {mode === "email-up" ? "Have an account? Sign in" : "New here? Create account"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5 0 9.5-1.7 12.9-4.6l-6-5c-1.9 1.3-4.3 2.1-6.9 2.1-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.6 39 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6 5c-.4.4 6.7-4.9 6.7-14.5 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}