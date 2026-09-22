// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "#lib/hooks";
import type { Locale } from "#lib/i18n";

import { LanguageSwitcher } from "../i18n/language-switcher";
import { LocaleProvider } from "../i18n/locale-provider";
import { BuildForm } from "./build-form";

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

const renderBuildForm = (
  initialLocale: Locale,
  supportedLanguages = config.supportedLanguages
) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["config"], { ...config, supportedLanguages });

  render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider initialLocale={initialLocale}>
        <LanguageSwitcher />
        <BuildForm />
      </LocaleProvider>
    </QueryClientProvider>
  );
};

const switchLocale = (locale: Locale) => {
  fireEvent.click(
    screen.getByRole("button", { name: /^(?:Display language|表示言語)$/u })
  );
  fireEvent.click(
    screen.getByRole("link", { hidden: true, name: locale === "ja" ? "日本語" : "English" })
  );
};

const getEpubLanguage = () =>
  (document.querySelector("#build-language") as HTMLSelectElement).value;

describe("build form EPUB language", () => {
  beforeEach(() => {
    // jsdom has no Popover API.
    Object.defineProperty(HTMLElement.prototype, "hidePopover", {
      configurable: true,
      value: vi.fn<() => void>(),
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("defaults to the interface language and follows a later switch", () => {
    renderBuildForm("en");

    expect(getEpubLanguage()).toBe("en");
    expect(
      within(screen.getByRole("combobox", { name: "Language" })).getByRole(
        "option",
        { name: "Japanese" }
      )
    ).toBeTruthy();

    switchLocale("ja");

    expect(getEpubLanguage()).toBe("ja");
    expect(
      within(screen.getByRole("combobox", { name: "言語" })).getByRole(
        "option",
        { name: "日本語" }
      )
    ).toBeTruthy();
  });

  it("defaults to the first supported language when the interface language is not offered", () => {
    renderBuildForm("en", ["ja", "fr"]);

    expect(getEpubLanguage()).toBe("ja");
  });

  it("keeps a language the user picked when the interface language changes", () => {
    renderBuildForm("en");

    fireEvent.change(document.querySelector("#build-language") as Element, {
      target: { value: "ja" },
    });
    switchLocale("ja");
    switchLocale("en");

    expect(getEpubLanguage()).toBe("ja");
  });
});
