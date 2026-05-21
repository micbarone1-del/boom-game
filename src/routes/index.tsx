import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Bomb, Music, LogIn } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";

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
  const tryJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const c = joinCode.trim().toUpperCase();
    if (!c) return;
    navigate({ to: "/join/$code", params: { code: c } });
  };
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center">
        <img
          src={bombMascot}
          alt="BOOM mascot — excited cartoon bomb with a lit fuse"
          width={1024}
          height={1024}
          fetchPriority="high"
          decoding="async"
          className="mx-auto w-40 md:w-56 anim-fuse"
        />
        <h1
          className="comic-shadow"
          style={{
            fontFamily: "'Luckiest Guy', cursive",
            fontSize: "clamp(4rem, 14vw, 9rem)",
            color: "var(--boom-red)",
            lineHeight: 1,
          }}
        >
          BOOM!
        </h1>
        <p className="mt-2 text-sm md:text-base" style={{ color: "var(--boom-ink)" }}>
          A gym room. Up to 3 pods. Hot-potato workout chaos.
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          to="/gym/$code"
          params={{ code: "new" }}
          className="ink-border rounded-3xl px-8 py-5 flex items-center justify-center gap-3 hover:-translate-y-1 transition-transform"
          style={{ background: "var(--boom-yellow)" }}
        >
          <Music size={36} style={{ color: "var(--boom-ink)" }} />
          <span
            className="text-2xl font-black comic-shadow"
            style={{ color: "var(--boom-ink)", fontFamily: "'Luckiest Guy', cursive" }}
          >
            HOST GYM
          </span>
        </Link>
        <form
          onSubmit={tryJoin}
          className="ink-border rounded-3xl px-5 py-4 flex flex-col gap-3"
          style={{ background: "var(--boom-red)" }}
        >
          <div className="flex items-center gap-2 justify-center">
            <Bomb size={28} style={{ color: "white" }} />
            <span
              className="text-2xl font-black comic-shadow"
              style={{ color: "white", fontFamily: "'Luckiest Guy', cursive" }}
            >
              JOIN POD
            </span>
          </div>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={12}
            className="ink-border-sm rounded-xl px-3 py-2 text-center text-xl font-black bg-white tracking-widest"
            style={{ fontFamily: "'Luckiest Guy', cursive" }}
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="ink-border-sm rounded-xl px-4 py-2 bg-white font-black flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn size={16} /> Go
          </button>
        </form>
      </div>
    </main>
  );
}
