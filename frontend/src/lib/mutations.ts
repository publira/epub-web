import * as z from "zod";

import {
  formatInteger,
  formatMiBFromBytes,
  formatSecondsFromMs,
} from "./format";
import { parseFilename } from "./utils";
import { unzipAsync } from "./zip";

export interface ExtractedImage {
  name: string;
  blob: Blob;
  mimeType: string;
  url: string;
}

const imageMimeTypes: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const parseExtractImageMimeTypes = (
  encodedMimeTypes: string | null
): Record<string, string> => {
  if (!encodedMimeTypes) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(encodedMimeTypes));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }

    const mimeTypes: Record<string, string> = {};
    for (const [path, mimeType] of Object.entries(parsed)) {
      if (
        typeof mimeType === "string" &&
        mimeType.toLowerCase().startsWith("image/")
      ) {
        mimeTypes[path] = mimeType;
      }
    }
    return mimeTypes;
  } catch {
    return {};
  }
};

const getExtractedImageMimeType = (
  path: string,
  extractedImageMimeTypes: Record<string, string>
): string | undefined => {
  const extension = path.split(".").pop()?.toLowerCase();
  return (
    extractedImageMimeTypes[path] ??
    (extension === undefined ? undefined : imageMimeTypes[extension])
  );
};

const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export class ApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

interface ExtractMutationParams {
  file: File;
}

interface BuildMutationParams {
  title: string;
  authors: string[];
  direction: string;
  spread: string;
  language: string;
  cover: boolean;
  files: File[];
}

interface ErrorMessageOptions {
  defaultMessage: string;
  maxPages?: number;
  maxUploadMB?: number;
  maxAssetBytes?: number;
  maxImagePixels?: number;
  maxImageLongEdge?: number;
  requestTimeoutMs?: number;
}

const apiErrorMessageResolvers: Record<
  string,
  (options: ErrorMessageOptions) => string
> = {
  asset_size_limit_exceeded: (options) =>
    options.maxAssetBytes && options.maxAssetBytes > 0
      ? `画像1枚あたり最大 ${formatMiBFromBytes(options.maxAssetBytes)} です。`
      : "画像ファイルのサイズ上限を超えています。",
  build_failed: () => "EPUBの生成に失敗しました。",
  extract_failed: () => "画像抽出に失敗しました。",
  extract_images_failed: () => "画像抽出に失敗しました。",
  image_long_edge_limit_exceeded: (options) =>
    options.maxImageLongEdge && options.maxImageLongEdge > 0
      ? `画像の長辺は最大 ${formatInteger(options.maxImageLongEdge)} px です。`
      : "画像の長辺が上限を超えています。",
  image_pixels_limit_exceeded: (options) =>
    options.maxImagePixels && options.maxImagePixels > 0
      ? `画像の解像度は最大 ${formatInteger(options.maxImagePixels)} px です。`
      : "画像の解像度が上限を超えています。",
  invalid_epub: () => "EPUBの解析に失敗しました。",
  invalid_image: () => "画像の解析に失敗しました。",
  invalid_layout: () => "レイアウト指定が不正です。",
  invalid_spread: () => "見開き指定が不正です。",
  missing_epub_file: () => "EPUBファイルを選択してください。",
  network_error: () =>
    "サーバーに接続できませんでした。ネットワーク状態を確認して再試行してください。",
  no_images_provided: () => "画像を1枚以上選択してください。",
  open_image_failed: () => "画像ファイルを開けませんでした。",
  page_limit_exceeded: (options) =>
    options.maxPages && options.maxPages > 0
      ? `ページ数は最大 ${formatInteger(options.maxPages)} ページです。`
      : "ページ数の上限を超えています。",
  read_epub_size_failed: () => "EPUBファイルの読み取りに失敗しました。",
  request_timeout: (options) =>
    options.requestTimeoutMs && options.requestTimeoutMs > 0
      ? `処理が ${formatSecondsFromMs(options.requestTimeoutMs)} 秒でタイムアウトしました。しばらくしてから再試行してください。`
      : "処理がタイムアウトしました。しばらくしてから再試行してください。",
  request_too_large: (options) =>
    options.maxUploadMB && options.maxUploadMB > 0
      ? `1リクエストあたり最大 ${options.maxUploadMB} MiB です。`
      : "アップロード容量の上限を超えています。",
};

const toApiError = async (
  res: Response,
  fallbackCode: string,
  fallbackMessage: string
): Promise<ApiError> => {
  try {
    const payload = apiErrorSchema.parse(await res.json());
    return new ApiError(payload.code, payload.message);
  } catch {
    return new ApiError(fallbackCode, fallbackMessage);
  }
};

