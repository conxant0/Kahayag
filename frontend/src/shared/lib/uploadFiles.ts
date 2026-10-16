// Defines browser-side preparation of user uploads before they are sent.

/**
 * The most one upload request may carry.
 *
 * The API runs on Vercel functions, which refuse any request body over 4.5 MB
 * before the backend sees it. 4 MB leaves room for the other form fields
 * (the design session, the permit request) in the same request.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "4 MB";

/**
 * The backend scales every image to 1200 px before reading it, so a full
 * resolution phone photo is mostly bytes that are thrown away. 1600 px keeps
 * a margin for small print while bringing a typical photo well under 1 MB.
 */
const MAX_IMAGE_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;

/** Formats a browser cannot draw onto a canvas, or that lose meaning as JPEG. */
const PASS_THROUGH_TYPES = new Set(["image/gif", "image/heic", "image/heif"]);

/**
 * Returns a smaller JPEG copy of a photo, or the file unchanged when it is not
 * a decodable image or shrinking would not help. Never throws: any failure
 * falls back to the original file, and the size check still applies to it.
 */
export async function shrinkImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || PASS_THROUGH_TYPES.has(file.type)) {
    return file;
  }
  if (typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_EDGE_PX / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "upload";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export function uploadTooLargeMessage(fileName: string): string {
  return `${fileName}: File is too large. Maximum size is ${MAX_UPLOAD_LABEL}.`;
}
