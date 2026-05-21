# Single-Phone Pod Mode

Replace the multi-device player flow with one shared phone that rotates between 3 players. The host's device runs the whole game.

## What gets removed

- `src/routes/join.tsx` — no QR join, no per-player phones
- `src/routes/play.$code.tsx` — old per-player view
- `src/components/ShareLinkButton.tsx` usage in lobby (no link to share)
- Multi-device judging logic (`getJudgeId` rotation against arbitrary player counts, `trap.awaiting_verification` cross-device handoff)

The `rooms` / `players` / `workout_logs` tables stay — they still persist game state so a refresh on the host phone doesn't lose progress.

## New flow

### 1. Setup (in `gym.$code.tsx`, the lobby)

Host sees a "Build your pod" screen instead of a QR code:
- Three player slots (A, B, C), each with:
  - Name input
  - Avatar: upload photo **or** pick "Boom mascot" + color swatch (pink/cyan/lime/yellow/orange/purple)
  - Fitness level: 3 buttons — **Base** (→ stored as 3), **Intermediate** (→ 6), **Advanced** (→ 9), mapping into the existing 1–10 `fitness_level` column so reps math keeps working
- "START" button (disabled until all 3 names are filled) → inserts 3 rows in `players`, sets `rooms.status = 'playing'`, navigates to `/pod/$code`

### 2. Pod gameplay (new `src/routes/pod.$code.tsx`)

One route, four UI states driven by a local `phase` state machine: `player → switch → judge → resolve`.

**Player UI (phase: `player`)**
- Full-screen avatar of the active player + their name
- Big "ROLL" dice box (reuses existing dice animation)
- No camera, no leaderboard
- Bottom: horizontal progress bar (full width) with 3 small player tokens positioned at `left: (current_space-1)/59 * 100%`. Finish line marker at the right end.
- Roll → animate dice → compute landing space (reuses `getCell`, `resolveMovementLanding`, `pickSurpriseExercise`, etc.) → write `current_space` → if landing is an exercise/surprise/crazy/group cell, go to `switch`. If it's boost/setback with no exercise, animate the slide on the bar and stay in `player` for the same player's next roll? No — pass to next player. (Boost/setback resolves and turn passes; matches existing behavior.)

**Switch UI (phase: `switch`)**
- Full-screen animation: active player avatar slides left labeled "PLAYER", next-in-rotation avatar slides right labeled "JUDGE"
- Exercise card in the middle (icon + name + reps/seconds)
- SpeechSynthesis announces: *"Player {A}. {Exercise}. Judge is {B}."* using a robotic voice (pick a `SpeechSynthesisVoice` matching `/Google|Microsoft|en-US/` and set `pitch=0.4, rate=0.85` for the robotic feel; existing `sfx.ts` gets a `speak()` helper)
- 3-2-1 countdown overlay, then auto-transition to `judge`

**Judge UI (phase: `judge`)**
- `<video>` element showing `getUserMedia({ video: { facingMode: 'user' }, audio: false })` live preview, full-screen
- Overlays in corners: Boom logo (top-left), mascot (top-right), `boomworkout.fun` (bottom-left), points so far (bottom-right)
- Bottom-center: large circular SVG ring that closes as the trap timer runs down (uses `TRAP_TIMEOUT_MS` and a known `started_at`). Inside the ring: **DEFUSE** button.
- `MediaRecorder` starts when the phase enters and stops on completion/failure. The blob is kept in a `useRef<Map<turnId, Blob>>` (in-memory only — no upload, no stitching).
- **Reps exercises**: tap DEFUSE per rep. Each tap plays a tone whose pitch rises with `repCount / target` (Web Audio API oscillator). Completing the last rep triggers the "well done" SFX.
- **Seconds exercises**: hold DEFUSE. While held, accumulate `hold_ms`. Show a growing inner fill on the ring. Release before target = reset. Reaching target = success.
- Background: rising arcade tone tied to elapsed/`TRAP_TIMEOUT_MS` ratio.
- Success → robotic voice "Well done {Player A}, {points} points" → write `workout_logs` row → recalc score → go to next player's `player` phase.
- Timeout → boom SFX + voice "Player {A} exploded! Back to start" → reset that player's `current_space` to 0 → go to next player's `player` phase.

