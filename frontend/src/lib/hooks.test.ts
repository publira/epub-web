// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, useEffect, useRef } from "react";
import * as z from "zod";

import {
  toConfigFetchError,
  useDialogScrollLock,
  useDrop,
  useImageDimensions,
  useSearchParamsState,
} from "./hooks";

interface ImageDimensionTarget {
  key: string;
  blob: Blob;
}

interface ImageDimensionsProbeProps {
  targets: readonly ImageDimensionTarget[];
}

const ImageDimensionsProbe = ({ targets }: ImageDimensionsProbeProps) => {
  const dimensions = useImageDimensions(targets);
  return createElement(
    "output",
    { "data-testid": "dimensions" },
    JSON.stringify(dimensions)
  );
};

const modeSchema = z.enum(["build", "extract"]);

interface SearchParamsProbeProps {
  onValue?: (value: string) => void;
}

const SearchParamsProbe = ({ onValue }: SearchParamsProbeProps) => {
  const [value, setValue] = useSearchParamsState("mode", modeSchema, "build");

  useEffect(() => {
    onValue?.(value);
  }, [onValue, value]);

  return createElement(
    "div",
    null,
    createElement("output", { "data-testid": "mode" }, value),
    createElement(
      "button",
      { onClick: () => setValue("extract"), type: "button" },
      "set-extract"
    ),
    createElement(
      "button",
      { onClick: () => setValue("build"), type: "button" },
      "set-build"
    )
  );
};

interface DropProbeProps {
  disabled?: boolean;
  onDropFiles: (files: readonly File[]) => void;
}

const DropProbe = ({ disabled = false, onDropFiles }: DropProbeProps) => {
  const { dragProps, isDragOver } = useDrop(onDropFiles, disabled);

  return createElement(
    "div",
    null,
    createElement(
      "div",
      {
        "data-testid": "dropzone",
        ...dragProps,
      },
      isDragOver ? "over" : "idle"
    )
  );
};

interface DialogScrollLockProbeProps {
  open?: boolean;
}

const DialogScrollLockProbe = ({
  open = false,
}: DialogScrollLockProbeProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogScrollLock(dialogRef);

  return createElement("dialog", { open, ref: dialogRef });
};

interface DialogScrollLockPairProbeProps {
  firstOpen?: boolean;
  secondOpen?: boolean;
}

const DialogScrollLockPairProbe = ({
  firstOpen = false,
  secondOpen = false,
}: DialogScrollLockPairProbeProps) => {
  const firstRef = useRef<HTMLDialogElement>(null);
  const secondRef = useRef<HTMLDialogElement>(null);

  useDialogScrollLock(firstRef);
  useDialogScrollLock(secondRef);

  return createElement(
    "div",
    null,
    createElement("dialog", { open: firstOpen, ref: firstRef }),
    createElement("dialog", { open: secondOpen, ref: secondRef })
  );
};

