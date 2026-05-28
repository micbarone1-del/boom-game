# Plan

Six independent changes. I'll keep them surgical and avoid touching unrelated game logic.

## 1. Boss fight: rolling screen + wheel of fortune

Replace the boss-fight random exercise picker (currently `Math.random() < 0.5 ? pickCrazyExercise() : pickSurpriseExercise()`) with an explicit two-step UX in `src/components/BossPhase.tsx`:

- New `InnerPhase` state: `{ kind: "roll"; player }` runs before `switch`.
- Roll screen shows the current player ("Player X — spin to attack!") and a SVG wheel of fortune with all cell types from the board (easy / medium / hard / surprise / crazy / group / pause replaced by two new attack types):
  - **Special Move** (replaces boost) — picks a hard-tier exercise, damage ×2
  - **Super Power** (replaces penalty) — picks a crazy-tier exercise, damage ×3 AND triggers a **pod-wide attack**: every pod player completes the rep count and damage = sum of all members' reps
- Wheel spins on tap, lands on a wedge with eased deceleration, then transitions into the existing `BossSwitch` / `BossJudge` flow.
- Damage calculation in `onJudgeDone` updates: special = reps×2, super = reps×3 × (number of active pod members) summed.

## 2. Pause flow: PLAY returns to pod, in-pause join

Two changes:

**(a) PLAY from lobby resumes into the active pod, not the gym lobby.** In `src/routes/gym.$code.tsx` `Lobby.resume()`, after clearing `paused`, navigate the host's pod view back to `/pod/$code/$podId` if the current device has an associated pod. For the gym (host) screen, it stays on the map. The fix is: when paused, the pod page currently auto-navigates to `/gym/$code` after 1.4s — change it so it stays on the pod page and just shows the PauseOverlay until `paused` flips back, so the pod naturally resumes in place.

**(b) Pause overlay shows join/create options.** Extend `src/components/PauseOverlay.tsx` to render, alongside RESUME, the same pod-management UI as the gym lobby: room QR/code, list of pods with seats, "Create pod" / "Join pod" buttons. New players can scan and join while the game is paused. Replicate the same in-game pod card list inside the lobby screen too (it's already there — just ensure parity).

## 3. Hopping animation reliability + cell layout

In the hop animation component (lives in pod page, near `onRollComplete`):

- Ensure every roll plays the hop sequence — current bug: sometimes the state transitions skip frames. Make the hop a blocking promise that always runs `dice` frames, then resolves before `setPhase` is called.
- The "zoomed-in mini-board" strip during the hop currently renders cells in a straight horizontal row. Refactor it to read the actual board path geometry (from `cellPos` in `GymMap`) so the zoomed view mirrors the real serpentine layout (rows reversing direction every row).
- Cell icons inside the hop strip: force `color: #fff`, `stroke-width: 2.25`, and `width/height: 100%` so they always fill the box with consistent monochrome thickness.

## 4. End-of-boss & fuse-end transitions

**Boss victory:** already routes to `WrapUp` via `room.phase === "victory"`. Verify `WrapUp` actually shows the leaderboard + recap video + share + login. If currently frozen, the issue is likely that `WrapUp` is gated on a phase the BossPhase death sequence never sets. Fix: in `BossPhase.tsx` death timeout, ensure `phase: "victory"` is written and `WrapUp` mounts.

**Fuse end (TIME'S OUT):** currently `TimesOutOverlay` runs, but explosion + continue flow is incomplete on the pod page when no one finishes. Wire:
1. Fuse hits 0 → `game_state = "timeout_continue"` + `continue_deadline_at = now+10s` (already there).
2. `ExplosionOverlay` plays for ~1.6s before the `TimesOutOverlay` continue countdown.
3. If "CONTINUE" pressed → existing `onContinue` extends by 5 min.
4. If timer expires → `game_state = "game_over"` → `GameOverOverlay` followed by automatic transition to `WrapUp` leaderboard (same component as boss victory). Currently it only shows `GameOverOverlay` with a restart button — add a "VIEW LEADERBOARD" button that flips `room.phase = "victory"` so `WrapUp` mounts.

## 5. Switch screen text contrast

In `BossSwitch` and the main pod switch phase, "Player" and "Judge" labels are styled with `color: "var(--boom-red)"` / `var(--boom-yellow)` on a white background — but the player **name** below uses `color: "var(--boom-ink)"` which is fine. The issue per the screenshot: text inside the switch / pass-the-phone screen reads as black on a dark background somewhere. Audit `src/routes/pod.$code.$podId.tsx` SwitchScreen render and `BossSwitch` — set explicit `color: var(--boom-ink)` on a white surface and `color: #fff` on dark surfaces. No layout change.

---

## Technical notes

- Wheel: pure CSS/SVG (no new deps). Each wedge a `<path>` arc with a label rotated to the wedge center. Spin = CSS `transform: rotate()` with `transition: transform 4s cubic-bezier(0.17, 0.67, 0.21, 0.99)`, target rotation = `360 * spins + wedgeAngle`.
- Hop geometry: import `cellPos`, `COLS`, `ROWS` from `src/components/GymMap.tsx` (already exported) and map the `dice` cells to their `{row, col}` positions so the strip can render a small-scale serpentine.
- WrapUp gate: verify by reading the existing `WrapUp` component and the `room.phase === "victory"` branch (already present at pod.$code.$podId.tsx:465).
- All DB writes use existing `rooms`/`workout_logs`/`players` tables; no migration needed.

## Files touched

- `src/components/BossPhase.tsx` (wheel + special/super damage)
- `src/components/PauseOverlay.tsx` (in-pause join UI)
- `src/routes/pod.$code.$podId.tsx` (stop auto-nav on pause; hop animation reliability + geometry + icon styling; fuse-end → WrapUp transition; switch screen contrast)
- `src/routes/gym.$code.tsx` (PLAY navigates back to active pod if applicable)
- `src/styles.css` (any new keyframes for wheel spin / explosion-to-continue transition)

No schema changes.
