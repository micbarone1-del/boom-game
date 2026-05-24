# Big update — phased plan

This is a large batch. I want to confirm scope and ordering before touching code. I'd split it into 5 phases so each lands stable.

## Phase 1 — Fixes & polish (small, ship first)
- **Player UI**
  - RESTART button → navigate to `/` (Home), not pod reset.
  - Replace separate fuse + progress bars with ONE stacked bar: bottom layer = fuse burn (red→black), top layer = pod progress along board, both on the same track with a divider tick.
  - After dice roll: extract the existing gym hop/zoom animation into a reusable `<HopSequence />` and play it on the phone (same timing). Then current SwitchPhase opens.
  - Robot voice: replace `reps` token in TTS with explicit `"reps"` (currently being expanded to "representatives"). Fix in `sfx.ts` speak helper.
  - **Stuck turn bug**: investigate `pod.$code.$podId.tsx` dice→hop→switch state machine — likely a missed `current_turn_player_id` advance when hop animation interrupts. Add a safety timeout that re-enters the phase if no state change in 8s.
- **Exercises**: any exercise whose name contains "hold" → `unit = "seconds"` everywhere (presets + board generator + judge timer mode). Judge UI for hold-exercises shows a countdown hold timer instead of rep counter.
- **Judge UI camera**: request `getUserMedia` once per session, cache MediaStream in a context (`CameraProvider`), reuse across rep counting / VS / boss.
- **Judge SFX**:
  - per-rep → Mario-mushroom 1-up style chime + floating "+N pts" superimposed on camera feed.
  - defuse → longer winning jingle, +6 dB.
- **Explosion**: when fuse expires for a player at the end of an exercise, play the gym-screen full-screen mascot explosion overlay on the pod, then send token back to space 1 (already partial — wire to the same `ExplosionOverlay` used on gym).
- **Colors**: pass over SwitchPhase / mascot labels / fuse readouts to enforce contrast (white text + dark text-shadow on colored bg).
- **Music**: layer a 4-on-the-floor techno kick on top of arcade BGM in `sfx.ts` (`addTechnoLayer()` with its own gain, synced to BGM rate).

## Phase 2 — Gym screen rebuild
- Pull the published `boomworkout.fun` gym build (need to fetch + screenshot it) and reproduce the layout: big animated map, token hops, cell-reveal mascot, scoreboard, etc.
- Overlay the new pod system on top: per-pod color, per-pod scoreboard column, per-pod active-player highlight.
- I'll flag **clashes** between the old single-game gym build and the new multi-pod model in a short list before coding (e.g. old build assumes one active turn → new build needs 1 per pod; old build's camera-follow assumes one token → needs to either follow round-robin or stay zoomed out).
- Replace current static `GymMap.tsx` with the rebuilt version; `PodActivityTicker` stays.

## Phase 3 — VS battles
- Detect collision in pod reducer: if after a hop a player lands on a cell already occupied by another player from the same pod, enter `vs` phase instead of normal switch.
- New `VsPhase` component: two tokens slide in from sides, big "VS" badge, then the SwitchPhase exercise card. Roles: incoming player = athlete, resident = judge. On completion, swap roles and replay. Winner = more reps / faster time → 2× points; loser → 0 points.
- Gym screen mirrors with a "VS" badge over the cell.

## Phase 4 — Boss fight
- Schema: add `rooms.phase` enum (`board | boss | victory`) and `pods.boss_hp int default 100`, `pods.boss_started_at`.
- When a pod's last player crosses FINISH → flip `pods.phase` (or pod-level state) to `boss`, reset fuse to 5 min, spawn boss UI on pod + gym.
- Boss UI: large arcade boss sprite (need to generate one), idle sway + lunge animation. Fuse bar becomes boss HP bar (depletes as pod defuses).
- Damage = exercise reps × power-up multiplier. Tune damage so a balanced pod wins in ~4 min.
- Judge UI on defuse: boss hit flash + floating damage number.
- Boss defeat → victory screen + ranking.

## Phase 5 — Auth, ranking, continue, progression
- **Auth**: enable Google + Apple via Lovable managed OAuth + email/password fallback. Profiles table already exists; extend with `power_up_level int default 0`, `lifetime_points int`.
- **Ranking screen**: existing layout + per-row "Save to profile" button (sign in if anonymous) that writes `lifetime_score += game_score`, increments `games_finished`, recomputes `power_up_level` from thresholds (e.g. 0/500/1500/3500/7500 pts).
- **Continue screen**: already exists — make Continue free and resume from saved `current_space` (no penalty). Confirm wiring.
- **Progression effects** applied during play:
  - Boss damage multiplier = `1 + 0.25 * power_up_level`.
  - On explosion: instead of space 1, send back to `max(1, current_space - (8 - power_up_level))`.
  - Persist per-user `power_up_level` via `profiles` row keyed on `user_id` (when signed in) or `localStorage` fallback for guests.

## Phase 6 — Verify
- Manual click-through: solo pod → board → VS → boss → victory → ranking → save to profile.
- Screenshot QA gym screen at desktop + 1080p TV.

## Clashes / open questions
1. The published gym build was the **pre-pod** single-game layout. Reproducing it 1:1 means the multi-pod scoreboard has to be retrofitted — confirm you want me to extend (multi-pod) rather than literally clone (single).
2. VS battle with pass-and-play (one phone per pod): the "swap roles" step needs a clear "PASS PHONE" beat — I'll add a 3-2-1 swap card.
3. Boss fight per-pod vs shared: I'm assuming **per-pod** (each pod fights their own boss on their own 5-min clock). Confirm — alternative is one shared boss whose HP all pods chip at.
4. "Allow camera only once" — I'll request on first Judge UI mount and cache. If the user denies, we re-prompt next exercise (browser policy).
5. Apple Sign-In requires the project be on a custom domain Apple-verified — already on `boomworkout.fun`, so OK.

## Proposed execution order
Ship Phase 1 first (1 commit, low risk), then 2, then 3+4 together (they share the per-pod state machine), then 5.

Reply with:
- Y to proceed top-to-bottom,
- or pick a different starting phase,
- or answer the 4 clash questions and I'll start.