// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "#lib/hooks";
import { localeStorageKey } from "#lib/i18n";

import { App } from "./app";
import { LocaleProvider } from "./i18n/locale-provider";

vi.mock(import("./build/build-form"), () => ({
  BuildForm: () => <p>Build form</p>,
  BuildFormSkeleton: () => <p>Build form loading</p>,
}));

vi.mock(import("./extract/extract-form"), () => ({
  ExtractForm: () => <p>Extract form</p>,
  ExtractFormSkeleton: () => <p>Extract form loading</p>,
}));

const config: AppConfig = {
  interfaceLanguages: ["en", "ja"],
  maxAssetBytes: 0,
  maxImageLongEdge: 0,
  maxImagePixels: 0,
  maxPages: 0,
  maxUploadMB: 0,
  requestTimeoutMs: 0,
  supportedLanguages: ["ja", "en"],
};

const renderApp = (initialLocale: "en" | "ja" = "en") =>
  render(
    <LocaleProvider initialLocale={initialLocale}>
      <App />
    </LocaleProvider>
  );

describe("application shell", () => {
  let showModal: ReturnType<typeof vi.fn>;
  let hidePopover: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(() => Promise.resolve(Response.json(config)))
    );
    showModal = vi.fn<(this: HTMLDialogElement) => void>(function showDialog(
      this: HTMLDialogElement
    ) {
      this.setAttribute("open", "");
    });
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
      writable: true,
    });
    // jsdom has no Popover API and treats every popover as hidden, so the
    // tests query the menu links with `hidden: true`.
    hidePopover = vi.fn<() => void>();
    Object.defineProperty(HTMLElement.prototype, "hidePopover", {
      configurable: true,
      value: hidePopover,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("shows build mode by default and updates the URL when switching modes", () => {
    renderApp();

    const buildTab = screen.getByRole("tab", { name: "Images to EPUB" });
    const extractTab = screen.getByRole("tab", { name: "EPUB to images" });
    const buildPanel = document.querySelector("#panel-build");
    const extractPanel = document.querySelector("#panel-extract");

    expect([
      buildTab.getAttribute("aria-selected"),
      extractTab.getAttribute("aria-selected"),
      buildPanel?.hasAttribute("hidden"),
      extractPanel?.hasAttribute("hidden"),
    ]).toStrictEqual(["true", "false", false, true]);

    fireEvent.click(extractTab);

    expect([
      buildTab.getAttribute("aria-selected"),
      extractTab.getAttribute("aria-selected"),
      buildPanel?.hasAttribute("hidden"),
      extractPanel?.hasAttribute("hidden"),
    ]).toStrictEqual(["false", "true", true, false]);
    expect(new URL(window.location.href).searchParams.get("mode")).toBe(
      "extract"
    );
  });

  it("uses the mode in the query string for the initial tab", () => {
    window.history.replaceState(null, "", "/?mode=extract");

    renderApp();

    expect(
      screen
        .getByRole("tab", { name: "EPUB to images" })
        .getAttribute("aria-selected")
    ).toBe("true");
    expect(
      document.querySelector("#panel-build")?.hasAttribute("hidden")
    ).toBeTruthy();
  });

  it("opens the corresponding policy dialog from the footer", () => {
    renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Terms of Use" }));
    const termsDialog = document.querySelector(
      '[aria-labelledby="terms-dialog-title"]'
    );
    expect(termsDialog?.hasAttribute("open")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Privacy Policy" }));
    const privacyDialog = document.querySelector(
      '[aria-labelledby="privacy-dialog-title"]'
    );
    expect(privacyDialog?.hasAttribute("open")).toBeTruthy();
    expect(showModal).toHaveBeenCalledTimes(2);
  });

  it("switches every string to Japanese without a reload", async () => {
    renderApp();

    expect(document.documentElement.lang).toBe("en");

    fireEvent.click(
      await screen.findByRole("button", { name: "Display language" })
    );
    fireEvent.click(screen.getByRole("link", { hidden: true, name: "日本語" }));

    expect(screen.getByRole("tab", { name: "画像からEPUB" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "利用規約" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("ja");
    expect(document.title).toBe("EPUB Web | 画像・EPUB変換");
  });

  it("remembers the language picked in the switcher", async () => {
    renderApp("ja");

    fireEvent.click(await screen.findByRole("button", { name: "表示言語" }));
    fireEvent.click(
      screen.getByRole("link", { hidden: true, name: "English" })
    );

    expect(screen.getByRole("tab", { name: "Images to EPUB" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Display language" }));
    expect(
      screen
        .getByRole("link", { hidden: true, name: "English" })
        .getAttribute("aria-current")
    ).toBe("true");
    expect(window.localStorage.getItem(localeStorageKey)).toBe("en");
    expect(new URL(window.location.href).searchParams.get("lang")).toBe("en");
  });

  it("offers each server language as a link in a popover menu", async () => {
    window.history.replaceState(null, "", "/?mode=extract");
    renderApp();

    const trigger = await screen.findByRole("button", {
      name: "Display language",
    });
    const menu = document.querySelector(
      `#${CSS.escape(trigger.getAttribute("popovertarget") ?? "")}`
    );
    const japanese = screen.getByRole("link", { hidden: true, name: "日本語" });

    expect(menu?.getAttribute("popover")).toBe("auto");
    expect(menu?.contains(japanese)).toBeTruthy();
    expect([
      japanese.getAttribute("href"),
      japanese.getAttribute("hreflang"),
    ]).toStrictEqual(["/?mode=extract&lang=ja", "ja"]);

    fireEvent.click(japanese);

    expect(hidePopover).toHaveBeenCalledOnce();
  });
});
