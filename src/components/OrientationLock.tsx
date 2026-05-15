import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

/** Shows a full-screen lock when the device is in portrait orientation. */
export function OrientationLock() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      setPortrait(window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  if (!portrait) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-[var(--boom-ink)] text-white flex flex-col items-center justify-center p-8 text-center gap-6">
      <RotateCw size={120} className="anim-fuse" />
      <div
        className="font-black comic-shadow leading-tight"
        style={{
          fontFamily: "'Luckiest Guy', cursive",
          fontSize: "clamp(2rem, 7vw, 4rem)",
          color: "var(--boom-yellow)",
          textShadow: "4px 4px 0 #000",
        }}
      >
        PLEASE ROTATE YOUR DEVICE TO LANDSCAPE TO PLAY.
      </div>
    </div>
  );
}