import { PlayerToken, playerColor } from "@/components/PlayerToken";
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
 * Each team gets a personalised bomb mascot in its team color.
 */
export function GameStartReveal({ players }: { players: Player[] }) {
  const teams = players
    .reduce<Array<{ id: string; name: string; color: string; members: Player[] }>>((acc, p) => {
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
    }, [])
    .slice(0, 3);
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
            <div
              key={team.id}
              className="ink-border rounded-3xl bg-white px-5 py-4 flex flex-col items-center gap-3 anim-mascot-pop min-w-[13rem]"
            >
              <PlayerToken
                avatar={null}
                username={team.name}
                size={132}
                active
                showName={false}
                showInitial={false}
                ringColor={team.color}
                mascot
              />
              <div
                className="text-3xl font-black text-center leading-none"
                style={{
                  fontFamily: "'Luckiest Guy', cursive",
                  color: team.color,
                  textShadow: "2px 2px 0 #000",
                }}
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
                    mascot
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
