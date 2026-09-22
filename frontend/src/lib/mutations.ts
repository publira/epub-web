import type { IntlShape } from "react-intl";
import * as z from "zod";

import { formatMiBFromBytes, formatSecondsFromMs } from "./format";
import type { LocalizedText, MessageId } from "./i18n";
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
  defaultMessageId: MessageId;
  maxPages?: number;
  maxUploadMB?: number;
  maxAssetBytes?: number;
  maxImagePixels?: number;
  maxImageLongEdge?: number;
  requestTimeoutMs?: number;
}

const isPositive = (value: number | undefined): value is number =>
  value !== undefined && value > 0;

const apiErrorMessageResolvers: Record<
  string,
  (intl: IntlShape, options: ErrorMessageOptions) => string
> = {
  asset_size_limit_exceeded: (intl, { maxAssetBytes }) =>
    isPositive(maxAssetBytes)
      ? intl.formatMessage(
          { id: "error.assetSizeLimit" },
          { size: formatMiBFromBytes(intl, maxAssetBytes) }
        )
      : intl.formatMessage({ id: "error.assetSizeLimit.unknown" }),
  build_failed: (intl) => intl.formatMessage({ id: "error.buildFailed" }),
  extract_failed: (intl) => intl.formatMessage({ id: "error.extractFailed" }),
  extract_images_failed: (intl) =>
    intl.formatMessage({ id: "error.extractFailed" }),
  image_long_edge_limit_exceeded: (intl, { maxImageLongEdge }) =>
    isPositive(maxImageLongEdge)
      ? intl.formatMessage(
          { id: "error.imageLongEdgeLimit" },
          { max: maxImageLongEdge }
        )
      : intl.formatMessage({ id: "error.imageLongEdgeLimit.unknown" }),
  image_pixels_limit_exceeded: (intl, { maxImagePixels }) =>
    isPositive(maxImagePixels)
      ? intl.formatMessage(
          { id: "error.imagePixelsLimit" },
          { max: maxImagePixels }
        )
      : intl.formatMessage({ id: "error.imagePixelsLimit.unknown" }),
  invalid_epub: (intl) => intl.formatMessage({ id: "error.invalidEpub" }),
  invalid_image: (intl) => intl.formatMessage({ id: "error.invalidImage" }),
  invalid_layout: (intl) => intl.formatMessage({ id: "error.invalidLayout" }),
  invalid_spread: (intl) => intl.formatMessage({ id: "error.invalidSpread" }),
  missing_epub_file: (intl) =>
    intl.formatMessage({ id: "error.missingEpubFile" }),
  network_error: (intl) => intl.formatMessage({ id: "error.network" }),
  no_images_found: (intl) => intl.formatMessage({ id: "error.noImagesFound" }),
  no_images_provided: (intl) =>
    intl.formatMessage({ id: "error.noImagesProvided" }),
  open_image_failed: (intl) =>
    intl.formatMessage({ id: "error.openImageFailed" }),
  page_limit_exceeded: (intl, { maxPages }) =>
    isPositive(maxPages)
      ? intl.formatMessage({ id: "error.pageLimit" }, { max: maxPages })
      : intl.formatMessage({ id: "error.pageLimit.unknown" }),
  read_epub_size_failed: (intl) =>
    intl.formatMessage({ id: "error.readEpubSizeFailed" }),
  request_timeout: (intl, { requestTimeoutMs }) =>
    isPositive(requestTimeoutMs)
      ? intl.formatMessage(
          { id: "error.requestTimeout" },
          {
            label: formatSecondsFromMs(intl, requestTimeoutMs),
            seconds: requestTimeoutMs / 1000,
          }
        )
      : intl.formatMessage({ id: "error.requestTimeout.unknown" }),
  request_too_large: (intl, { maxUploadMB }) =>
    isPositive(maxUploadMB)
      ? intl.formatMessage(
          { id: "error.requestTooLarge" },
          { size: maxUploadMB }
        )
      : intl.formatMessage({ id: "error.requestTooLarge.unknown" }),
  unzip_failed: (intl) => intl.formatMessage({ id: "error.unzipFailed" }),
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

export const getApiErrorMessage =
  (error: unknown, options: ErrorMessageOptions): LocalizedText =>
  (intl) => {
    if (error instanceof ApiError) {
      const resolver = apiErrorMessageResolvers[error.code];
      if (resolver) {
        return resolver(intl, options);
      }

      return (
        error.message || intl.formatMessage({ id: options.defaultMessageId })
      );
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return intl.formatMessage({ id: options.defaultMessageId });
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
    throw new ApiError("network_error", "Could not connect to the server.");
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
    throw new ApiError("network_error", "Could not connect to the server.");
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
    throw new ApiError("unzip_failed", "Failed to unpack the ZIP file.");
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
    throw new ApiError("no_images_found", "No image files were found.");
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
  interfaceLanguages: z.array(z.string()),
  maxAssetBytes: z.number(),
  maxImageLongEdge: z.number(),
  maxImagePixels: z.number(),
  maxPages: z.number(),
  maxUploadMB: z.number(),
  requestTimeoutMs: z.number(),
  supportedLanguages: z.array(z.string()).min(1),
});
