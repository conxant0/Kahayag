// Verifies uploads are only ever made smaller, and never lost on failure.
import { afterEach, describe, expect, it, vi } from "vitest";

import { shrinkImageForUpload } from "../../../src/shared/lib/uploadFiles";

function fileOf(type: string, name: string, bytes = 16): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shrinkImageForUpload", () => {
  it("passes a PDF through untouched", async () => {
    const pdf = fileOf("application/pdf", "quote.pdf");
    expect(await shrinkImageForUpload(pdf)).toBe(pdf);
  });

  it("passes formats a canvas cannot redraw through untouched", async () => {
    const heic = fileOf("image/heic", "photo.heic");
    expect(await shrinkImageForUpload(heic)).toBe(heic);
  });

  it("keeps the original when the browser cannot decode images", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    const photo = fileOf("image/jpeg", "photo.jpg");
    expect(await shrinkImageForUpload(photo)).toBe(photo);
  });

  it("keeps the original when decoding fails", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => Promise.reject(new Error("corrupt image"))),
    );
    const photo = fileOf("image/png", "photo.png");
    expect(await shrinkImageForUpload(photo)).toBe(photo);
  });
});