export const getApiErrorMessage = (
  error: unknown,
  options: ErrorMessageOptions
): string => {
  if (error instanceof ApiError) {
    const resolver = apiErrorMessageResolvers[error.code];
    if (resolver) {
      return resolver(options);
    }

    return error.message || options.defaultMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return options.defaultMessage;
};

export const buildMutationFn = async (
  params: BuildMutationParams
): Promise<{ blob: Blob; filename: string }> => {
  const data = new FormData();
  data.set("title", params.title);
  data.set("direction", params.direction);
  data.set("spread", params.spread);
  data.set("language", params.language);
  if (params.cover) {
    data.set("cover", "true");
  }
  for (const author of params.authors) {
    data.append("authors", author);
  }

  for (const file of params.files) {
    data.append("images", file);
  }

  let res: Response;
  try {
    res = await fetch("/api/build", {
      body: data,
      method: "POST",
    });
  } catch {
    throw new ApiError(
      "network_error",
      "サーバーに接続できませんでした。ネットワーク状態を確認して再試行してください。"
    );
  }

  if (!res.ok) {
    throw await toApiError(res, "build_failed", "Failed to build EPUB.");
  }

  const blob = await res.blob();
  const filename = parseFilename(
    res.headers.get("Content-Disposition"),
    `${params.title || "Untitled"}.epub`
  );

  return { blob, filename };
};

export type ReadingDirection = "ltr" | "rtl";

export interface ExtractResult {
  images: ExtractedImage[];
  readingDirection: ReadingDirection;
  spreadStartIndex: number;
  title: string;
  zipBlob: Blob;
  zipFilename: string;
}

export const extractMutationFn = async (
  params: ExtractMutationParams
): Promise<ExtractResult> => {
  const formData = new FormData();
  formData.set("epub", params.file);

  let res: Response;
  try {
    res = await fetch("/api/extract", {
      body: formData,
      method: "POST",
    });
  } catch {
    throw new ApiError(
      "network_error",
      "サーバーに接続できませんでした。ネットワーク状態を確認して再試行してください。"
    );
  }

  if (!res.ok) {
    throw await toApiError(res, "extract_failed", "Failed to extract images.");
  }

  const zipBlob = await res.blob();
  const zipFilename = parseFilename(
    res.headers.get("Content-Disposition"),
    "extracted.zip"
  );
  const readingDirection: ReadingDirection =
    res.headers.get("X-EPUB-Reading-Direction") === "ltr" ? "ltr" : "rtl";
  const fallbackTitle = params.file.name.toLowerCase().endsWith(".epub")
    ? params.file.name.slice(0, -5)
    : params.file.name;
  const encodedTitle = res.headers.get("X-EPUB-Title");
  let title = fallbackTitle || "Untitled";
  if (encodedTitle) {
    try {
      title = decodeURIComponent(encodedTitle);
    } catch {
      // Keep the file name as a safe fallback for malformed response headers.
    }
  }
  const rawSpreadStartIndex = Math.trunc(
    Number(res.headers.get("X-EPUB-Spread-Start") ?? "0")
  );
  const extractedImageMimeTypes = parseExtractImageMimeTypes(
    res.headers.get("X-EPUB-Image-MIME-Types")
  );
  const arrayBuffer = await zipBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let unzippedFiles: Record<string, Uint8Array>;
  try {
    unzippedFiles = await unzipAsync(uint8Array);
  } catch {
    throw new Error("ZIPの展開に失敗しました。");
  }

  const images: ExtractedImage[] = [];
  for (const [path, content] of Object.entries(unzippedFiles)) {
    const mimeType = getExtractedImageMimeType(path, extractedImageMimeTypes);
    if (mimeType !== undefined) {
      const blob = new Blob([new Uint8Array(content)], {
        type: mimeType,
      });
      const filename = path.split("/").pop() || path;
      images.push({
        blob,
        mimeType,
        name: filename,
        url: URL.createObjectURL(blob),
      });
    }
  }

  if (images.length === 0) {
    throw new Error("画像ファイルが見つかりません。");
  }

  return {
    images,
    readingDirection,
    spreadStartIndex:
      Number.isSafeInteger(rawSpreadStartIndex) && rawSpreadStartIndex >= 0
        ? Math.min(rawSpreadStartIndex, images.length)
        : 0,
    title,
    zipBlob,
    zipFilename,
  };
};

export const configSchema = z.object({
  maxAssetBytes: z.number(),
  maxImageLongEdge: z.number(),
  maxImagePixels: z.number(),
  maxPages: z.number(),
  maxUploadMB: z.number(),
  requestTimeoutMs: z.number(),
  supportedLanguages: z.array(z.string()).min(1),
});
