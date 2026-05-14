import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Tv, Smartphone } from "lucide-react";
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
          The explosive workout party game
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-3xl mt-4">
        <Link
          to="/gym/new"
          className="ink-border rounded-3xl p-8 flex flex-col items-center gap-3 hover:-translate-y-1 transition-transform"
          style={{ background: "var(--boom-yellow)" }}
        >
          <Tv size={64} style={{ color: "var(--boom-ink)" }} />
          <h2 className="text-3xl font-black comic-shadow" style={{ color: "white" }}>
            GYM SCREEN
          </h2>
          <p className="text-center font-bold" style={{ color: "var(--boom-ink)" }}>
            Big TV / iPad master view. Shows the board for everyone.
          </p>
        </Link>

        <Link
          to="/join"
          className="ink-border rounded-3xl p-8 flex flex-col items-center gap-3 hover:-translate-y-1 transition-transform"
          style={{ background: "var(--boom-red)" }}
        >
          <Smartphone size={64} style={{ color: "white" }} />
          <h2 className="text-3xl font-black comic-shadow" style={{ color: "white" }}>
            JOIN GAME
          </h2>
          <p className="text-center font-bold" style={{ color: "white" }}>
            Phone controller. Roll dice, log reps, judge form.
          </p>
        </Link>
      </div>
    </main>
  );
}
