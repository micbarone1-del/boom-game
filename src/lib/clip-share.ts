import { supabase } from "@/integrations/supabase/client";

const BUCKET = "clips";
/** Signed link lifetime — a year, so shared clips keep working. */
const LINK_TTL = 60 * 60 * 24 * 365;

function extFor(blob: Blob) {
  return blob.type.includes("mp4") ? "mp4" : "webm";
}

/**
 * Upload a recorded clip and return a link that opens the *video itself*
 * (not the game). Returns null when the upload fails so callers can fall
 * back to a local file share.
 */
export async function uploadClip(blob: Blob, baseName = "boom-clip"): Promise<string | null> {
  try {
    const path = `${crypto.randomUUID()}/${baseName}.${extFor(blob)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || "video/webm",
      upsert: false,
    });
    if (error) return null;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, LINK_TTL);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

export type ShareResult = "shared" | "copied" | "failed";

/**
 * Share a clip: always tries to hand over a URL that points at the video.
 * Falls back to a native file share, then to copying the link.
 */
export async function shareClipBlob(
  blob: Blob,
  opts: { title: string; text: string; fileName: string },
): Promise<ShareResult> {
  const url = await uploadClip(blob, opts.fileName.replace(/\.(webm|mp4)$/i, ""));
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };

  if (url && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "failed";
    }
  }

  const file = new File([blob], opts.fileName, { type: blob.type || "video/webm" });
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: opts.title, text: opts.text });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "failed";
    }
  }

  if (url) {
    try {
      await navigator.clipboard?.writeText(`${opts.text} ${url}`);
      return "copied";
    } catch {
      /* ignore */
    }
    window.open(url, "_blank", "noopener");
    return "shared";
  }
  return "failed";
}
