# One-step login system for joining pods/games

## Goal
Replace the current multi-path auth flow with a single, low-friction "one step" login screen that appears when a user wants to join a pod or game. Players choose one of three quick options and are immediately linked to a profile that persists across games.

## Proposed approach
Use the existing Lovable Cloud managed auth backend (Google, Apple, SMS/Phone) and keep a guest/nickname fallback. No new third-party service is needed, but the UX will be simplified to a single modal/screen.

## What we will build

### 1. Unified "Join as…" modal
A single screen shown in the gym lobby and available from the pause/late-join screen.

Options (one tap each):
- **Play as Guest** — enter a nickname, no account.
- **Continue with Google** — one-tap social login.
- **Continue with Apple** — one-tap social login.
- **Continue with Phone** — enter phone number, receive SMS code, submit.

After selecting any method, the user is placed into the pod and, if authenticated, their `profiles` row is linked to the `players` row for stat accumulation.

### 2. Profile linking
- Re-use the existing `public.profiles` table.
- When an authenticated user joins a pod, set `players.user_id` to `auth.uid()` and copy `profiles.username` / `avatar_url` into the player card.
- If a guest later chooses to sign in mid-game, update their `players.user_id` and merge lifetime stats into `profiles`.

### 3. Late joiner / in-game login
- Add a "Sign in to save your stats" CTA inside the pause/lobby overlay and the post-game leaderboard.
- If a guest signs in during a game, the current session and pod membership are preserved; only the profile link is updated.

### 4. Third-party options review
We will **not** add new third-party providers (Clerk, Auth0, Firebase, etc.) because:
- Lovable Cloud already provides Google, Apple, and SMS auth.
- Adding another provider duplicates effort and introduces extra cost/compliance.
- If the user later wants a provider Lovable Cloud does not support, we can evaluate it then.

## Files likely to change
- `src/routes/gym.$code.tsx` — add the unified join modal to the lobby and pause/late-join flow.
- `src/routes/pod.$code.$podId.tsx` — add a "Sign in to save stats" CTA during pause and after the game.
- `src/components/AuthSheet.tsx` (or similar) — refactor into a single-step component.
- `src/lib/game.ts` — helper to upsert/link a `players` row from an authenticated profile.
- `src/lib/sfx.ts` — no logic changes; may add a small confirmation sound.
- `src/styles.css` — style the modal as a retro-arcade pop-up (thick borders, hard shadows, tilt).

## Database changes
- No new tables required.
- Existing `players.user_id` and `profiles` tables are sufficient.
- May add a small validation trigger to prevent a single authenticated user from being in two pods in the same room, if needed.

## Success criteria
- A user can join a pod from the lobby with one tap (Google/Apple) or two taps (SMS code + submit) or one nickname field (guest).
- Authenticated users see their avatar/username in the pod and leaderboard.
- Guests can sign in during a game without losing their place.
- The flow is visually consistent with the existing retro arcade theme.

## Out of scope
- Replacing the Lovable Cloud auth backend.
- New third-party identity providers.
- Complex account merging or username/password auth (email is already available but not requested; we keep it as a secondary option in the modal).
