import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { fullscreenSupported, isFullscreen, isStandalone, toggleFullscreen } from "@/lib/fullscreen";

/**
 * Chunky arcade toggle that hides/reveals the browser chrome so BOOM
 * looks like a real app instead of a website.
 */
export function FullscreenButton({ className = "" }: { className?: string }) {
  const [on, setOn] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(fullscreenSupported() && !isStandalone());
    const sync = () => setOn(isFullscreen());
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      aria-label={on ? "Exit full screen" : "Play full screen"}
      onClick={(e) => {
        e.stopPropagation();
        void toggleFullscreen();
      }}
      className={`ink-border-sm rounded-xl bg-white px-3 py-1.5 text-xs font-black flex items-center gap-1 active:scale-95 transition-transform ${className}`}
    >
      {on ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
      {on ? "EXIT FULL SCREEN" : "FULL SCREEN"}
    </button>
  );
}
