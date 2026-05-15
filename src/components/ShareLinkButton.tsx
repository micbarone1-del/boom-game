import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";

export function ShareLinkButton({
  url,
  code,
  className = "",
}: {
  url: string;
  code: string;
  className?: string;
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
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={onShare}
        className="ink-border-sm rounded-xl px-3 py-2 bg-[var(--boom-green)] text-white font-black text-sm flex items-center gap-2 active:scale-95 transition-transform"
        title="Share invite link"
      >
        <Share2 size={16} /> SHARE INVITE
      </button>
      <button
        onClick={onCopy}
        className="ink-border-sm rounded-xl px-3 py-2 bg-white font-black text-sm flex items-center gap-2 active:scale-95 transition-transform"
        title="Copy join URL"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "COPIED" : "COPY LINK"}
      </button>
    </div>
  );
}