## What we're building

### 1. Room → Pods → Players model
- **Gym screen** (`/gym/$code`): big-screen lobby like the original build. Shows the **room code** + a **QR code** that points to a join URL. Lists the pods that have joined live, with their members and fitness levels. The host clicks **START** when ready.
- **Pod join** (new `/join/$code` route on the pod's phone): the shared pod phone opens this URL, picks a free pod slot (Pod 1 / 2 / 3), enters **2–4 player names + avatars + fitness levels**, then taps **READY**. The pod's screen then becomes the existing `/pod/$code/$podId` pass-and-play game UI.
- **Cap:** up to **3 pods per room**, **2–4 players per pod**. The lobby blocks a 4th pod from joining.

### 2. Switch animation
On the pod's switch phase, show the **cell color as the background**, the **mascot label** ("EASY PEASY!", "BEAST MODE!", "OH NOOO!", etc. from `CellMascot`), and the **exercise name + reps** prominently — instead of the current neutral panel.

## Technical details

### Schema migration
- Add `pods` table: `id uuid pk`, `room_code text fk`, `slot int` (1–3, unique per room), `name text` (e.g. "Pod 1"), `current_space int default 0`, `score int default 0`, `status text default 'lobby'`, `current_player_index int default 0`, `created_at`.
- Add `players.pod_id uuid` (nullable for backward compat); drop sole reliance on `room_code` for turn order. Players belong to a pod, pods belong to a room.
- Enable realtime on `pods`.
- Keep RLS open (existing pattern).

### Routes
- `/gym/$code` → rewrite as **lobby**: room code badge, QR code (use `qrcode.react`), live list of pods + their players (from `useRoom` extended with pods), Spotify embed, START button (sets `rooms.status = 'playing'`).
- `/join/$code` (new) → pod onboarding (the current "Build your Pod" form, but slot-aware). On submit: insert `pods` row + 2–4 `players` rows, then navigate to `/pod/$code/$podId`.
- `/pod/$code/$podId` → existing pod game UI, scoped to the pod's players + pod's `current_space`/turn. Turn rotation only cycles inside the pod. Game-board state (trap, dice) stays on `rooms` so all pods share difficulty/board overrides.
- `/` (home) → "Create room" → `/gym/new` (host) and "Join a room" → `/join/$code` (pod).

### Lobby ↔ pod sync
- `useRoom` extended to also fetch `pods` and group `players` by `pod_id`.
- Pod screen subscribes to its own pod row for `current_space` / `current_player_index` so the gym screen can show all 3 pods' progress on the shared board.

### Switch animation
- In `pod.$code.tsx` `SwitchPhase`, set the outer container background to `FLAVOR[cellType].color` (reusing the mapping from `CellMascot`), render the mascot image + label banner at the top, and keep the exercise name/reps large. Keep the countdown clearly separated below.

## Out of scope (will not touch)
- Per-pod scoring leaderboard rework (single shared board still applies; per-pod position is added but cross-pod ranking UI is unchanged).
- Auth / accounts.
- Spotify behavior beyond keeping the existing embed on the gym screen.

## File touch list
- `supabase/migrations/<new>.sql` — add `pods`, `players.pod_id`, realtime.
- `src/hooks/use-room.ts` — fetch + subscribe to `pods`.
- `src/routes/gym.$code.tsx` — rewrite as big-screen lobby with QR + pod list + START.
- `src/routes/join.$code.tsx` — new, pod onboarding form (adapted from current gym setup).
- `src/routes/pod.$code.$podId.tsx` — rename/refactor from `pod.$code.tsx` to be pod-scoped.
- `src/routes/index.tsx` — Create vs Join entry points.
- `src/routes/pod.$code.$podId.tsx` `SwitchPhase` — color background + mascot label.
- `bun add qrcode.react`.

Want me to proceed with this?