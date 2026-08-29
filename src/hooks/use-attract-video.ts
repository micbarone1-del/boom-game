import { useEffect, type RefObject } from "react";

const MP4_SOURCE = "/media/attract.mp4";
const WEBM_SOURCE = "/media/attract.webm";

/** Keeps the muted attract reel moving in mobile and embedded browsers. */
export function useAttractVideo(ref: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const supportsWebm = video.canPlayType('video/webm; codecs="vp9"') !== "";
    const isAppleWebKit = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const primary = supportsWebm && !isAppleWebKit ? WEBM_SOURCE : MP4_SOURCE;
    const fallback = primary === MP4_SOURCE ? WEBM_SOURCE : MP4_SOURCE;
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
      if (stalledChecks < 3 || usingFallback) return;
      usingFallback = true;
      video.src = fallback;
      video.load();
      play();
    };

    const restart = () => {
      video.currentTime = 0;
      play();
    };

    play();
    video.addEventListener("canplay", play);
    video.addEventListener("loadeddata", play);
    video.addEventListener("ended", restart);
    window.addEventListener("pointerdown", play);
    document.addEventListener("visibilitychange", play);
    const watchdog = window.setInterval(recover, 1500);

    return () => {
      window.clearInterval(watchdog);
      video.removeEventListener("canplay", play);
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("ended", restart);
      window.removeEventListener("pointerdown", play);
      document.removeEventListener("visibilitychange", play);
    };
  }, [ref]);
}