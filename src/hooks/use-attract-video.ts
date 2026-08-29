import { useEffect, type RefObject } from "react";

// Version the reel URLs so phones do not keep an older, frozen transcode in
// their media cache after a deployment.
const MP4_SOURCE = "/media/attract.mp4?v=20260829c";
const WEBM_SOURCE = "/media/attract.webm?v=20260829c";

/** Keeps the muted attract reel moving in mobile and embedded browsers. */
export function useAttractVideo(ref: RefObject<HTMLVideoElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const video = ref.current;
    if (!video) return;

    // Prefer VP9 when it is explicitly supported; it is the smallest and most
    // reliable transcode in embedded Chromium. Safari/iOS naturally chooses
    // the H.264 fallback.
    const canMp4 = video.canPlayType('video/mp4; codecs="avc1.42E01E"') !== "";
    const canWebm = video.canPlayType('video/webm; codecs="vp9"') !== "";
    const primary = canWebm ? WEBM_SOURCE : MP4_SOURCE;
    const fallback = canWebm && canMp4 ? MP4_SOURCE : WEBM_SOURCE;
    let usingFallback = false;
    let lastTime = -1;
    let stalledChecks = 0;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.src = primary;
    video.load();

    const play = () => {
      video.muted = true;
      void video.play().catch(() => {});
    };
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