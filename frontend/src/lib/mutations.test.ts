import {
  ApiError,
  buildMutationFn,
  extractMutationFn,
  getApiErrorMessage,
} from "./mutations";
import { zipAsync } from "./zip";

describe("mutations", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const createObjectURL = vi.fn<() => string>(() => "blob:mock");

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
    });
    fetchMock.mockReset();
    createObjectURL.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("buildMutationFn returns blob and parsed filename", async () => {
    const blob = new Blob(["epub"]);
    fetchMock.mockResolvedValueOnce(
      new Response(blob, {
        headers: {
          "Content-Disposition": 'attachment; filename="book.epub"',
        },
        status: 200,
      })
    );

    const result = await buildMutationFn({
      authors: [],
      direction: "rtl",
      files: [new File(["x"], "a.png", { type: "image/png" })],
      spread: "right",
      title: "book",
    });

    expect(result.filename).toBe("book.epub");
    expect(result.blob.size).toBe(blob.size);
  }, 1000);

  it("buildMutationFn sends multiple authors", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Blob(["epub"]), { status: 200 })
    );

    await buildMutationFn({
      authors: ["Alice", "Bob"],
      direction: "rtl",
      files: [new File(["x"], "a.png", { type: "image/png" })],
      spread: "right",
      title: "book",
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.body).toBeInstanceOf(FormData);
    const formData = requestInit?.body as FormData;
    expect(formData.getAll("authors")).toStrictEqual(["Alice", "Bob"]);
  }, 1000);

  it("extractMutationFn extracts image files only", async () => {
    const zipped = await zipAsync({
      "images/1.jpg": new Uint8Array([1, 2, 3]),
      "notes/readme.txt": new Uint8Array([5, 6, 7]),
    });
    fetchMock.mockResolvedValueOnce(
      new Response(new Blob([new Uint8Array(zipped)]), { status: 200 })
    );

    const result = await extractMutationFn({
      file: new File(["dummy"], "test.epub", { type: "application/epub+zip" }),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("1.jpg");
    expect(createObjectURL).toHaveBeenCalledOnce();
  }, 1000);

  it("buildMutationFn throws ApiError from JSON response", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          code: "page_limit_exceeded",
          message: "Page limit exceeded.",
        },
        {
          status: 400,
        }
      )
    );

    await expect(
      buildMutationFn({
        authors: [],
        direction: "rtl",
        files: [new File(["x"], "a.png", { type: "image/png" })],
        spread: "right",
        title: "book",
      })
    ).rejects.toMatchObject({
      code: "page_limit_exceeded",
      message: "Page limit exceeded.",
      name: "ApiError",
    });
  }, 1000);

  it("getApiErrorMessage maps code to localized message", () => {
    const message = getApiErrorMessage(
      new ApiError("request_too_large", "Request too large."),
      {
        defaultMessage: "画像抽出に失敗しました。",
        maxUploadMB: 8,
      }
    );

    expect(message).toBe("1リクエストあたり最大 8 MiB です。");
  }, 1000);

  it("getApiErrorMessage maps build option validation codes", () => {
    expect(
      getApiErrorMessage(new ApiError("invalid_layout", "Invalid layout."), {
        defaultMessage: "ePubの生成に失敗しました。",
      })
    ).toBe("レイアウト指定が不正です。");

    expect(
      getApiErrorMessage(new ApiError("invalid_spread", "Invalid spread."), {
        defaultMessage: "ePubの生成に失敗しました。",
      })
    ).toBe("見開き指定が不正です。");

    expect(
      getApiErrorMessage(
        new ApiError(
          "image_long_edge_limit_exceeded",
          "Image long edge limit exceeded."
        ),
        {
          defaultMessage: "ePubの生成に失敗しました。",
          maxImageLongEdge: 2048,
        }
      )
    ).toBe("画像の長辺は最大 2,048 px です。");
  }, 1000);

  it("getApiErrorMessage preserves server message for unknown api codes", () => {
    const message = getApiErrorMessage(
      new ApiError("unexpected_code", "Server supplied message."),
      {
        defaultMessage: "ePubの生成に失敗しました。",
      }
    );

    expect(message).toBe("Server supplied message.");
  }, 1000);

  it("buildMutationFn converts network failures to ApiError", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      buildMutationFn({
        authors: [],
        direction: "rtl",
        files: [new File(["x"], "a.png", { type: "image/png" })],
        spread: "right",
        title: "book",
      })
    ).rejects.toMatchObject({
      code: "network_error",
      name: "ApiError",
    });
  }, 1000);
});
