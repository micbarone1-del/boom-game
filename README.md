# Boom!

### Lovable Master Prompt: BOOM - The Workout Game (MVP)

**Goal:** Create a full-stack, real-time local multiplayer PWA (Progressive Web App) party-fitness game. The app is a highly social, gamified workout experience with a quirky, cartoonish aesthetic (similar to Exploding Kittens). The core mechanic replaces dice rolling and game board progression with physical exercise penalties.

#### **Architecture & Technology Stack**

 * **Platform:** Mobile-first Web App (PWA).

 * **Stack:** React + Tailwind CSS (UI) + Lovable Cloud/Supabase (Database, Auth, and Realtime).

 * **Crucial Feature:** Use **Supabase Realtime (WebSockets)** to synchronize game state across multiple devices in milliseconds.

#### **App Views & User Scenario**

The app must support two distinct viewing modes. **The very first screen of the app must ask the user which mode they want to launch:**

 1. **The "Gym Screen" (Master View):** A large, read-only display for smart TVs or iPads that shows the full illustrated game board, player positions, and global timers.

 2. **The "Phone Controller" (Personal View):** An interactive remote for individual players to roll the dice, view personal traps, and log reps.

#### **Database Schema (Lovable Cloud/Supabase)**

Define the following tables to manage the real-time sync:

 * **rooms:** room_code (e.g., GYM-A), host_id, game_state (jsonb: current_turn, difficulty_multiplier).

 * **players:** id, room_code, username, fitness_level (1-10 pick-list), avatar_url, current_space, status (ACTIVE, JUDGE, WAITING).

 * **workout_logs:** player_id, exercise_name, target_reps, time_taken, verified_by_judge.

#### **User Journey & Core Game Mechanics**

**1. App Launch & View Selection:**

 * When a user visits the URL, the splash screen displays two massive buttons: **"Set up Gym Screen (Master)"** or **"Join Game (Phone Controller)"**.

 * Choosing "Gym Screen" creates a "Local Room" and displays a large Room Code and QR Code on a chaotic cartoon background.

 * Choosing "Join Game" opens the phone camera to scan the QR code (or allows manual entry of the Room Code).

**2. Player Onboarding:**

 * After joining, players enter a username and select a **"Fitness Level" (1-10)**.

 * **Avatars:** Users upload a selfie. Crop the image into a circle and overlay a cartoonish "burning fuse" graphic on top of it to act as their game token. Realtime syncs these tokens to the Gym Screen instantly.

**3. The Theme & The Board:**

 * The game board (Spaces 1 to 60) is a highly colorful, chaotic, cartoon **Minefield**.

 * **Blast Wave (Boost):** Replaces traditional ladders/shortcuts. If a player lands here, they are "blasted" forward 5 spaces safely.

 * **Detonation Zone (The Trap):** Replaces the standard penalty space.

**4. The "BOOM" Mechanic & Adaptive Exercises:**

 * Player 1 taps "ROLL DICE" on their phone. The result synchronizes, moving their token on the Gym Screen.

 * If they land on a "Detonation Zone," the game locks on all screens.

 * A massive comic-book style **"BOOM!"** graphic flashes on the Gym Screen.

 * **The Penalty Calculation:** The app calculates the rep count: Reps = Player Level (e.g., 2) * Room Difficulty Multiplier (e.g., x10) = 20.

 * The Gym Screen modal displays the required exercise: *"TRAP TRIGGERED! Do 20 Burpees!"*

 * **The Fuse Timer:** Instead of a standard digital clock, display a count-up timer stylized as a burning cartoon fuse on both the Phone Controller and Gym Screen.

**5. Social Integrity (Human Judge Verification):**

 * Player 1 completes the exercise in the real world and taps the giant **"I DID IT!"** button on their Phone Controller.

 * **Verification Mode:** The game does *not* advance. The Gym Screen changes state to: **"TEAM VERIFICATION REQUIRED!"**

 * The Gym Screen unlocks two massive judge buttons for the rest of the room to press:

   * **"DEFUSED" (Green Button):** Form was good, penalty cleared. This unlocks the game and passes the turn to the next player.

   * **"BLOW IT UP" (Red Button):** Form was terrible. A buzzer sounds, the timer keeps running, and the active player must finish their reps properly.

#### **Aesthetic & UI Design**

 * **Vibe:** Highly cartoonish, chaotic, bright, and slightly absurd (Exploding Kittens meets comic-book pop art).

 * **Typography:** Use thick, bold, comic-style fonts for numbers and pop-up events (like the "BOOM!" flash).

 * **Colors:** High-saturation reds, yellows, oranges, and deep contrast outlines. Avoid standard "clinical" fitness app UI—this must look like a hilarious party game.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://boom-game.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/437eab89-7975-4b31-8ebc-8783f9915946).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
