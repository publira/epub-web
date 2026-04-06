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
});
