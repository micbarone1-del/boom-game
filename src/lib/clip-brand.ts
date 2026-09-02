import bombMascot from "@/assets/bomb-mascot.png";

/**
 * Shared branding used on every shareable clip so a video posted to social
 * media is instantly recognisable: logo, mascot, site address, player name —
 * one per corner.
 */
export type BrandOpts = {
  /** Bottom-right corner: who is on screen. */
  playerName: string;
  /** Optional small caption under the logo (e.g. the exercise). */
  caption?: string;
};

let mascotImg: HTMLImageElement | null = null;
function mascot(): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  if (!mascotImg) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = bombMascot;
    mascotImg = img;
  }
  return mascotImg.complete && mascotImg.naturalWidth > 0 ? mascotImg : null;
}

/** Warm the mascot bitmap up before recording starts. */
export function preloadBrand() {
  mascot();
}

function stickerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign,
  fill: string,
) {
  ctx.save();
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 ${size}px 'Luckiest Guy', Impact, system-ui, sans-serif`;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = Math.max(3, size * 0.22);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draws the four-corner BOOM! branding onto any canvas frame. */
export function drawBrand(ctx: CanvasRenderingContext2D, w: number, h: number, opts: BrandOpts) {
  const unit = Math.min(w, h);
  const pad = Math.round(unit * 0.035);
  const big = Math.round(unit * 0.095);
  const small = Math.round(unit * 0.055);

  // Top-left: game logo.
  stickerText(ctx, "BOOM!", pad, pad + big, big, "left", "#FFD23F");
  if (opts.caption) {
    stickerText(ctx, opts.caption.toUpperCase(), pad, pad + big + small * 1.15, small, "left", "#fff");
  }

  // Top-right: mascot.
  const m = mascot();
  const size = Math.round(unit * 0.18);
  if (m) ctx.drawImage(m, w - size - pad, pad, size, size);

  // Bottom-left: web address.
  stickerText(ctx, "boomworkout.fun", pad, h - pad, small, "left", "#fff");

  // Bottom-right: player name.
  stickerText(ctx, opts.playerName.toUpperCase(), w - pad, h - pad, small, "right", "#7FD4FF");
}

export type BrandedRecorder = {
  /** Stops the recording and resolves with the finished, branded clip. */
  stop: () => Promise<Blob | null>;
};

function pickMime(): string {
  const probe = document.createElement("video");
  const webmPlayable = !!probe.canPlayType("video/webm");
  const types = webmPlayable
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
    : ["video/mp4", "video/mp4;codecs=avc1", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/**
 * Records the live camera <video> through a canvas so every frame carries the
 * four-corner branding. Falls back to null when MediaRecorder is unavailable.
 */
export function startBrandedRecording(
  video: HTMLVideoElement,
  audio: MediaStreamTrack[],
  opts: BrandOpts,
): BrandedRecorder | null {
  try {
    preloadBrand();
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    let raf = 0;
    const draw = () => {
      const vw = video.videoWidth || 720;
      const vh = video.videoHeight || 1280;
      if (canvas.width !== 720) canvas.width = 720;
      const scale = Math.max(canvas.width / vw, canvas.height / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        ctx.drawImage(video, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
      } catch {
        /* frame not ready yet */
      }
      drawBrand(ctx, canvas.width, canvas.height, opts);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const stream = canvas.captureStream(30);
    audio.forEach((t) => stream.addTrack(t));
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    // Timeslice: Safari only flushes data reliably when one is given.
    rec.start(500);

    return {
      stop: () =>
        new Promise<Blob | null>((resolve) => {
          cancelAnimationFrame(raf);
          if (rec.state === "inactive") {
            resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || "video/webm" }) : null);
            return;
          }
          rec.onstop = () => {
            resolve(
              chunks.length
                ? new Blob(chunks, { type: rec.mimeType || chunks[0].type || "video/webm" })
                : null,
            );
          };
          try {
            rec.stop();
          } catch {
            resolve(null);
          }
        }),
    };
  } catch {
    return null;
  }
}
