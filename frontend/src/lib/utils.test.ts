// @vitest-environment jsdom
import { afterEach, expect, describe, it, vi } from "vitest";

import { parseFilename, triggerDownload } from "./utils";

describe("parseFilename()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns fallback when header is missing", () => {
    expect(parseFilename(null, "fallback.epub")).toBe("fallback.epub");
  }, 1000);

  it("parses RFC5987 filename*", () => {
    const header =
      "attachment; filename*=UTF-8''%E3%83%86%E3%82%B9%E3%83%88.epub";
    expect(parseFilename(header, "fallback.epub")).toBe("テスト.epub");
  }, 1000);

  it("parses plain filename", () => {
    const header = 'attachment; filename="sample.epub"';
    expect(parseFilename(header, "fallback.epub")).toBe("sample.epub");
  }, 1000);

  it("triggers a download and always removes its temporary link", () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:book");
    const revokeObjectURL = vi.fn<(url: string) => void>();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    triggerDownload(new Blob(["book"]), "book.epub");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(document.body.querySelector("a")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:book");
  }, 1000);
});
