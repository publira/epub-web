import { vi, afterEach, describe, expect, it } from "vitest";

import { compressImageFile } from "./image";

// @vitest-environment jsdom
describe("compressImageFile()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns original file if not an image", async () => {
    const file = new File(["content"], "document.txt", { type: "text/plain" });

    const result = await compressImageFile(file);

    expect(result).toBe(file);
  }, 1000);

  it("returns original file if dimensions are already small", async () => {
    const close = vi.fn<() => void>();
    const bitmap = {
      close,
      height: 800,
      width: 1000,
    };

    vi.stubGlobal(
      "createImageBitmap",
      vi
        .fn<() => Promise<ImageBitmap>>()
        .mockResolvedValue(bitmap as unknown as ImageBitmap)
    );

    const file = new File(["image"], "small.jpg", { type: "image/jpeg" });
    const result = await compressImageFile(file);

    expect(result).toBe(file);
    expect(close).toHaveBeenCalledWith();
  }, 1000);

  it("returns original file if canvas context is unavailable", async () => {
    const close = vi.fn<() => void>();
    const bitmap = {
      close,
      height: 3000,
      width: 2000,
    };

    vi.stubGlobal(
      "createImageBitmap",
      vi
        .fn<() => Promise<ImageBitmap>>()
        .mockResolvedValue(bitmap as unknown as ImageBitmap)
    );

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement");
    createElementSpy.mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() !== "canvas") {
        return originalCreateElement(tagName);
      }

      return {
        getContext: () => null,
        height: 0,
        width: 0,
      } as unknown as HTMLCanvasElement;
    });

    const file = new File(["image"], "image.jpg", { type: "image/jpeg" });
    const result = await compressImageFile(file);

    expect(result).toBe(file);
    expect(close).toHaveBeenCalledWith();
  }, 1000);

  it("resizes oversized JPEG images and returns a JPEG file", async () => {
    const close = vi.fn<() => void>();
    const drawImage = vi.fn<CanvasRenderingContext2D["drawImage"]>();
    const fillRect = vi.fn<CanvasRenderingContext2D["fillRect"]>();
    const context = { drawImage, fillRect, fillStyle: "" };
    const canvas = {
      getContext: vi.fn<() => CanvasRenderingContext2D | null>(
        () => context as unknown as CanvasRenderingContext2D
      ),
      height: 0,
      toBlob: vi.fn<(callback: BlobCallback, type?: string) => void>(
        // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Canvas toBlob uses a callback.
        (callback, type) => callback(new Blob(["compressed"], { type }))
      ),
      width: 0,
    } as unknown as HTMLCanvasElement;
    const bitmap = { close, height: 2000, width: 4000 };
    vi.stubGlobal(
      "createImageBitmap",
      vi
        .fn<() => Promise<ImageBitmap>>()
        .mockResolvedValue(bitmap as unknown as ImageBitmap)
    );
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) =>
      tagName === "canvas" ? canvas : originalCreateElement(tagName)
    );

    const result = await compressImageFile(
      new File(["image"], "cover.webp", { type: "image/webp" }),
      1000
    );

    expect([canvas.width, canvas.height]).toStrictEqual([1000, 500]);
    expect([result.name, result.type]).toStrictEqual([
      "cover.jpg",
      "image/jpeg",
    ]);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1000, 500);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1000, 500);
    expect(close).toHaveBeenCalledOnce();
  }, 1000);
});
