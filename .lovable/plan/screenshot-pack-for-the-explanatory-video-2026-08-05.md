# Screenshot pack for the explanatory video

Goal: a set of clean, high-resolution screenshots covering the full BOOM! workflow, from home screen to boss fight and leaderboard, saved as downloadable files.

## What gets captured

Gym / big screen (desktop 1280x800):
1. Home screen with the instruction carousel (all 4 tutorial cards)
2. Gym lobby: QR code, room code, pods with players
3. Customise screen (training + music)
4. Live gym map with fuse bar, tokens and scoreboard
5. Pause / lobby overlay

Player phone (mobile 390x844):
6. Join screen + one-step login modal (Google / phone / guest)
7. Pod waiting screen
8. Roll screen with the pause button
9. Hopping animation (full board view, then zoomed token)
10. Cell mascot / exercise card
11. Judge switch screen and judging view
12. VS duel screen
13. Power-up and defuse flash moments

Boss + endgame:
14. Boss intro with health bar
15. Wheel of fortune spinning and stopped on a segment
16. Boss hit with explosion and shake
17. Boss death "YOU WIN!" fullscreen
18. Wrap-up leaderboard with recap video sharing

## How it's done

A Playwright script drives the running app in the sandbox: it creates a room, seeds a pod with a few players directly in the database, walks the game through each state, and captures each screen. The boss fight uses the existing `/boss-test` shortcut route. Timing-based screens (hop animation, explosions, defuse flash) are captured mid-animation with fixed waits.

Output: PNGs written to `/mnt/documents/screenshots/`, named in workflow order (`01-home.png`, `02-lobby.png`, ...), plus a short caption list so you can match each shot to a video beat. Nothing in the app is changed — capture only, using a throwaway room.

## Notes

- Some states need two players acting at once; the script opens parallel browser contexts to reach them.
- If a state can't be reached reliably by scripting, it's reported instead of faked, and I'll suggest the closest capturable alternative.
