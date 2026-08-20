import { createFileRoute, redirect } from "@tanstack/react-router";
import bombMascot from "@/assets/bomb-mascot.png";

/**
 * QR-code deep link entry point: /join?room=ABC123
 * Captures the room id from the URL and jumps straight into the pod join
 * screen with the "Join the game" modal open.
 */
export const Route = createFileRoute("/join/")({
  validateSearch: (s: Record<string, unknown>) => ({
    room: typeof s.room === "string" && s.room.trim() ? s.room.trim() : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.room) {
      throw redirect({
        to: "/join/$code",
        params: { code: search.room.toUpperCase() },
        search: { join: 1 as const, auto: undefined },
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Join a game — BOOM!" },
      { name: "description", content: "Scan a BOOM! QR code to jump straight into a pod." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MissingRoom,
});

function MissingRoom() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 text-center">
      <img src={bombMascot} alt="" className="w-24 h-24 anim-fuse" />
      <h1
        className="text-3xl font-black"
        style={{ fontFamily: "'Luckiest Guy', cursive", color: "var(--boom-red)" }}
      >
        No room in this link
      </h1>
      <p className="text-sm font-bold opacity-70">
        Scan the QR code shown on the gym screen to join a game.
      </p>
    </main>
  );
}
