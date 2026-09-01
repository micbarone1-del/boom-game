import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bomb, Music, LogIn, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sfx, startArcadeMusic, setMusicPhase } from "@/lib/sfx";
import { generateRoomCode } from "@/lib/game";
import bombMascot from "@/assets/bomb-mascot.png";
import { useAttractVideo } from "@/hooks/use-attract-video";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "BOOM! — The Workout Game" },
      { name: "description", content: "BOOM! is a chaotic real-time multiplayer party-fitness game. Roll dice, dodge traps, and blast through workouts with friends." },
      { property: "og:title", content: "BOOM! — The Workout Game" },
      { property: "og:description", content: "Real-time multiplayer party-fitness game. Roll dice, dodge traps, and blast through workouts with friends." },
      { property: "og:url", content: "https://boom-game.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://boom-game.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "BOOM! — The Workout Game",
          url: "https://boom-game.lovable.app/",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "BOOM!",
          url: "https://boom-game.lovable.app/",
          logo: "https://boom-game.lovable.app/favicon.ico",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "VideoGame",
          name: "BOOM! — The Workout Game",
          url: "https://boom-game.lovable.app/",
          description: "A chaotic real-time multiplayer party-fitness game. Roll dice, dodge traps, and blast through workouts with friends.",
          genre: ["Party", "Fitness", "Multiplayer"],
          applicationCategory: "GameApplication",
          operatingSystem: "Web",
        }),
      },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [attract, setAttract] = useState(true);
  // The intro sting plays once every time the player lands on the home
  // screen, then the attract reel takes over behind "PRESS TO START".
  const [intro, setIntro] = useState(true);
  const introRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startVideoRef = useRef<HTMLVideoElement | null>(null);
  const [introMuted, setIntroMuted] = useState(false);
  useAttractVideo(videoRef, attract && !intro);
  useAttractVideo(startVideoRef, !attract && !intro);

  const startPressed = () => setAttract(false);
  const endIntro = () => setIntro(false);

  useEffect(() => {
    if (!intro) return;
    const video = introRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.load();
    // Try with sound first; browsers that block it fall back to muted
    // playback and unmute as soon as the visitor touches the screen.
    video.muted = false;
    video.volume = 1;
    setIntroMuted(false);
    void video.play().catch(() => {
      video.muted = true;
      video.defaultMuted = true;
      setIntroMuted(true);
      void video.play().catch(() => {});
    });
    // Any interaction anywhere counts as the gesture browsers require, so
    // keep retrying until the sound actually comes through.
    const retry = () => {
      if (!video.muted) return;
      video.muted = false;
      video.volume = 1;
      void video
        .play()
        .then(() => setIntroMuted(false))
        .catch(() => {
          video.muted = true;
          setIntroMuted(true);
          void video.play().catch(() => {});
        });
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "touchstart", "click", "keydown"];
    events.forEach((e) => window.addEventListener(e, retry));
    const failSafe = window.setTimeout(endIntro, 14_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, retry));
      window.clearTimeout(failSafe);
    };
  }, [intro]);

  const toggleIntroSound = () => {
    const video = introRef.current;
    if (!video) return;
    if (!video.muted) {
      video.muted = true;
      setIntroMuted(true);
      return;
    }
    video.muted = false;
    video.volume = 1;
    void video
      .play()
      .then(() => setIntroMuted(false))
      .catch(() => {});
  };




  // Attract-mode soundtrack: retro techno bed under the reel. Autoplay
  // policies mean it can only start once the visitor touches the screen.
  useEffect(() => {
    if (!attract || intro) return;

    setMusicPhase("attract");
    const kick = () => {
      void sfx.unlock().then(() => startArcadeMusic());
    };
    kick();
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, [attract, intro]);

  const tryJoin = (e: React.FormEvent) => {

    e.preventDefault();
    const c = joinCode.trim().toUpperCase();
    if (!c) return;
    navigate({ to: "/join/$code", params: { code: c }, search: { auto: undefined, join: undefined } });
  };
  const startSolo = async () => {
    if (creating) return;
    setCreating(true);
    const code = generateRoomCode();
    const { error } = await supabase.from("rooms").insert({ code });
    if (error) {
      setCreating(false);
      return;
    }
    // Land in the player lobby — pods are created and joined from there.
    navigate({ to: "/join/$code", params: { code }, search: { auto: undefined, join: undefined } });
  };
  if (intro) {
    return (
      <main className="fixed inset-0 bg-black overflow-hidden">
        <video
          autoPlay
          playsInline
          preload="auto"
          onEnded={endIntro}
          onError={() => {
            // Last-ditch: force the MP4 directly before giving up on the sting.
            const v = introRef.current;
            if (v && !v.dataset["fallback"]) {
              v.dataset["fallback"] = "1";
              v.src = "/media/intro.mp4?v=20260829f";
              v.load();
              void v.play().catch(() => endIntro());
              return;
            }
            endIntro();
          }}
          ref={introRef}
          aria-label="BOOM! intro"
          className="absolute inset-0 w-full h-full object-cover"
        >
          {/* H.264 first for Safari/iOS, VP9 fallback for browsers without it */}
          <source src="/media/intro.mp4?v=20260829f" type="video/mp4" />
          <source src="/media/intro.webm?v=20260829f" type="video/webm" />
        </video>


        <button
          onClick={toggleIntroSound}
          className="absolute bottom-6 left-5 z-10 ink-border-sm rounded-xl px-4 py-2 text-sm font-black uppercase active:scale-95"
          style={{ background: "var(--boom-yellow, #FFD23F)", fontFamily: "'Luckiest Guy', cursive" }}
        >
          {introMuted ? "🔇 Tap for sound" : "🔊 Tap to mute"}
        </button>


        <button
          onClick={endIntro}
          className="absolute bottom-6 right-5 z-10 ink-border-sm rounded-xl bg-white px-4 py-2 text-sm font-black uppercase active:scale-95"
        >
          Skip
        </button>
      </main>
    );
  }

  if (attract) {

    return (
      <main
        className="fixed inset-0 overflow-hidden"
        style={{ background: "radial-gradient(circle at 50% 35%, #2b1200, #000)" }}
      >
        {/* Full-screen attract reel — decorative, never blocks the start button */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/media/attract-poster.jpg?v=20260901a"
          aria-label="BOOM! gameplay attract reel"
          className="attract-video absolute inset-0 z-0 w-full h-full object-cover opacity-100"
        />

        {/* Tap anywhere to reveal the player start/join screen. */}
        <button
          onClick={startPressed}
          className="absolute inset-0 z-[1] w-full h-full flex flex-col items-center justify-between py-8 px-4"
          aria-label="Press to start"
          style={{ background: "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.15) 40%, rgba(0,0,0,.7))" }}
        >
          <div className="text-center">
            <img
              src={bombMascot}
              alt="BOOM mascot — excited cartoon bomb with a lit fuse"
              width={1024}
              height={1024}
              fetchPriority="high"
              decoding="async"
              className="mx-auto w-20 md:w-28 anim-fuse"
            />
            <h1
              className="comic-shadow"
              style={{
                fontFamily: "'Luckiest Guy', cursive",
                fontSize: "clamp(3rem, 14vw, 6rem)",
                color: "var(--boom-red)",
                lineHeight: 1,
              }}
            >
              BOOM!
            </h1>
          </div>

          <span
            className="anim-press-start"
            style={{
              fontFamily: "'Luckiest Guy', cursive",
              fontSize: "clamp(1.75rem, 8vw, 3rem)",
              color: "white",
              textShadow: "3px 3px 0 #000, 0 0 18px rgba(255,0,0,.8)",
            }}
          >
            PRESS TO START
          </span>

          <span className="mb-12 text-xs font-black" style={{ color: "rgba(255,255,255,.8)" }}>
            Up to 3 pods · hot-potato workout chaos
          </span>
        </button>

        {/* Escape hatches — don't trigger the full-screen start button */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-4 z-10">
          <button
            onClick={() => setAttract(false)}
            className="ink-border-sm rounded-xl px-3 py-1.5 bg-white text-xs font-black flex items-center gap-1"
          >
            <LogIn size={12} /> Join with code
          </button>
          <Link
            to="/gym/$code"
            params={{ code: "new" }}
            className="text-xs font-black underline flex items-center gap-1"
            style={{ color: "white", textShadow: "1px 1px 0 #000" }}
          >
            <Music size={12} /> Host the gym
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-[100svh] overflow-hidden flex flex-col items-center justify-center px-4 py-3 gap-3">
      {/* Same attract reel keeps looping behind the start / join controls */}
      <video
        ref={startVideoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/media/attract-poster.jpg?v=20260901a"
        aria-hidden="true"
        className="attract-video absolute inset-0 z-0 w-full h-full object-cover"
      />
      <div
        className="absolute inset-0 z-0"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,.65), rgba(0,0,0,.35) 45%, rgba(0,0,0,.75))" }}
      />
      <div className="relative z-10 text-center">
        <img
          src={bombMascot}
          alt="BOOM mascot — excited cartoon bomb with a lit fuse"
          width={1024}
          height={1024}
          decoding="async"
          className="mx-auto w-20 md:w-32 anim-fuse"
        />
        <h1
          className="comic-shadow"
          style={{
            fontFamily: "'Luckiest Guy', cursive",
            fontSize: "clamp(2.5rem, 10vw, 5rem)",
            color: "var(--boom-red)",
            lineHeight: 1,
          }}
        >
          BOOM!
        </h1>
        <p
          className="mt-1 text-sm md:text-base font-black uppercase"
          style={{ color: "white", fontFamily: "'Luckiest Guy', cursive", textShadow: "2px 2px 0 #000" }}
        >
          A gym room. Up to 3 pods. Hot-potato workout chaos.
        </p>
      </div>

      <div className="relative z-10 flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={startSolo}
          disabled={creating}
          className="btn-massive disabled:opacity-50"
          style={{ background: "var(--boom-red)" }}
        >
          <Play size={36} color="white" fill="white" />
          <span>{creating ? "IGNITING…" : "START PLAYING"}</span>
        </button>
        <form
          onSubmit={tryJoin}
          className="ink-border rounded-2xl px-3 py-2 flex flex-col gap-2"
          style={{ background: "var(--boom-orange)" }}
        >
          <div className="flex items-center gap-2 justify-center">
            <Bomb size={20} style={{ color: "white" }} />
            <span
              className="text-lg font-black"
              style={{
                color: "white",
                fontFamily: "'Luckiest Guy', cursive",
                textShadow: "2px 2px 0 #000, 0 0 6px rgba(0,0,0,.5)",
              }}
            >
              JOIN POD
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={12}
              className="flex-1 min-w-0 ink-border-sm rounded-xl px-2 py-1.5 text-center text-base font-black bg-white tracking-widest"
              style={{ fontFamily: "'Luckiest Guy', cursive" }}
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="ink-border-sm rounded-xl px-3 py-1.5 bg-white font-black flex items-center justify-center gap-1 disabled:opacity-50 text-sm"
            >
              <LogIn size={14} /> Go
            </button>
          </div>
        </form>
        <button
          onClick={() => setAttract(true)}
          className="text-center text-xs font-black underline opacity-90"
          style={{ color: "white", textShadow: "1px 1px 0 #000" }}
        >
          ← Back to attract mode
        </button>
        <Link
          to="/gym/$code"
          params={{ code: "new" }}
          className="text-center text-xs font-black underline opacity-90 flex items-center justify-center gap-1"
          style={{ color: "white", textShadow: "1px 1px 0 #000" }}
        >
          <Music size={12} /> Have a big screen? Host the gym →
        </Link>
      </div>
    </main>
  );
}

