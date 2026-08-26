/**
 * Turn any camera/gallery image into a small square-ish JPEG data URL.
 * Phones produce 3–8 MB photos; we downscale + recompress in the browser so
 * avatars always fit comfortably (target < ~300 KB) instead of rejecting them.
 */
export async function fileToAvatarDataUrl(
  file: File,
  maxSize = 512,
  maxBytes = 300_000,
): Promise<string> {
  const bitmap = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length * 0.75 > maxBytes && quality > 0.35) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> decode */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
