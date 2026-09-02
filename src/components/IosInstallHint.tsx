import { useEffect, useState } from "react";
import { Share, Volume2, X } from "lucide-react";
import { isStandalone } from "@/lib/fullscreen";

const DISMISS_KEY = "boom.a2hs.dismissed.v1";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * iOS Safari has no Fullscreen API, so the only way to lose the browser bars
 * is installing the app to the home screen. Shown once, dismissible.
 */
export function IosInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* storage blocked — still show it */
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="fixed bottom-3 left-3 right-3 z-[120] arcade-card bg-white p-3 flex items-center gap-3">
      <div className="text-2xl">💥</div>
      <div className="flex-1 text-[13px] font-black leading-tight">
        Play fullscreen: tap{" "}
        <Share size={13} className="inline -mt-0.5" /> then{" "}
        <span style={{ color: "var(--boom-red)" }}>Add to Home Screen</span>.
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss install tip"
        className="ink-border-sm rounded-lg p-1.5 bg-white active:scale-95"
      >
        <X size={14} />
      </button>
    </div>
  );
}
