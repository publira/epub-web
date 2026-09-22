// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  catalogs,
  getDocumentLocale,
  getSwitchableLocales,
  localeStorageKey,
  matchLocale,
  replaceLocaleQueryParam,
  resolveEpubLanguage,
  resolveInitialLocale,
} from "./i18n";

describe("locale helpers", () => {
  afterEach(() => {
    document.documentElement.lang = "";
    window.history.replaceState(null, "", "/");
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("matches BCP 47 tags to locales with a catalog", () => {
    expect(matchLocale("ja-JP")).toBe("ja");
    expect(matchLocale("EN_gb")).toBe("en");
    expect(matchLocale("fr")).toBeNull();
    expect(matchLocale("constructor")).toBeNull();
    expect(matchLocale(null)).toBeNull();
  }, 1000);

  it("starts from the language the server rendered into <html lang>", () => {
    document.documentElement.lang = "ja";
    expect(getDocumentLocale()).toBe("ja");

    document.documentElement.lang = "fr";
    expect(getDocumentLocale()).toBe("en");
  }, 1000);

  it("offers only the server languages that have a catalog", () => {
    expect(getSwitchableLocales(["en", "ja", "fr", "ja-JP"])).toStrictEqual([
      "en",
      "ja",
    ]);
  }, 1000);

  it("starts from the server's language when nothing is stored", () => {
    document.documentElement.lang = "ja";

    expect(resolveInitialLocale()).toBe("ja");
  }, 1000);

  it("replaces the server's language with the stored choice", () => {
    document.documentElement.lang = "ja";
    window.localStorage.setItem(localeStorageKey, "en");

    expect(resolveInitialLocale()).toBe("en");
  }, 1000);

  it("applies and stores ?lang= over an earlier stored choice", () => {
    window.localStorage.setItem(localeStorageKey, "ja");
    window.history.replaceState(null, "", "/?mode=extract&lang=en");

    expect(resolveInitialLocale()).toBe("en");
    expect(window.localStorage.getItem(localeStorageKey)).toBe("en");
    expect(window.location.search).toBe("?mode=extract&lang=en");
  }, 1000);

  it("falls back to the server's language when storage is unavailable", () => {
    document.documentElement.lang = "ja";
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(resolveInitialLocale()).toBe("ja");
  }, 1000);

  it("sets ?lang= while keeping the other parameters", () => {
    window.history.replaceState(null, "", "/?mode=extract");

    replaceLocaleQueryParam("en");

    expect(window.location.search).toBe("?mode=extract&lang=en");
  }, 1000);
});

describe("locale catalogs", () => {
  it("loads every file in locales/ with the same message IDs as English", () => {
    const englishIds = Object.keys(catalogs.en ?? {}).toSorted();

    expect(Object.keys(catalogs)).toStrictEqual(
      expect.arrayContaining(["en", "ja"])
    );
    for (const messages of Object.values(catalogs)) {
      expect(Object.keys(messages).toSorted()).toStrictEqual(englishIds);
    }
  }, 1000);
});

describe("EPUB language default", () => {
  it("uses the interface language when the server supports it", () => {
    expect(resolveEpubLanguage("en", ["ja", "en"])).toBe("en");
    expect(resolveEpubLanguage("ja", ["en-US", "ja-JP"])).toBe("ja-JP");
  }, 1000);

  it("uses the first supported language otherwise", () => {
    expect(resolveEpubLanguage("en", ["ja", "fr"])).toBe("ja");
  }, 1000);
});
