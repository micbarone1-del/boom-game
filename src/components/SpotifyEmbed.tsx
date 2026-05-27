import { useEffect, useState } from "react";
import { Music } from "lucide-react";

/**
 * Spotify playlist embed for the gym screen. Host pastes any Spotify URL
 * (playlist, album, track) and we render the official iframe player.
 * Selection persists per-room in localStorage. No login required.
 */

function parseSpotifyUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Match playlist|album|track|episode|show IDs from web URLs or URIs.
  const m =
    trimmed.match(/open\.spotify\.com\/(?:embed\/)?(playlist|album|track|episode|show)\/([a-zA-Z0-9]+)/) ||
    trimmed.match(/spotify:(playlist|album|track|episode|show):([a-zA-Z0-9]+)/);
  if (!m) return null;
  return `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`;
}

const DEFAULT_SPOTIFY_URL =
  "https://open.spotify.com/playlist/42TqVnzaMlUzg2fhDTHJEq?si=OAp8Cu7cQkGbh7wgiFP-eQ&pi=62fFMn7uShGrN";

export function SpotifyEmbed({ code, paused = false }: { code: string; paused?: boolean }) {
  const storageKey = `boom.spotify.${code}`;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(storageKey);
      const initial = saved ?? DEFAULT_SPOTIFY_URL;
      setUrl(initial);
      setEmbedUrl(parseSpotifyUrl(initial));
    } catch {}
  }, [storageKey]);

  const apply = (raw: string) => {
    const parsed = parseSpotifyUrl(raw);
    if (!parsed) {
      setError("Paste a Spotify playlist, album, or track link.");
      setEmbedUrl(null);
      return;
    }
    setError(null);
    setEmbedUrl(parsed);
    try {
      localStorage.setItem(storageKey, raw);
    } catch {}
  };

  const clear = () => {
    setUrl(DEFAULT_SPOTIFY_URL);
    setEmbedUrl(parseSpotifyUrl(DEFAULT_SPOTIFY_URL));
    setError(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  return (
    <div className="ink-border rounded-2xl bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 font-black text-base">
          <Music size={20} />
          GYM PLAYLIST
          {embedUrl && <span className="text-xs opacity-60 font-bold">(loaded)</span>}
        </div>
        <span className="text-xs font-bold opacity-70">{open ? "Hide" : "Edit"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs opacity-70">
            Paste a Spotify playlist, album, or track link. Open Spotify → Share → Copy link.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://open.spotify.com/playlist/..."
              className="flex-1 ink-border-sm rounded-xl px-3 py-2 text-sm font-bold bg-white"
            />
            <button
              type="button"
              onClick={() => apply(url)}
              className="ink-border-sm rounded-xl px-3 py-2 text-sm font-black bg-[var(--boom-green)] text-white"
            >
              LOAD
            </button>
            {embedUrl && (
              <button
                type="button"
                onClick={clear}
                className="ink-border-sm rounded-xl px-3 py-2 text-sm font-black bg-white"
              >
                CLEAR
              </button>
            )}
          </div>
          {error && <p className="text-xs font-black text-[var(--boom-red)]">{error}</p>}
        </div>
      )}

      {embedUrl && (
        <div className="mt-3 rounded-xl overflow-hidden ink-border-sm">
          <iframe
            title="Spotify player"
            // Swapping the src to about:blank tears down the audio stream
            // when the room is paused (Spotify embeds don't expose a
            // postMessage pause API to anonymous origins). On resume the
            // iframe reloads with the same playlist.
            src={paused ? "about:blank" : embedUrl}
            width="100%"
            height="152"
            frameBorder={0}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}