describe("hooks", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
    document.body.style.overflow = "";
  });

  it("toConfigFetchError() returns same error when message exists", () => {
    const error = new Error("boom");
    expect(toConfigFetchError(error)).toBe(error);
  }, 1000);

  it("toConfigFetchError() returns fallback for non-error or empty message", () => {
    const emptyMessageError = new Error("placeholder");
    emptyMessageError.message = "";

    expect(toConfigFetchError("x").message).toBe(
      "設定の取得に失敗しました。ネットワーク状態を確認して再試行してください。"
    );
    expect(toConfigFetchError(emptyMessageError).message).toBe(
      "設定の取得に失敗しました。ネットワーク状態を確認して再試行してください。"
    );
  }, 1000);

  it("useImageDimensions() resolves image dimensions and closes bitmaps", async () => {
    const blobA = new Blob(["a"]);
    const blobB = new Blob(["b"]);
    const closeA = vi.fn<() => void>();
    const closeB = vi.fn<() => void>();

    const createImageBitmapMock = vi
      .fn<
        (
          blob: Blob
        ) => Promise<{ close: () => void; height: number; width: number }>
      >()
      .mockImplementation((blob) => {
        if (blob === blobA) {
          return Promise.resolve({ close: closeA, height: 20, width: 10 });
        }

        return Promise.resolve({ close: closeB, height: 40, width: 30 });
      });

    vi.stubGlobal("createImageBitmap", createImageBitmapMock);

    render(
      createElement(ImageDimensionsProbe, {
        targets: [
          { blob: blobA, key: "a" },
          { blob: blobB, key: "b" },
        ],
      })
    );

    await waitFor(() => {
      const text = screen.getByTestId("dimensions").textContent;
      expect(text).toBe('{"a":"10x20","b":"30x40"}');
    });

    expect(closeA).toHaveBeenCalledOnce();
    expect(closeB).toHaveBeenCalledOnce();
  }, 1000);

  it("useImageDimensions() sets '-' when createImageBitmap throws", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi
        .fn<
          (
            blob: Blob
          ) => Promise<{ close: () => void; height: number; width: number }>
        >()
        .mockRejectedValue(new Error("decode failed"))
    );

    render(
      createElement(ImageDimensionsProbe, {
        targets: [{ blob: new Blob(["bad"]), key: "bad" }],
      })
    );

    await waitFor(() => {
      const text = screen.getByTestId("dimensions").textContent;
      expect(text).toBe('{"bad":"-"}');
    });
  }, 1000);

  it("useSearchParamsState() reads initial value from query", () => {
    window.history.replaceState(null, "", "/?mode=extract");

    render(createElement(SearchParamsProbe));

    expect(screen.getByTestId("mode").textContent).toBe("extract");
  }, 1000);

  it("useSearchParamsState() falls back to default when query is invalid", () => {
    window.history.replaceState(null, "", "/?mode=invalid");

    render(createElement(SearchParamsProbe));

    expect(screen.getByTestId("mode").textContent).toBe("build");
  }, 1000);

  it("useSearchParamsState() updates and removes search param", () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(createElement(SearchParamsProbe));

    fireEvent.click(screen.getByText("set-extract"));
    expect(screen.getByTestId("mode").textContent).toBe("extract");
    expect(new URL(window.location.href).searchParams.get("mode")).toBe(
      "extract"
    );

    fireEvent.click(screen.getByText("set-build"));
    expect(screen.getByTestId("mode").textContent).toBe("build");
    expect(new URL(window.location.href).searchParams.get("mode")).toBeNull();
    expect(replaceStateSpy).toHaveBeenCalledTimes(2);
    expect(replaceStateSpy).toHaveBeenNthCalledWith(
      1,
      null,
      "",
      "http://localhost:3000/?mode=extract"
    );
    expect(replaceStateSpy).toHaveBeenNthCalledWith(
      2,
      null,
      "",
      "http://localhost:3000/"
    );
  }, 1000);

  it("useDrop() toggles drag state and passes dropped files", () => {
    const onDropFiles = vi.fn<(files: readonly File[]) => void>();
    const file = new File(["a"], "a.png", { type: "image/png" });

    render(createElement(DropProbe, { onDropFiles }));

    const dropzone = screen.getByTestId("dropzone");
    expect(dropzone.textContent).toBe("idle");

    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [file] } });
    expect(dropzone.textContent).toBe("over");

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    expect(dropzone.textContent).toBe("idle");
    expect(onDropFiles).toHaveBeenCalledOnce();
    const dropped = onDropFiles.mock.calls[0]?.[0];
    expect(dropped).toStrictEqual([file]);
  }, 1000);

  it("useDrop() ignores drag/drop when disabled", () => {
    const onDropFiles = vi.fn<(files: readonly File[]) => void>();
    const file = new File(["a"], "a.png", { type: "image/png" });

    render(createElement(DropProbe, { disabled: true, onDropFiles }));

    const dropzone = screen.getByTestId("dropzone");
    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [file] } });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(dropzone.textContent).toBe("idle");
    expect(onDropFiles).not.toHaveBeenCalled();
  }, 1000);

  it("useDialogScrollLock() locks body scroll while dialog is open", async () => {
    const { rerender, unmount } = render(
      createElement(DialogScrollLockProbe, { open: false })
    );

    expect(document.body.style.overflow).toBe("");

    rerender(createElement(DialogScrollLockProbe, { open: true }));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    rerender(createElement(DialogScrollLockProbe, { open: false }));

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("");
    });

    unmount();
    expect(document.body.style.overflow).toBe("");
  }, 1000);

  it("useDialogScrollLock() keeps body locked until all dialogs are closed", async () => {
    const { rerender, unmount } = render(
      createElement(DialogScrollLockPairProbe, {
        firstOpen: true,
        secondOpen: true,
      })
    );

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    rerender(
      createElement(DialogScrollLockPairProbe, {
        firstOpen: false,
        secondOpen: true,
      })
    );

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("hidden");
    });

    rerender(
      createElement(DialogScrollLockPairProbe, {
        firstOpen: false,
        secondOpen: false,
      })
    );

    await waitFor(() => {
      expect(document.body.style.overflow).toBe("");
    });

    unmount();
    expect(document.body.style.overflow).toBe("");
  }, 1000);
});
