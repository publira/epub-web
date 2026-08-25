// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBuildImagePreviews } from "./use-build-image-previews";

const PreviewsProbe = ({ files }: { files: File[] }) => {
  const previews = useBuildImagePreviews(files);
  return (
    <output data-testid="previews">
      {JSON.stringify(previews.map(({ id, name, url }) => ({ id, name, url })))}
    </output>
  );
};

describe("build image preview lifecycle", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reuses URLs for retained files and revokes URLs for removed files", async () => {
    const createObjectURL = vi
      .fn<(file: Blob) => string>()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    const revokeObjectURL = vi.fn<(url: string) => void>();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    const first = new File(["first"], "001.png", {
      lastModified: 1,
      type: "image/png",
    });
    const second = new File(["second"], "002.png", {
      lastModified: 2,
      type: "image/png",
    });
    const { rerender } = render(<PreviewsProbe files={[first, second]} />);

    await waitFor(() => {
      expect(screen.getByTestId("previews").textContent).toContain(
        "blob:second"
      );
    });
    expect(createObjectURL).toHaveBeenCalledTimes(2);

    rerender(<PreviewsProbe files={[second]} />);

    await waitFor(() => {
      expect(screen.getByTestId("previews").textContent).not.toContain(
        "001.png"
      );
    });
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });

  it("releases retained preview URLs when unmounted", async () => {
    const createObjectURL = vi.fn<(file: Blob) => string>(() => "blob:page");
    const revokeObjectURL = vi.fn<(url: string) => void>();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const file = new File(["page"], "001.png", { type: "image/png" });
    const { unmount } = render(<PreviewsProbe files={[file]} />);

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledOnce();
    });
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:page");
  });
});
