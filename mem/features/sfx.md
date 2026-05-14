---
name: SFX setup
description: Working audio setup for sound effects across browsers including iOS Safari
type: feature
---
Confirmed working SFX architecture (do not regress):

- `src/lib/sfx.ts` exposes `sfx.play(name)` with synthesized Web Audio effects.
- HMR-safe: AudioContext + unlock state stored on `globalThis.__boomSfx` so edits don't drop the user-gesture unlock.
- Master volume = 2.6 to cut through Spotify background music.
- Mute key: `boom.sfx.muted.v4` in localStorage.
- Global gesture listeners (pointerdown/touchstart/mousedown/click/keydown, capture) call `unlockAudio()`.
- `unlockAudio()` primes a silent fallback WAV (`fallbackPlay(false)`) AND starts a near-silent oscillator inside the gesture call stack — required for iOS Safari to actually run WebAudio.
- Fallback: tiny base64 WAV beep via `fallbackAudio()` / `fallbackPlay(audible)` so something is always audible even if AudioContext stays suspended.
- `sfx.play()` checks `navigator.userActivation.isActive`; if in a gesture, fires the fallback beep + unlock + effect synchronously.
- SFX button in `src/routes/gym.$code.tsx` calls `sfx.play("didIt")` immediately on click (before async state updates) so the gesture is captured.
- Button label states: "TAP TO ENABLE SFX" (locked) → "SFX ON" (unlocked + unmuted) → "SFX OFF" (muted). Uses `key={pulse}` to force re-render per click.

If sound stops working again, check (in order): (1) gesture listeners still attached, (2) fallback WAV path intact, (3) `unlockAudio()` still creates the inline oscillator, (4) button still calls `sfx.play()` synchronously on click.