/**
 * One-time reset of the "sound off" / "tutorial off" flags.
 *
 * Some phones (especially iPhones, where an installed home-screen app gets its
 * own storage jar) kept a stale muted / tips-off flag from an earlier session,
 * so the game opened silent and without the tutorial. This runs at import time
 * — before sfx.ts and the tutorial read their settings — so the defaults are
 * already correct on the very first render.
 */
const FLAG = "boom.defaults.init.v3";

if (typeof window !== "undefined") {
  try {
    if (window.localStorage.getItem(FLAG) !== "1") {
      window.localStorage.setItem("boom.sfx.muted.v5", "0");
      window.localStorage.setItem("boom.ftue.disabled.v5", "0");
      window.localStorage.setItem("boom.robotVoice.enabled.v2", "1");
      window.localStorage.setItem(FLAG, "1");
    }
  } catch {
    /* storage blocked (iOS private browsing) — defaults stay ON anyway */
  }
}

export const bootDefaultsReady = true;
