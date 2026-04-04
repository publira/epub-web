import {
  formatInteger,
  formatMiBFromBytes,
  formatSecondsFromMs,
  formatSizeLabel,
} from "./format";

describe("format helpers", () => {
  it("formats integer in ja-JP locale", () => {
    expect(formatInteger(1_234_567)).toBe("1,234,567");
  }, 1000);

  it("formats MiB with one decimal", () => {
    expect(formatMiBFromBytes(1_572_864)).toBe("1.5 MiB");
  }, 1000);

  it("formats size label by unit", () => {
    expect(formatSizeLabel(1536)).toBe("1.5 KiB");
    expect(formatSizeLabel(2 * 1024 * 1024)).toBe("2.00 MiB");
  }, 1000);

  it("formats milliseconds to seconds", () => {
    expect(formatSecondsFromMs(2000)).toBe("2");
    expect(formatSecondsFromMs(2500)).toBe("2.5");
  }, 1000);
});
