import { PlayerToken, playerColor } from "@/components/PlayerToken";
import bombMascot from "@/assets/bomb-mascot.png";
import { teamColor, teamName } from "@/lib/game";

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
  const teams = players.reduce<Array<{ id: string; name: string; color: string; members: Player[] }>>((acc, p) => {
    const id = p.team_id ?? p.id;
    let team = acc.find((t) => t.id === id);
    if (!team) {
      team = {
        id,
        name: p.team_id ? teamName(p.team_id) : p.username,
        color: p.team_id ? teamColor(p.team_id) : playerColor(p.username),
        members: [],
      };
      acc.push(team);
    }
    team.members.push(p);
    return acc;
  }, []).slice(0, 3);
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
      <div className="flex flex-wrap items-stretch justify-center gap-6 max-w-[94vw]">
        {teams.map((team) => {
          return (
            <div key={team.id} className="ink-border rounded-3xl bg-white px-5 py-4 flex flex-col items-center gap-3 anim-mascot-pop min-w-[13rem]">
              <div className="relative" style={{ width: 132, height: 132 }}>
                <img
                  src={bombMascot}
                  alt=""
                  width={256}
                  height={256}
                  className="absolute inset-0 w-full h-full anim-fuse"
                  style={{
                    filter: `drop-shadow(0 0 28px ${team.color})`,
                  }}
                />
                <div
                  className="absolute inset-0 rounded-full mix-blend-multiply pointer-events-none"
                  style={{ background: team.color, opacity: 0.35 }}
                />
              </div>
              <div
                className="text-3xl font-black text-center leading-none"
                style={{ fontFamily: "'Luckiest Guy', cursive", color: team.color, textShadow: "2px 2px 0 #000" }}
              >
                {team.name.toUpperCase()}
              </div>
              <div className="flex -space-x-2 justify-center">
                {team.members.slice(0, 4).map((p) => (
                  <PlayerToken
                    key={p.id}
                    avatar={p.avatar_url}
                    username={p.username}
                    size={62}
                    active
                    showName={false}
                    showInitial
                    ringColor={team.color}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
