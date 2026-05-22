## 1. Pod-first flow (no room code required)

- Home page: keep "JOIN POD" (with code) but rename the primary CTA to **"START PLAYING"** which:
  - creates a new room behind the scenes (`rooms` insert with generated code)
  - creates Pod 1 in that room
  - navigates straight to `/join/<code>` pre-scoped to slot 1 so the user just enters players
- "HOST GYM" becomes a small secondary link ("Have a big screen? Host the gym →").
- After a solo pod is created, surface the room code inside the pod UI ("Share code <ABCD> to add more pods or open the gym screen") with a copy button — so they can upgrade to a gym later.

## 2. Gym button readability on Home

- Apply `color: #fff` + `text-shadow: 2px 2px 0 #000, 0 0 6px rgba(0,0,0,.6)` (and matching `comic-shadow`) to the HOST GYM button so it reads on the colored background regardless of variant.

## 3. Restore the old gym build (lobby + shared map)

Lobby (`/gym/$code`) keeps current pod cards (slot, members, fitness), QR + room code, Spotify, START — that part stays, but is wrapped into the **two-phase gym screen** from the old build:

- **Phase `lobby`** (when `rooms.status = 'lobby'`): current QR + pod cards layout.
- **Phase `playing`** (when `rooms.status = 'playing'`): swap to the old **shared game map**:
  - Big static board with all spaces (reuse `BOARD` from `src/lib/game.ts`) — never re-centers, never zooms; always shows the full path.
  - One token per player from every pod, colored by pod slot (yellow/orange/green), placed at `players.current_space`.
  - **Active player token flashes** (`animate-pulse` + glow) for each pod's `current_turn_player_id`; tokens of players currently mid-exercise also flash in a different hue.
  - Hopping/cell animations are removed from the gym map — the map stays static. Instead, render a **bottom strip of up to 3 pop-up boxes** (one per pod) that show "Pod 1 — Alice is doing 12 Burpees!" / "Pod 2 hopped to space 14!" with the cell mascot inline. These pop-ups auto-dismiss after ~3s.
  - Top bar: fuse timer (see §4), room code, pod scoreboard.

Pod screen (`/pod/$code/$podId`) keeps its own zoom/hop animation as today — those are pod-local and remain on the phone only.

## 4. 15-minute game fuse + continue / game-over flow

### Schema
Add to `rooms`:
- `game_started_at timestamptz null`
- `game_ends_at timestamptz null` (set to `now() + interval '15 minutes'` when START is pressed or when a solo pod auto-starts)
- `game_state text default 'idle'` — values: `idle | playing | timeout_continue | game_over`
- `continue_deadline_at timestamptz null` (set when state flips to `timeout_continue`, +10s)

START flow now also stamps `game_started_at`, `game_ends_at`, `game_state='playing'`.

### Bottom fuse bar (pod UI)
Replace current bottom progress bar with a **horizontal fuse**:
- Track = full width, fuse drawn from left→right based on `(now - game_started_at) / 15min`.
- Flame sprite (`Flame` icon, existing `anim-fuse`) sits at the burn point, leaves a charred trail behind.
- Same component used on the gym map top bar.

### Audio acceleration
In `src/lib/sfx.ts`, add a `setBgmIntensity(progress)` helper that ramps the arcade BGM `playbackRate` from 1.0 → 1.35 and `gain` from current → +6dB as `progress` goes 0 → 1. Pod & gym call it from a 1s interval driven by `game_ends_at`.

### Timeout (no finisher within 15 min)
When `now >= game_ends_at` and `game_state='playing'` and no player has `finished_at`:
- First client to detect flips `game_state='timeout_continue'`, sets `continue_deadline_at = now + 10s`.
- Gym + every pod show big **explosion overlay** (reuse `ExplosionOverlay`) with text **"TIME'S OUT!"** + arcade boom SFX + robot voice "Time's out!".
- Below explosion: 10→0 countdown and a big **CONTINUE** button (pod UI only — gym just shows the countdown).
- If any pod presses CONTINUE: set `game_state='playing'`, `game_ends_at = now + 5min` (configurable; default another 5 min so they can finish), keep all `current_space` values.
- If countdown hits 0 with no continue: set `game_state='game_over'`.

### Game over
- Both gym + pod show **GAME OVER** (big Luckiest Guy text) with arcade lose SFX + robot voice "Game over".
- Pod UI also shows a **RESTART POD** button below (reuses existing pod reset logic — clear `current_space`, `finished_at`, etc. for this pod's players, set pod `status='playing'`, and ALSO reset `game_started_at/game_ends_at/game_state` on the room so the fuse restarts for everyone in the room).

## Out of scope
- Per-pod independent fuse timers (single shared 15-min clock for the room).
- Scoring rework / leaderboards.
- Auth.

## File touch list
- `supabase/migrations/<new>.sql` — add room timer columns + state.
- `src/hooks/use-room.ts` — surface new room fields (already spreads `*`, just extend `Room` type).
- `src/routes/index.tsx` — START PLAYING (solo auto-create) + small "Host gym" link.
- `src/routes/gym.$code.tsx` — split into Lobby vs MapView; add shared static map + bottom pop-up strip + top fuse.
- `src/routes/pod.$code.$podId.tsx` — replace bottom bar with fuse, wire BGM intensity, add timeout/continue/game-over overlays + restart button, show room code share chip.
- `src/components/FuseBar.tsx` (new) — horizontal fuse with flame head.
- `src/components/GymMap.tsx` (new) — static board + per-pod tokens (extracted from old build).
- `src/components/PodActivityTicker.tsx` (new) — bottom pop-up strip on gym.
- `src/components/TimeoutOverlay.tsx` (new) — explosion + 10s continue + game-over states.
- `src/lib/sfx.ts` — `setBgmIntensity`, `playTimesOut`, `playGameOver`, robot-voice helpers (reuse existing TTS).

Proceed?