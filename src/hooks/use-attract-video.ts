import { useEffect, type RefObject } from "react";

const MP4_SOURCE = "/media/attract.mp4";
const WEBM_SOURCE = "/media/attract.webm";

/** Keeps the muted attract reel moving in mobile and embedded browsers. */
export function useAttractVideo(ref: RefObject<HTMLVideoElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const video = ref.current;
    if (!video) return;

    // Prefer MP4 (H.264 baseline) where the browser can decode it — that is
    // every real mobile/desktop browser. Some builds (e.g. codec-free
    // Chromium) can only do VP9, so fall back to WebM up front.
    const canMp4 = video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== "";
    const primary = canMp4 ? MP4_SOURCE : WEBM_SOURCE;
    const fallback = canMp4 ? WEBM_SOURCE : MP4_SOURCE;
    let usingFallback = false;
    let lastTime = -1;
    let stalledChecks = 0;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.src = primary;
    video.load();

    const play = () => void video.play().catch(() => {});
    const recover = () => {
      if (document.visibilityState === "hidden") return;
      if (video.currentTime > lastTime + 0.05) {
        lastTime = video.currentTime;
        stalledChecks = 0;
        return;
      }
      stalledChecks += 1;
      play();
      if (stalledChecks < 2 || usingFallback) return;
      swapToFallback();
    };

    const swapToFallback = () => {
      if (usingFallback) return;
      usingFallback = true;
      stalledChecks = 0;
      video.src = fallback;
      video.load();
      play();
    };

    const restart = () => {
      video.currentTime = 0;
      play();
    };

    play();
    video.addEventListener("error", swapToFallback);
    video.addEventListener("stalled", swapToFallback);
    video.addEventListener("canplay", play);
    video.addEventListener("loadeddata", play);
    video.addEventListener("ended", restart);
    window.addEventListener("pointerdown", play);
    document.addEventListener("visibilitychange", play);
    const watchdog = window.setInterval(recover, 800);

    return () => {
      window.clearInterval(watchdog);
      video.removeEventListener("error", swapToFallback);
      video.removeEventListener("stalled", swapToFallback);
      video.removeEventListener("canplay", play);
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("ended", restart);
      window.removeEventListener("pointerdown", play);
      document.removeEventListener("visibilitychange", play);
    };
  }, [ref, enabled]);
}