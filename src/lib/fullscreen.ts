/**
 * Small helper so the game can hide the browser chrome and feel like a real app.
 * Fullscreen must be triggered from a user gesture, so callers hook it onto taps.
 */

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: fullscreen), (display-mode: standalone)").matches || nav.standalone === true;
}

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as FsDocument;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement) || isStandalone();
}

export function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.documentElement as FsElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}

/** Ask for fullscreen. Safe to call anywhere — silently no-ops when unsupported. */
export async function enterFullscreen(): Promise<void> {
  try {
    const el = document.documentElement as FsElement;
    if (document.fullscreenElement) return;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    const orientation = window.screen?.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    await orientation?.lock?.("portrait").catch(() => undefined);
  } catch {
    /* user denied or unsupported — keep playing in the normal page */
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    const d = document as FsDocument;
    if (d.fullscreenElement && d.exitFullscreen) await d.exitFullscreen();
    else if (d.webkitFullscreenElement && d.webkitExitFullscreen) await d.webkitExitFullscreen();
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement || (document as FsDocument).webkitFullscreenElement) await exitFullscreen();
  else await enterFullscreen();
}
