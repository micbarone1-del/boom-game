
This is a large set of independent changes. Below is the implementation plan grouped by area, with the technical notes at the end.

## 1. Turn timer + explosion (60s cap)

- When a trap starts (`trap.started_at`), the player has 60 seconds to be defused (by judge or solo).
- If 60s elapses and the trap is still active:
  - Play a new "explosion" animation on the gym screen and on the active player's phone.
  - Reset that player's `current_space` to `1`.
  - Clear the trap and advance to the next turn.
- Visual: red flash + shake + bomb particle burst, ~1.6s. Reuses existing `BoomCamera` shake.
- Implementation lives in `src/routes/gym.$code.tsx` (authoritative timeout) and `src/routes/play.$code.tsx` (mirror animation).

## 2. Player cap of 3 + Teams

- Hard cap concurrent "slots" at 3. Slots = teams (or solo players when <4 joined).
- Players 1-3: each is their own team (auto-assigned color).
- Player 4+: joins an existing team chosen by closest `fitness_level`.
- Team colors: Green, Red, Blue, Yellow, Purple (cap 5 distinct, but max 3 used).
- Team names = color names ("Team Green", etc.).
- Reps for a team turn = computed using the *acting player's* fitness level (so reps adapt per member); on team turns, each team member takes turns being the "acting member" round-robin.
- Rotating Judge: extends to teams — the previous team's *all* members can press DEFUSED.
- Mid-game join: announcement overlay ("Player X joined Team Y") on gym + every phone, fired at end of current turn.

### Team formation animation
- On game start, gym screen shows split-screen reveal of each team with team color, bomb mascot tinted to team color, member avatars sliding in.
- Each player's phone flashes "YOU ARE IN TEAM <COLOR>" full-screen in that color for ~3s.

### Schema
New columns on `players`:
- `team_id text` (e.g. "green") — nullable.
- `is_team_lead boolean default false`.

(Teams are not their own table — color id on each player is enough, and `current_space` is shared via the team lead. We mirror moves: when team lead's `current_space` updates, all teammates copy it via a server-side update or a client-side reconciliation in `gym.$code.tsx`.)

Simpler alternative considered: a `teams` table. I'll go with the column approach to minimize migration scope; if it gets messy I'll switch.

## 3. Cell 39 boost fix

- Bug: cell 39 has `["boost", 4]` but reportedly doesn't apply. Likely culprit: the trap pipeline reads the *pre-move* cell type or there's an off-by-one in the override map. I'll trace `gym.$code.tsx` move resolution and unify it so boost/setback always apply post-landing on the resolved space, then add a regression check.

## 4. Seconds-as-unit for exercises

- `board_overrides[space]` extends with `unit: "reps" | "seconds"` (default reps).
- Customization UI in gym lobby gets a Reps/Seconds toggle per cell.
- Player UI shows "30 seconds" instead of "30 reps" and the FuseTimer becomes a countdown timer for seconds-based exercises.
- Workout log stores `target_reps` either way (semantic = target value); we add a flag column `unit text default 'reps'`.

## 5. Predefined training presets + illustrations

- Presets: Default, Endurance, Legs, Calisthenics, CrossFit, Functional, Kettlebells, Extreme.
- Each preset = a mapping from cell tier (easy/medium/hard) to a curated exercise pool, applied as `board_overrides` on apply.
- Selectable from the customization tab via a dropdown + "Apply preset" button.
- Illustrations: one image per exercise (~60 unique exercises across presets). Generate via `imagegen` as transparent PNGs (~512x512). Shown:
  - In customization screen next to each cell.
  - In gym screen during the trap intro.
  - On player phone during countdown and timer.
- Storage: `src/assets/exercises/<slug>.png`, mapped via a `EXERCISE_ART: Record<string, string>` lookup.
- Note: generating ~60 illustrations is expensive in tool calls. I'll generate the first batch (~20 most common exercises) and add a fallback `Dumbbell` icon for the rest, then expand.

## 6. New cell types replacing/expanding board

- Remove all "rest" (pause) cells — convert them into other types.
- Add cell types:
  - `surprise` (?) — picks a random exercise from current pool with a roulette animation.
  - `crazy` (danger) — picks from a curated unusual-exercise list ("Spin & Burpee", "Wheel & Pushup", "Crab-walk Pushup", etc.).
  - `group` — everyone does a lighter exercise together; everyone is judge; turn advances when majority press DONE.
  - `vs` — triggered dynamically when 2+ tokens land on the same non-start cell (no static cell needed).
- Distribution: 5 surprise + 5 crazy + 5 group, replacing the 3 rest cells and reducing some easy/medium counts to keep board at 60.

### VS mode
- When the moving player lands on an occupied cell (excluding cell 1):
  - Both players (or teams) do the same exercise.
  - Sequential timer: player A goes first, then player B.
  - Faster time → +50 score bonus.

## 7. Files touched (overview)

- New migration: add `team_id`, `is_team_lead` to `players`; add `unit` to `workout_logs`; extend `board_overrides` JSON shape (no schema change needed for the JSON itself).
- `src/lib/game.ts` — board redesign, new cell types, team helpers, judge expansion, preset definitions.
- `src/routes/gym.$code.tsx` — timer enforcement, explosion, team formation, mid-join announcement, VS handling, group cells, surprise/crazy animations.
- `src/routes/play.$code.tsx` — team color overlays, explosion mirror, group/VS UI, seconds countdown, exercise illustration in countdown.
- `src/components/` — new: `ExplosionOverlay.tsx`, `TeamRevealAnimation.tsx`, `TeamFlashOverlay.tsx`, `RouletteAnimation.tsx`, `JoinAnnouncement.tsx`, `ExerciseArt.tsx`.
- `src/lib/presets.ts` — preset definitions.
- `src/lib/exercise-art.ts` — slug→image map.
- `src/assets/exercises/*.png` — generated illustrations (batched).

## 8. Risks & open questions

- 60-exercise illustration generation is slow; I'll do a phased rollout (common exercises first, fallback icon for rest).
- Team mechanics across realtime + RLS are tricky; will validate with manual playthrough.
- Group cells changing turn semantics may interact with rotating judge — for group cells, "everyone is judge" means the turn auto-completes when N-1 players confirm.
- VS mode adds a sequential mini-flow; will reuse the existing trap pipeline with a `vs` discriminator.

If you approve, I'll execute in this order: (1) cell 39 fix + seconds unit (quick wins) → (2) timer/explosion → (3) new cell types + remove rest → (4) presets + illustrations → (5) teams system + animations.
