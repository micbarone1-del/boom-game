import { supabase } from "@/integrations/supabase/client";

const BUCKET = "clips";
/** Signed link lifetime — a year, so shared clips keep working. */
const LINK_TTL = 60 * 60 * 24 * 365;

/** File extension that matches what the recorder actually produced. */
export function extFor(blob: Blob) {
  return blob.type.includes("mp4") ? "mp4" : "webm";
}

/** Filename with the extension forced to match the blob's real type. */
export function clipFileName(blob: Blob, base: string) {
  return `${base.replace(/\.(webm|mp4)$/i, "")}.${extFor(blob)}`;
}

/** True on iPhone/iPad, where only MP4 files can be saved or re-shared. */
function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as Navigator).maxTouchPoints > 1)
  );
}

/** iOS refuses WebM everywhere (Photos, WhatsApp, Files preview). */
function iosUnsupported(blob: Blob) {
  return isIOS() && !(blob.type || "").includes("mp4");
}

/**
 * Save a clip to the device. `<a download>` is ignored on iOS, so there we
 * hand the file to the share sheet (which offers "Save to Files"/Photos) and
 * only fall back to opening the blob in a new tab. When the recording is a
 * format iOS cannot read (WebM), we upload it and hand over a link instead —
 * a link always opens, a WebM file never does.
 */
export async function saveClipBlob(blob: Blob, baseName: string): Promise<void> {
  const name = clipFileName(blob, baseName);
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const file = new File([blob], name, { type: blob.type || "video/webm" });
  const iOS = isIOS();

  if (iosUnsupported(blob)) {
    const url = await uploadClip(blob, baseName.replace(/\.(webm|mp4)$/i, ""));
    if (url) {
      try {
        await navigator.clipboard?.writeText(url);
      } catch {
        /* ignore */
      }
      window.open(url, "_blank", "noopener");
      return;
    }
  }

  if (iOS && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch {
      /* fall through to the link download */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}


/**
 * Upload a recorded clip and return a link that opens the *video itself*
 * (not the game). Returns null when the upload fails so callers can fall
 * back to a local file share.
 */
export async function uploadClip(blob: Blob, baseName = "boom-clip"): Promise<string | null> {
  try {
    // Clips live under the uploader's own folder; guests (not signed in) skip
    // the upload entirely and fall back to a native file share.
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;
    const path = `${uid}/${crypto.randomUUID()}-${baseName}.${extFor(blob)}`;
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

  const file = new File([blob], clipFileName(blob, opts.fileName), {
    type: blob.type || "video/webm",
  });
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
