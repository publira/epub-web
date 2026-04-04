import { parseFilename } from "./utils";

describe("parseFilename()", () => {
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
});