**Finish line**
- When a player's `current_space` reaches 60 after a successful trap: full-screen flash (white → orange → red), winner avatar zooms in with bomb particles, voice says "Player {X} wins!". Reuses `ExplosionOverlay`.

**Wrap-up (phase: `done`)**
- Ranking list with avatar, name, points, finish rank (uses existing `finishPlayer` + `recalcPlayerScore`)
- Per-turn clip gallery: list of recorded blobs with thumbnails (first-frame canvas snapshot) and download/share buttons (`navigator.share` with the blob when supported, else a download link). No stitched summary — labeled "Coming soon".
- "PLAY AGAIN" button → resets room (clears players' `current_space`, `score`, `finished_at`; sets `status='lobby'`) → navigates back to `/gym/$code`.

## Technical details

**Rotation**: helper `nextPlayerId(players, currentId)` — sort by `joined_at`, return next; cycles A→B→C→A. Skips finished players.

**State machine in `pod.$code.tsx`**:
```ts
type Phase =
  | { kind: 'player'; playerId: string }
  | { kind: 'switch'; playerId: string; judgeId: string; trap: Trap }
  | { kind: 'judge';  playerId: string; judgeId: string; trap: Trap; startedAt: number }
  | { kind: 'resolve'; outcome: 'success' | 'fail'; playerId: string }
  | { kind: 'done'; winnerId: string }
```
Persisted to `rooms.trap` JSON for refresh resilience (already a JSONB column).

**Voice helper** (`src/lib/sfx.ts`):
```ts
export function speak(text: string, opts?: { pitch?: number; rate?: number }) { ... }
```
Picks a robotic-sounding voice from `speechSynthesis.getVoices()`, defaults `pitch=0.4, rate=0.85, volume=1`. Cancels prior utterances.

**Camera permission**: requested on first entry to `judge` phase; if denied, show fallback UI ("Enable camera to continue") with a retry button — the game still works without recording, just no clip is captured.

**Recording lifecycle**: one `MediaRecorder` instance per turn. Stream is acquired once at game start (when first entering `judge`) and reused; recorder is `start()`/`stop()`-ed per turn. Blobs accumulated in `useRef`.

**Fitness mapping**: lobby stores `fitness_level` as 3/6/9; existing `calcRepsForTier` already takes 1–10, so reps math is unchanged.

**Mascot avatar persistence**: when host picks the mascot, store `avatar_url = null` and add a new column? No — encode it as a sentinel like `mascot:#ec4899` in `avatar_url` (text). `PlayerToken` already supports `mascot` prop; read the sentinel and render accordingly. Avoids a migration.

## Files changed

- **New**: `src/routes/pod.$code.tsx`, `src/components/pod/PlayerPhase.tsx`, `src/components/pod/SwitchPhase.tsx`, `src/components/pod/JudgePhase.tsx`, `src/components/pod/WrapUp.tsx`, `src/components/pod/ProgressBar.tsx`, `src/components/pod/CameraOverlay.tsx`
- **Rewritten**: `src/routes/gym.$code.tsx` (lobby becomes pod setup)
- **Edited**: `src/lib/sfx.ts` (add `speak`, rising tone, boom), `src/routes/index.tsx` (CTA → "Start a Pod")
- **Deleted**: `src/routes/join.tsx`, `src/routes/play.$code.tsx`

## Out of scope (called out explicitly)

- Server-side video stitching / summary edit — the wrap-up labels this "Coming soon"
- Cross-device play — fully removed
- Social-media-native share targets beyond the Web Share API
