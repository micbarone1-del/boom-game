/**
 * Lightweight device/platform detection used to tailor the "GET READY!" setup
 * card: different phones need different (or no) steps to reach fullscreen.
 */

export type Platform = "ios" | "android" | "desktop";

export function getPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac but has touch points
    (/Macintosh/.test(ua) && typeof document !== "undefined" && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/** True when the app already runs installed (no browser chrome to hide). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    nav.standalone === true
  );
}

/** True when the browser exposes the Fullscreen API (Android/desktop). */
export function supportsFullscreenApi(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
}

/** Single toggle: enter fullscreen (and lock to portrait when allowed). */
export async function enterFullscreen(): Promise<boolean> {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation?.lock?.("portrait").catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  return document.fullscreenElement != null || isStandalone();
}

/** Which setup steps this specific device still needs. */
export function setupNeeds() {
  const platform = getPlatform();
  const installed = isStandalone();
  return {
    platform,
    installed,
    /** Only iOS has a hardware ringer switch that mutes web audio. */
    needsSilentSwitch: platform === "ios",
    /** iOS can't do web fullscreen — it needs Add to Home Screen. */
    needsAddToHomeScreen: platform === "ios" && !installed,
    /** Everywhere else a one-tap fullscreen button works. */
    canOneTapFullscreen: platform !== "ios" && !installed && supportsFullscreenApi(),
  };
}
