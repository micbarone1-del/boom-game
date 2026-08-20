import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { X, Mail, Smartphone, User, Camera, Bomb, Check } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";

const MASCOT_COLORS = [
  "#ec4899",
  "#22d3ee",
  "#a3e635",
  "#fbbf24",
  "#fb923c",
  "#a78bfa",
];

export type GuestProfile = {
  username: string;
  avatar_url: string;
};

export type JoinMethod = "guest" | "google" | "apple" | "phone" | "email";

/**
 * One-step "Join as…" modal.
 *
 * Shows a single screen with four big choices:
 * - Play as guest (nickname + avatar)
 * - Continue with Google / Apple
 * - Continue with Phone (SMS OTP)
 * - Email & password (existing flow)
 *
 * On success it either calls `onSignedIn` (OAuth/email/phone) or
 * `onGuestChosen` (guest), then closes.
 */
export function JoinAsModal({
  open,
  onClose,
  onSignedIn,
  onGuestChosen,
  title = "Join the game",
  subtitle = "One step to get started",
  allowGuest = true,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
  onGuestChosen?: (guest: GuestProfile) => void;
  title?: string;
  subtitle?: string;
  allowGuest?: boolean;
}) {
  const [view, setView] = useState<
    "choose" | "guest" | "phone" | "phone-verify" | "email-in" | "email-up"
  >("choose");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Guest fields
  const [guestName, setGuestName] = useState("");
  const [guestAvatar, setGuestAvatar] = useState<string>(`mascot:${MASCOT_COLORS[0]}`);
  const fileRef = useRef<HTMLInputElement>(null);

  // Phone fields
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  // Email fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setView("choose");
      setError(null);
      setInfo(null);
      setBusy(false);
      setShowMore(false);
    }
  }, [open]);

  if (!open) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please choose an image file.");
      e.target.value = "";
      return;
    }
    if (f.size > 1_048_576) {
      setError("Photo is too large. Please choose an image under 1 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setGuestAvatar(String(reader.result));
    reader.readAsDataURL(f);
  };

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
    if (result.redirected) return; // browser navigates away
    onSignedIn?.();
    onClose();
  };

  const requestPhoneCode = async () => {
    if (!phone.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: phone.trim(),
    });
    if (err) setError(err.message);
    else setView("phone-verify");
    setBusy(false);
  };

  const verifyPhone = async () => {
    if (!otp.trim()) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token: otp.trim(),
      type: "sms",
    });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    onSignedIn?.();
    onClose();
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (view === "email-up") {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.href },
        });
        if (err) throw err;
        setInfo("Check your inbox to confirm your email, then sign in.");
        setView("email-in");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        onSignedIn?.();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const submitGuest = () => {
    const name = guestName.trim();
    if (!name) {
      setError("Enter a nickname to play as guest.");
      return;
    }
    onGuestChosen?.({ username: name, avatar_url: guestAvatar });
    onClose();
  };

  const isMascot = guestAvatar.startsWith("mascot:");
  const mascotHex = isMascot ? guestAvatar.slice(7) : MASCOT_COLORS[0];

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 p-3">
      <div className="ink-border rounded-3xl bg-white w-full max-w-sm p-5 flex flex-col gap-3 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 ink-border-sm rounded-full p-1.5 bg-white"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="text-center">
          <img src={bombMascot} alt="" className="w-14 h-14 mx-auto anim-fuse" />
          <h2
            className="text-2xl font-black"
            style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
          >
            {title}
          </h2>
          <p className="text-xs font-bold opacity-70 mt-1">{subtitle}</p>
        </div>

        {error && (
          <p className="text-xs font-bold text-[var(--boom-red)] text-center bg-red-50 rounded-lg p-2">
            {error}
          </p>
        )}
        {info && (
          <p className="text-xs font-bold text-center bg-yellow-50 rounded-lg p-2">
            {info}
          </p>
        )}

        {view === "choose" && (
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => oauth("google")}
              className="ink-border rounded-2xl py-4 font-black text-lg bg-white flex items-center justify-center gap-2 arcade-press"
            >
              <GoogleG /> Continue with Google
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => oauth("apple")}
              className="ink-border rounded-2xl py-4 font-black text-lg text-white flex items-center justify-center gap-2 arcade-press"
              style={{ background: "#000" }}
            >
              <AppleIcon /> Continue with Apple
            </button>

            {allowGuest && (
              <>
                <div className="flex items-center gap-2 my-0.5 opacity-60 text-[10px] font-bold uppercase">
                  <span className="flex-1 h-px bg-black/20" /> or{" "}
                  <span className="flex-1 h-px bg-black/20" />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setView("guest")}
                  className="ink-border-sm rounded-2xl py-3 font-black bg-white flex items-center justify-center gap-2"
                >
                  <User size={18} /> Just a nickname
                </button>
              </>
            )}

            {!showMore ? (
              <button
                type="button"
                onClick={() => setShowMore(true)}
                className="text-xs font-black opacity-70 underline mt-1"
              >
                More sign-in options
              </button>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setView("phone")}
                  className="ink-border-sm rounded-2xl py-2.5 font-black text-sm bg-white flex items-center justify-center gap-2"
                >
                  <Smartphone size={16} /> Phone number
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setView("email-in")}
                  className="ink-border-sm rounded-2xl py-2.5 font-black text-sm bg-white flex items-center justify-center gap-2"
                >
                  <Mail size={16} /> Email & password
                </button>
              </div>
            )}
            <p className="text-[10px] text-center opacity-60 font-bold">
              Sign in to save your scores on the global leaderboard.
            </p>
          </div>
        )}

        {view === "guest" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0"
                style={{
                  background: isMascot ? mascotHex : "#eee",
                  boxShadow: `0 0 0 3px ${mascotHex}, 0 0 0 5px #111`,
                }}
                aria-label="Choose photo or mascot"
              >
                {isMascot ? (
                  <Bomb size={40} color="white" fill="white" />
                ) : (
                  <img src={guestAvatar} alt="" className="w-full h-full object-cover" />
                )}
                <span className="absolute bottom-0 right-0 bg-white rounded-full p-1 ink-border-sm">
                  <Camera size={12} />
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
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your nickname"
                  maxLength={20}
                  className="ink-border-sm rounded-xl px-3 py-2 text-base font-bold bg-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs font-black opacity-80 flex items-center gap-1"
                >
                  <Camera size={12} /> {isMascot ? "Add photo" : "Change photo"}
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 flex-wrap">
              <span className="text-xs font-bold opacity-60 self-center mr-1">Mascot:</span>
              {MASCOT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setGuestAvatar(`mascot:${c}`)}
                  className="w-7 h-7 rounded-full"
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

            <button
              type="button"
              disabled={busy || !guestName.trim()}
              onClick={submitGuest}
              className="btn-boom py-3 mt-1 disabled:opacity-50"
              style={{ background: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}
            >
              <Check size={18} className="inline mr-1" /> Play as guest
            </button>
            <button
              type="button"
              onClick={() => setView("choose")}
              className="text-xs font-black opacity-70 underline"
            >
              ← back to options
            </button>
          </div>
        )}

        {view === "phone" && (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold opacity-70">
              Enter your phone number (with country code)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8901"
              className="ink-border-sm rounded-xl px-3 py-2 text-base font-bold bg-white"
              autoFocus
            />
            <button
              type="button"
              disabled={busy || !phone.trim()}
              onClick={requestPhoneCode}
              className="btn-boom py-3 disabled:opacity-50"
              style={{ background: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}
            >
              {busy ? "Sending…" : "Send SMS code"}
            </button>
            <button
              type="button"
              onClick={() => setView("choose")}
              className="text-xs font-black opacity-70 underline"
            >
              ← back to options
            </button>
          </div>
        )}

        {view === "phone-verify" && (
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold opacity-70">Enter the code from SMS</label>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="000000"
              maxLength={8}
              className="ink-border-sm rounded-xl px-3 py-2 text-base font-bold bg-white text-center tracking-[0.5em]"
              autoFocus
            />
            <button
              type="button"
              disabled={busy || !otp.trim()}
              onClick={verifyPhone}
              className="btn-boom py-3 disabled:opacity-50"
              style={{ background: "var(--boom-red)", fontFamily: "'Luckiest Guy', cursive" }}
            >
              {busy ? "Verifying…" : "Verify & join"}
            </button>
            <button
              type="button"
              onClick={() => setView("phone")}
              className="text-xs font-black opacity-70 underline"
            >
              ← change phone number
            </button>
          </div>
        )}

        {(view === "email-in" || view === "email-up") && (
          <form onSubmit={submitEmail} className="flex flex-col gap-2">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ink-border-sm rounded-xl px-3 py-2 font-bold"
              autoFocus
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
              <Mail size={16} className="inline mr-1" />
              {view === "email-up" ? "Create account" : "Sign in"}
            </button>
            <div className="flex justify-between text-xs font-bold opacity-70">
              <button type="button" onClick={() => setView("choose")}>
                ← back
              </button>
              <button
                type="button"
                onClick={() => setView(view === "email-up" ? "email-in" : "email-up")}
              >
                {view === "email-up" ? "Have an account?" : "New here?"}
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
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
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

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.4-4.95-4.95-4.2-12.04 1.4-12.4 1.14-.07 2.08.39 2.81.39.74 0 2.1-.48 3.22-.41 1.36.09 2.38.56 3.08 1.41-2.76 1.65-2.29 5.98.22 7.13-.57 1.5-1.31 2.99-2.35 4.88zm-5.85-15.1c.07-1.59 1.3-2.99 2.89-3.05.22 1.69-1.43 3.63-2.89 3.05z" />
    </svg>
  );
}
