import { loadPlayerSession } from "./game";

const GUEST_KEY = "boom.guest";

type GuestMap = Record<
  string,
  {
    playerId: string;
    username: string;
    avatar_url: string;
  }
>;

export function saveGuestMap(roomCode: string, playerId: string, username: string, avatar_url: string) {
  if (typeof window === "undefined") return;
  const all: GuestMap = JSON.parse(localStorage.getItem(GUEST_KEY) || "{}");
  all[roomCode] = { playerId, username, avatar_url };
  localStorage.setItem(GUEST_KEY, JSON.stringify(all));
}

export function loadGuestMap(roomCode: string) {
  if (typeof window === "undefined") return null;
  try {
    const all: GuestMap = JSON.parse(localStorage.getItem(GUEST_KEY) || "{}");
    return all[roomCode] ?? null;
  } catch {
    return null;
  }
}

export function removeGuestMap(roomCode: string) {
  if (typeof window === "undefined") return;
  const all: GuestMap = JSON.parse(localStorage.getItem(GUEST_KEY) || "{}");
  delete all[roomCode];
  localStorage.setItem(GUEST_KEY, JSON.stringify(all));
}

/**
 * Return the guest player_id for this room if this device has one, and the
 * current browser session is not already a signed-in pod session. This lets a
 * guest who refreshed or reopened the join page pick up the same player slot.
 */
export function getReclaimableGuestId(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  const session = loadPlayerSession();
  if (session?.roomCode === roomCode) return null; // already signed in / in a pod
  return loadGuestMap(roomCode)?.playerId ?? null;
}
