import { expect, describe, it } from "vitest";

import {
  formatLanguageName,
  formatLastModified,
  formatMiBFromBytes,
  formatSecondsFromMs,
  formatSizeLabel,
} from "./format";
import { getAppIntl } from "./i18n";

const en = getAppIntl("en");
const ja = getAppIntl("ja");

describe("format helpers", () => {
  it("formats MiB with one decimal", () => {
    expect(formatMiBFromBytes(en, 1_572_864)).toBe("1.5 MiB");
  }, 1000);

  it("formats size label by unit", () => {
    expect(formatSizeLabel(en, 1536)).toBe("1.5 KiB");
    expect(formatSizeLabel(en, 2 * 1024 * 1024)).toBe("2.00 MiB");
  }, 1000);

  it("formats milliseconds to seconds", () => {
    expect(formatSecondsFromMs(en, 2000)).toBe("2");
    expect(formatSecondsFromMs(en, 2500)).toBe("2.5");
  }, 1000);

  it("formats language codes as display names in the current locale", () => {
    expect(formatLanguageName(en, "ja")).toBe("Japanese");
    expect(formatLanguageName(en, "en")).toBe("English");
    expect(formatLanguageName(ja, "ja")).toBe("日本語");
    expect(formatLanguageName(ja, "en")).toBe("英語");
  }, 1000);

  it("returns code as-is for unknown language", () => {
    expect(formatLanguageName(en, "zzz")).toBe("zzz");
  }, 1000);

  it("formats dates in the current locale", () => {
    const timestamp = Date.UTC(2026, 8, 22, 3, 4);

    expect(formatLastModified(en, timestamp)).toBe(
      new Intl.DateTimeFormat("en", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(timestamp)
    );
    expect(formatLastModified(ja, timestamp)).not.toBe(
      formatLastModified(en, timestamp)
    );
  }, 1000);
});
