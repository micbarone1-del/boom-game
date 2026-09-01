import { useEffect, useRef, useState } from "react";
import { Download, Share2, Film, Loader2, Check } from "lucide-react";
import { shareClipBlob } from "@/lib/clip-share";


export type RecapPlayer = {
  username: string;
  avatar_url: string | null;
  score: number;
  rank: number;
};

/**
 * Renders a 6-second animated recap on a canvas, captures it with
 * MediaRecorder, and exposes Share/Download buttons. WebM output — most
 * mobile share sheets accept it; falls back to download.
 */
/** Bright sticker-card backgrounds, cycled per recap card. */
const TONES = ["#FF8A3D", "#7FD4FF", "#FFD84D", "#5FE08A"];

export type RecapClip = { blob: Blob; label?: string };

export function RecapVideo({
  player,
  total,
  tone,
  clips = [],
}: {
  player: RecapPlayer;
  total: number;
  /** index used to pick a bright card colour */
  tone?: number;
  /** Exercise clips recorded during the game — montaged into the recap. */
  clips?: RecapClip[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  // Preload avatar image once.
  const avatarImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!player.avatar_url || player.avatar_url.startsWith("mascot:")) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = player.avatar_url;
    img.onload = () => {
      avatarImgRef.current = img;
    };
  }, [player.avatar_url]);

  const build = async () => {
    if (building) return;
    setBuilding(true);
    setProgress(0);
    const urls: string[] = [];
    try {
      const W = 540;
      const H = 960;
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvasRef.current = canvas;
      const ctx = canvas.getContext("2d")!;
      const fps = 30;
      const stream = (canvas as HTMLCanvasElement).captureStream(fps);
      // Prefer a format the *device* can actually play back and share.
      // iOS/Safari cannot open WebM, so MP4 is tried first there.
      const probe = document.createElement("video");
      const webmPlayable = !!probe.canPlayType("video/webm");
      const types = webmPlayable
        ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
        : ["video/mp4", "video/mp4;codecs=avc1", "video/webm;codecs=vp8", "video/webm"];
      const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => e.data && e.data.size > 0 && chunks.push(e.data);
      const stopped = new Promise<void>((res) => {
        rec.onstop = () => res();
      });
      rec.start();

      const isMascot = player.avatar_url?.startsWith("mascot:");
      const mascotColor = isMascot ? player.avatar_url!.slice(7) : "#ec4899";

      // Take at most 6 clips so the recap stays short and shareable.
      const montage = clips.slice(0, 6);
      const introMs = 2200;
      const clipMs = 2600;
      const outroMs = 2600;
      const totalMs = introMs + montage.length * clipMs + outroMs;
      let elapsedBefore = 0;

      const animate = (durationMs: number, map: (p: number) => number) =>
        new Promise<void>((resolve) => {
          const start = performance.now();
          const tick = () => {
            const p = Math.min(1, (performance.now() - start) / durationMs);
            setProgress(Math.min(1, (elapsedBefore + p * durationMs) / totalMs));
            drawFrame(ctx, W, H, map(p), player, total, mascotColor, avatarImgRef.current);
            if (p >= 1) {
              elapsedBefore += durationMs;
              resolve();
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });

      // 1) Intro title card.
      await animate(introMs, (p) => p * 0.45);

      // 2) Exercise montage — real clips recorded by the judges.
      for (let i = 0; i < montage.length; i++) {
        const url = URL.createObjectURL(montage[i].blob);
        urls.push(url);
        const vid = document.createElement("video");
        vid.src = url;
        vid.muted = true;
        vid.playsInline = true;
        try {
          await new Promise<void>((res, rej) => {
            vid.onloadeddata = () => res();
            vid.onerror = () => rej(new Error("clip load failed"));
            setTimeout(() => res(), 2500);
          });
          await vid.play().catch(() => {});
        } catch {
          continue;
        }
        await new Promise<void>((resolve) => {
          const start = performance.now();
          const tick = () => {
            const p = Math.min(1, (performance.now() - start) / clipMs);
            setProgress(Math.min(1, (elapsedBefore + p * clipMs) / totalMs));
            drawClipFrame(ctx, W, H, vid, montage[i].label ?? `MOVE ${i + 1}`, i + 1, montage.length, p);
            if (p >= 1) {
              elapsedBefore += clipMs;
              resolve();
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        vid.pause();
      }

      // 3) Outro score card.
      await animate(outroMs, (p) => 0.45 + p * 0.55);

      rec.stop();
      await stopped;
      const out = new Blob(chunks, { type: mime || "video/webm" });
      setBlob(out);
    } finally {
      urls.forEach((u) => URL.revokeObjectURL(u));
      setBuilding(false);
    }
  };


  const ext = blob?.type.includes("mp4") ? "mp4" : "webm";
  const fileName = `boom-recap-${player.username.toLowerCase().replace(/\s+/g, "-")}.${ext}`;

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const share = async () => {
    if (!blob) return;
    setStatus("Uploading…");
    const res = await shareClipBlob(blob, {
      title: "BOOM! recap",
      text: `I scored ${player.score} on BOOM! 💥 Watch my recap:`,
      fileName,
    });
    if (res === "shared") setStatus("Shared!");
    else if (res === "copied") setStatus("Video link copied!");
    else {
      download();
      setStatus("Saved to your device");
    }
    setTimeout(() => setStatus(null), 2200);
  };


  const bg = TONES[(tone ?? player.rank - 1) % TONES.length];

  return (
    <div className="arcade-card p-2.5 flex flex-col gap-2" style={{ background: bg }}>
      <div className="flex items-center gap-2">
        <Film size={14} />
        <div className="text-xs font-black flex-1 truncate">{player.username}</div>
        <div className="text-xs font-black opacity-80">#{player.rank}</div>
      </div>
      <div
        className="arcade-heading text-4xl leading-none text-white text-center tabular-nums"
        aria-label={`${player.score} points`}
      >
        {player.score}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl bg-black border-[3px] border-black"
        style={{ aspectRatio: "9 / 16" }}
      />
      {!blob && (
        <button
          onClick={build}
          disabled={building}
          className="arcade-card-sm arcade-card-press py-2 text-xs font-black flex items-center justify-center gap-1"
          style={{ background: building ? "#eee" : "var(--boom-yellow)" }}
        >
          {building ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Building… {Math.round(progress * 100)}%
            </>
          ) : (
            <>
              <Film size={12} /> Generate recap video
            </>
          )}
        </button>
      )}
      {blob && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
          <button
            onClick={share}
            className="flex-1 arcade-card-sm arcade-card-press py-2 text-xs font-black flex items-center justify-center gap-1"
            style={{ background: "var(--boom-yellow)" }}
          >
            <Share2 size={12} /> Share
          </button>
          <button
            onClick={download}
            className="arcade-card-sm arcade-card-press py-2 px-3 text-xs font-black bg-white"
          >
            <Download size={12} />
          </button>
          </div>
          {status && (
            <div className="text-[10px] font-black flex items-center gap-1 text-center justify-center" style={{ color: "var(--boom-green)" }}>
              <Check size={10} /> {status}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Draws one montage frame: a workout clip, cover-fitted, with sticker overlay. */
function drawClipFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  vid: HTMLVideoElement,
  label: string,
  idx: number,
  count: number,
  p: number,
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const vw = vid.videoWidth || 720;
  const vh = vid.videoHeight || 1280;
  const scale = Math.max(W / vw, H / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  try {
    ctx.drawImage(vid, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } catch {
    /* frame not ready */
  }
  // Bottom scrim + exercise label sticker.
  const g = ctx.createLinearGradient(0, H * 0.6, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);

  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "900 52px 'Luckiest Guy', system-ui";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 10;
  ctx.fillStyle = "#fff";
  const y = H - 120 + (1 - Math.min(1, p / 0.15)) * 40;
  ctx.strokeText(label.toUpperCase(), W / 2, y);
  ctx.fillText(label.toUpperCase(), W / 2, y);
  ctx.font = "900 30px 'Luckiest Guy', system-ui";
  ctx.lineWidth = 6;
  ctx.strokeText(`MOVE ${idx} / ${count}`, W / 2, y + 46);
  ctx.fillStyle = "#ffd84d";
  ctx.fillText(`MOVE ${idx} / ${count}`, W / 2, y + 46);
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  player: RecapPlayer,
  total: number,
  mascotColor: string,
  avatarImg: HTMLImageElement | null,
) {
  // Background gradient w/ subtle rotation.
  const angle = t * Math.PI * 2;
  const g = ctx.createLinearGradient(
    W / 2 + Math.cos(angle) * W,
    H / 2 + Math.sin(angle) * H,
    W / 2 - Math.cos(angle) * W,
    H / 2 - Math.sin(angle) * H,
  );
  g.addColorStop(0, "#ff3b3b");
  g.addColorStop(0.5, "#ffb800");
  g.addColorStop(1, "#7c3aed");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Big BOOM bursts (concentric rings pulsing)
  for (let i = 0; i < 6; i++) {
    const phase = (t * 4 + i / 6) % 1;
    const r = phase * (W * 0.9);
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.35, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${(1 - phase) * 0.35})`;
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  // Header: BOOM!
  ctx.save();
  const headerY = 110 + Math.sin(t * Math.PI * 4) * 6;
  ctx.font = "900 88px 'Luckiest Guy', system-ui";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 10;
  ctx.textAlign = "center";
  ctx.strokeText("BOOM!", W / 2, headerY);
  ctx.fillText("BOOM!", W / 2, headerY);
  ctx.restore();

  // Avatar circle with pop-in.
  const pop = easeOutBack(Math.min(1, t / 0.35));
  const cx = W / 2;
  const cy = H * 0.45;
  const radius = 130 * pop;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = mascotColor;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.font = "900 140px 'Luckiest Guy', system-ui";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((player.username || "?").slice(0, 1).toUpperCase(), cx, cy + 8);
  }
  ctx.restore();

  // Username
  ctx.font = "900 56px 'Luckiest Guy', system-ui";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 8;
  ctx.textAlign = "center";
  ctx.strokeText(player.username, W / 2, cy + radius + 80);
  ctx.fillText(player.username, W / 2, cy + radius + 80);

  // Stats — rank + score counting up
  const score = Math.round(player.score * Math.min(1, t / 0.7));
  ctx.font = "900 150px 'Luckiest Guy', system-ui";
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 12;
  const sy = H * 0.7;
  ctx.strokeText(String(score), W / 2, sy);
  ctx.fillText(String(score), W / 2, sy);

  ctx.font = "900 44px 'Luckiest Guy', system-ui";
  ctx.lineWidth = 6;
  ctx.fillStyle = "#fff";
  const label = `RANK #${player.rank} of ${total}`;
  ctx.strokeText(label, W / 2, sy + 70);
  ctx.fillText(label, W / 2, sy + 70);

  // Footer tag
  ctx.font = "700 28px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 4;
  ctx.strokeText("boomworkout.fun", W / 2, H - 40);
  ctx.fillText("boomworkout.fun", W / 2, H - 40);
}

function easeOutBack(x: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}