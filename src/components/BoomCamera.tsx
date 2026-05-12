import { useEffect, useRef, useState } from "react";
import { Camera, Video, X, RefreshCw, Download, Square } from "lucide-react";
import bombMascot from "@/assets/bomb-mascot.png";

type Mode = "photo" | "video";

/**
 * Fullscreen camera with the BOOM! logo + mascot baked into the corner of every
 * captured photo/video. Output is offered as a download to the device.
 */
export function BoomCamera({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mascotRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);

  const [mode, setMode] = useState<Mode>("photo");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: "image" | "video"; ext: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preload mascot into an Image so we can draw it onto canvas.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = bombMascot;
    img.onload = () => { mascotRef.current = img; };
  }, []);

  // Start camera (re-runs on facing change).
  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        startDrawLoop();
      } catch (e: any) {
        setError(e?.message || "Camera not available. Allow camera permissions and try again.");
      }
    };
    start();
    return () => {
      cancelled = true;
      stopDrawLoop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const drawFrame = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || v.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
      c.width = v.videoWidth;
      c.height = v.videoHeight;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Mirror front camera to feel natural.
    ctx.save();
    if (facing === "user") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    ctx.restore();
    drawOverlay(ctx, c.width, c.height);
    rafRef.current = requestAnimationFrame(drawFrame);
  };

  const drawOverlay = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const pad = Math.round(Math.min(w, h) * 0.025);
    const mascotSize = Math.round(Math.min(w, h) * 0.22);
    const fontSize = Math.round(Math.min(w, h) * 0.11);
    // Mascot bottom-right
    if (mascotRef.current) {
      ctx.drawImage(mascotRef.current, w - mascotSize - pad, h - mascotSize - pad, mascotSize, mascotSize);
    }
    // BOOM! text top-left
    ctx.font = `900 ${fontSize}px 'Luckiest Guy', Impact, sans-serif`;
    ctx.textBaseline = "top";
    ctx.lineWidth = Math.max(4, fontSize * 0.12);
    ctx.strokeStyle = "#1a1a1a";
    ctx.fillStyle = "#ffd84d";
    const text = "BOOM!";
    const x = pad;
    const y = pad;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  };

  const startDrawLoop = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(drawFrame);
  };
  const stopDrawLoop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const stopCamera = () => {
    stopDrawLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
      videoRef.current.srcObject = null;
    }
  };

  const takePhoto = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      // Free the camera before showing the preview (prevents OOM on mobile Safari)
      stopCamera();
      setPreview({ url, type: "image", ext: "jpg" });
    }, "image/jpeg", 0.92);
  };

  const startRecording = () => {
    const c = canvasRef.current;
    if (!c) return;
    const canvasStream = c.captureStream(30);
    const audioTracks = streamRef.current?.getAudioTracks() ?? [];
    audioTracks.forEach((t) => canvasStream.addTrack(t));
    const mimeCandidates = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(canvasStream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const ext = (rec.mimeType || "").includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      stopCamera();
      setPreview({ url, type: "video", ext });
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = `boom-${Date.now()}.${preview.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const closeAll = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="ink-border-sm rounded-full bg-white w-10 h-10 flex items-center justify-center"
          title="Switch camera"
        >
          <RefreshCw size={18} />
        </button>
        <button onClick={closeAll} className="ink-border-sm rounded-full bg-white w-10 h-10 flex items-center justify-center" title="Close">
          <X size={18} />
        </button>
      </div>

      {/* Hidden source video; we render the composited canvas */}
      <video ref={videoRef} playsInline muted className="hidden" />
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="max-h-full max-w-full" />
      </div>

      {error && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-4 ink-border rounded-2xl bg-white p-4 text-center font-black">
          {error}
        </div>
      )}

      {/* Bottom controls */}
      <div className="bg-black/80 p-4 flex flex-col gap-3 items-center">
        <div className="flex gap-2 ink-border-sm rounded-full bg-white p-1">
          <button
            onClick={() => !recording && setMode("photo")}
            className={`px-4 py-1 rounded-full font-black text-sm ${mode === "photo" ? "bg-[var(--boom-yellow)]" : ""}`}
          >
            PHOTO
          </button>
          <button
            onClick={() => !recording && setMode("video")}
            className={`px-4 py-1 rounded-full font-black text-sm ${mode === "video" ? "bg-[var(--boom-yellow)]" : ""}`}
          >
            VIDEO
          </button>
        </div>
        {mode === "photo" ? (
          <button
            onClick={takePhoto}
            className="w-20 h-20 rounded-full ink-border bg-white flex items-center justify-center"
            title="Take photo"
          >
            <Camera size={36} />
          </button>
        ) : (
          <button
            onClick={recording ? stopRecording : startRecording}
            className="w-20 h-20 rounded-full ink-border flex items-center justify-center"
            style={{ background: recording ? "var(--boom-red)" : "white" }}
            title={recording ? "Stop recording" : "Start recording"}
          >
            {recording ? <Square size={32} fill="white" color="white" /> : <Video size={36} />}
          </button>
        )}
      </div>

      {/* Preview modal */}
      {preview && (
        <div className="absolute inset-0 z-20 bg-black/90 flex flex-col p-4 gap-3">
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            {preview.type === "image" ? (
              <img src={preview.url} alt="Capture" className="max-h-full max-w-full ink-border rounded-2xl" />
            ) : (
              <video src={preview.url} controls playsInline className="max-h-full max-w-full ink-border rounded-2xl" />
            )}
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}
              className="ink-border-sm rounded-xl px-4 py-2 bg-white font-black"
            >
              RETAKE
            </button>
            <button
              onClick={download}
              className="btn-boom flex items-center gap-2"
              style={{ fontFamily: "'Luckiest Guy', cursive" }}
            >
              <Download size={18} /> SAVE
            </button>
          </div>
          <p className="text-xs text-white/80 text-center">
            On iPhone, long-press the preview and choose <b>Save to Photos</b>. Then share to Instagram, WhatsApp, anywhere!
          </p>
        </div>
      )}
    </div>
  );
}