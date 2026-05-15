import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";

export function ShareLinkButton({
  url,
  code,
  className = "",
  compact = false,
}: {
  url: string;
  code: string;
  className?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && !!(navigator as any).share;

  const onShare = async () => {
    const shareData = {
      title: "Join my BOOM! workout game",
      text: `Join my BOOM! room ${code} — let's sweat!`,
      url,
    };
    try {
      if (canShare) {
        await (navigator as any).share(shareData);
        return;
      }
    } catch {
      /* fall through to copy */
    }
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? "flex-wrap" : ""} ${className}`}>
      <button
        onClick={onShare}
        className={`ink-border-sm rounded-xl bg-[var(--boom-green)] text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
        title="Share invite link"
      >
        <Share2 size={compact ? 14 : 16} /> {compact ? "SHARE" : "SHARE INVITE"}
      </button>
      <button
        onClick={onCopy}
        className={`ink-border-sm rounded-xl bg-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
        title="Copy join URL"
      >
        {copied ? <Check size={compact ? 14 : 16} /> : <Copy size={compact ? 14 : 16} />}
        {copied ? "COPIED" : compact ? "COPY" : "COPY LINK"}
      </button>
    </div>
  );
}
