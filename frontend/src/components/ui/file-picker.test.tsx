// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilePicker } from "./file-picker";

describe("file picker", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes the selected file to the single-file callback", () => {
    const onFileChange = vi.fn<(file: File | null) => void>();
    const onChange = vi.fn<React.ChangeEventHandler<HTMLInputElement>>();
    const file = new File(["epub"], "book.epub", {
      type: "application/epub+zip",
    });

    render(
      <FilePicker
        ctaText="EPUBファイルを選択"
        onChange={onChange}
        onFileChange={onFileChange}
      />
    );

    fireEvent.change(screen.getByLabelText("EPUBファイルを選択"), {
      target: { files: [file] },
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onFileChange).toHaveBeenCalledWith(file);
  });

  it("passes every selected or dropped file in multiple mode", () => {
    const onFilesChange = vi.fn<(files: File[]) => void>();
    const first = new File(["first"], "001.png", { type: "image/png" });
    const second = new File(["second"], "002.png", { type: "image/png" });

    render(
      <FilePicker ctaText="画像を選択" multiple onFilesChange={onFilesChange} />
    );

    const input = screen.getByLabelText("画像を選択");
    const dropTarget = input.closest("label");
    expect(dropTarget).not.toBeNull();

    fireEvent.change(input, { target: { files: [first, second] } });
    fireEvent.dragEnter(dropTarget as HTMLLabelElement, {
      dataTransfer: { files: [first, second] },
    });
    expect(dropTarget?.className).toContain("ring-2");

    fireEvent.drop(dropTarget as HTMLLabelElement, {
      dataTransfer: { files: [second] },
    });

    expect(onFilesChange).toHaveBeenNthCalledWith(1, [first, second]);
    expect(onFilesChange).toHaveBeenNthCalledWith(2, [second]);
    expect(dropTarget?.className).not.toContain("ring-2");
  });

  it("does not accept file changes when disabled", () => {
    const onFileChange = vi.fn<(file: File | null) => void>();
    const file = new File(["epub"], "book.epub", {
      type: "application/epub+zip",
    });

    render(
      <FilePicker
        ctaText="EPUBファイルを選択"
        disabled
        onFileChange={onFileChange}
      />
    );

    const input = screen.getByLabelText("EPUBファイルを選択");
    const dropTarget = input.closest("label");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.drop(dropTarget as HTMLLabelElement, {
      dataTransfer: { files: [file] },
    });

    expect(input).toHaveProperty("disabled", true);
    expect(onFileChange).not.toHaveBeenCalled();
  });
});
