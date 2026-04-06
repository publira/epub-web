import {
  buildFileKey,
  getFileImagePixels,
  validateSelectedBuildFiles,
} from "./build";

const createMockFile = (name: string, size: number, lastModified = 1): File =>
  ({ lastModified, name, size }) as File;

describe("build helpers", () => {
  it("buildFileKey() returns stable key from file metadata", () => {
    const file = createMockFile("page-01.png", 1024, 123_456);
    expect(buildFileKey(file)).toBe("page-01.png:1024:123456");
  }, 1000);

  it("getFileImagePixels() returns width * height and closes bitmap", async () => {
    const close = vi.fn<() => void>();
    const createImageBitmapMock = vi
      .fn<
        (
          file: File
        ) => Promise<{ close: () => void; height: number; width: number }>
      >()
      .mockResolvedValue({
        close,
        height: 40,
        width: 30,
      });
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);

    const pixels = await getFileImagePixels(createMockFile("a.png", 1));
    expect(pixels).toBe(1200);
    expect(close).toHaveBeenCalledOnce();
    expect(createImageBitmapMock).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  }, 1000);

  it("validateSelectedBuildFiles() validates max pages", () => {
    const files = [
      createMockFile("1.png", 1),
      createMockFile("2.png", 1),
      createMockFile("3.png", 1),
    ];

    expect(
      validateSelectedBuildFiles(files, {
        maxAssetBytes: 0,
        maxPages: 2,
        maxUploadMB: 0,
      })
    ).toBe("ページ数は最大 2 ページです。");
  }, 1000);

  it("validateSelectedBuildFiles() validates max upload size", () => {
    const files = [createMockFile("1.png", 2 * 1024 * 1024)];

    expect(
      validateSelectedBuildFiles(files, {
        maxAssetBytes: 0,
        maxPages: 0,
        maxUploadMB: 1,
      })
    ).toBe("1リクエストあたり最大 1 MiB です。");
  }, 1000);

  it("validateSelectedBuildFiles() validates max per-asset size", () => {
    const files = [createMockFile("1.png", 2 * 1024 * 1024)];

    expect(
      validateSelectedBuildFiles(files, {
        maxAssetBytes: 1024 * 1024,
        maxPages: 0,
        maxUploadMB: 0,
      })
    ).toBe("画像1枚あたり最大 1.0 MiB です。");
  }, 1000);

  it("validateSelectedBuildFiles() returns null when valid", () => {
    const files = [createMockFile("1.png", 10)];

    expect(
      validateSelectedBuildFiles(files, {
        maxAssetBytes: 1024,
        maxPages: 10,
        maxUploadMB: 1,
      })
    ).toBeNull();
  }, 1000);
});
