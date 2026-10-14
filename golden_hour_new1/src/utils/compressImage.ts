/**
 * Image helpers for the Aadhaar scanner.
 * Goal: turn multi-MB phone photos into a ~150-300 KB JPEG (longest edge <= maxEdge)
 * BEFORE upload, so the request is small and the Gemini call is fast.
 * - Honors EXIF rotation (phone photos are often sideways otherwise -> OCR fails).
 * - Decodes straight from the File/Blob (no giant base64 string round trip).
 * - Always resolves; falls back to the original data URL if anything goes wrong.
 */

const DEFAULT_MAX_EDGE = 1400;
const DEFAULT_QUALITY = 0.82;

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decodeBlob(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image could not be decoded'));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Image could not be read'));
    r.readAsDataURL(blob);
  });
}

/** Compress a File/Blob to a small JPEG data URL. Throws only if the image cannot be decoded at all. */
export async function compressBlob(
  blob: Blob,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_QUALITY
): Promise<string> {
  const decoded = await decodeBlob(blob);
  try {
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const w = Math.max(1, Math.round(decoded.width * scale));
    const h = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blobToDataUrl(blob);
    ctx.fillStyle = '#fff'; // PNGs with transparency would otherwise turn black in JPEG
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(decoded.source, 0, 0, w, h);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    // Keep the original only if it is already smaller (tiny images)
    if (!out || (blob.size <= out.size && blob.type === 'image/jpeg')) return blobToDataUrl(blob);
    return blobToDataUrl(out);
  } finally {
    decoded.close();
  }
}

/** Same as before: compress a data URL. Never throws; returns the input on failure. */
export async function compressImage(
  dataUrl: string,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_QUALITY
): Promise<string> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return await compressBlob(blob, maxEdge, quality);
  } catch {
    return dataUrl;
  }
}
