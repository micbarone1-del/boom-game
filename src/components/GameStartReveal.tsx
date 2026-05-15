import { PlayerToken, playerColor } from "@/components/PlayerToken";
import bombMascot from "@/assets/bomb-mascot.png";

type Player = {
  id: string;
  username: string;
  avatar_url: string | null;
  team_id?: string | null;
};

/**
 * Pre-game reveal — flashes the line-up of players (or teams) with a giant
 * "LET'S START!" banner. Shown for ~2.6s before the first turn announcement.
 * Each player gets a personalised bomb mascot tinted with their token color
 * (placeholder for the upcoming team-color system).
 */
export function GameStartReveal({ players }: { players: Player[] }) {
  const list = players.slice(0, 8);
  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center gap-8 pointer-events-none bg-black/85 anim-mascot-pop">
      <div
        className="text-7xl md:text-9xl font-black comic-shadow anim-shake text-center px-6"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          color: "var(--boom-yellow)",
          textShadow: "6px 6px 0 #000, -3px -3px 0 #000",
          lineHeight: 1,
        }}
      >
        LET'S START!
      </div>
      <div className="flex flex-wrap items-end justify-center gap-6 max-w-[90vw]">
        {list.map((p) => {
          const color = playerColor(p.username);
          return (
            <div key={p.id} className="flex flex-col items-center gap-2 anim-mascot-pop">
              <div className="relative" style={{ width: 110, height: 110 }}>
                <img
                  src={bombMascot}
                  alt=""
                  width={256}
                  height={256}
                  className="absolute inset-0 w-full h-full anim-fuse"
                  style={{
                    filter: `drop-shadow(0 0 24px ${color})`,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full mix-blend-multiply pointer-events-none"
                  style={{ background: color, opacity: 0.35 }}
                />
              </div>
              <PlayerToken
                avatar={p.avatar_url}
                username={p.username}
                size={88}
                active
                showName={false}
                showInitial
              />
              <div
                className="text-2xl font-black text-white"
                style={{ fontFamily: "'Luckiest Guy', cursive", textShadow: "3px 3px 0 #000" }}
              >
                {p.username.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
