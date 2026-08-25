// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./app";

vi.mock(import("./build/build-form"), () => ({
  BuildForm: () => <p>画像からEPUBフォーム</p>,
  BuildFormSkeleton: () => <p>画像からEPUBの読み込み中</p>,
}));

vi.mock(import("./extract/extract-form"), () => ({
  ExtractForm: () => <p>EPUBから画像フォーム</p>,
  ExtractFormSkeleton: () => <p>EPUBから画像の読み込み中</p>,
}));

describe("application shell", () => {
  let showModal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    showModal = vi.fn<(this: HTMLDialogElement) => void>(
      function showDialog(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      }
    );
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: showModal,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows build mode by default and updates the URL when switching modes", () => {
    render(<App />);

    const buildTab = screen.getByRole("tab", { name: "画像からEPUB" });
    const extractTab = screen.getByRole("tab", { name: "EPUBから画像" });
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

    render(<App />);

    expect(
      screen
        .getByRole("tab", { name: "EPUBから画像" })
        .getAttribute("aria-selected")
    ).toBe("true");
    expect(
      document.querySelector("#panel-build")?.hasAttribute("hidden")
    ).toBeTruthy();
  });

  it("opens the corresponding policy dialog from the footer", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "利用規約" }));
    const termsDialog = document.querySelector(
      '[aria-labelledby="terms-dialog-title"]'
    );
    expect(termsDialog?.hasAttribute("open")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "プライバシーポリシー" })
    );
    const privacyDialog = document.querySelector(
      '[aria-labelledby="privacy-dialog-title"]'
    );
    expect(privacyDialog?.hasAttribute("open")).toBeTruthy();
    expect(showModal).toHaveBeenCalledTimes(2);
  });
});
