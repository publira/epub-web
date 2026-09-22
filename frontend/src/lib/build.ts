import { formatMiBFromBytes } from "./format";
import { localized } from "./i18n";
import type { LocalizedText } from "./i18n";

export const compareFilesByName = (a: File, b: File): number =>
  a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });

export const compareFilesByLastModified = (a: File, b: File): number =>
  a.lastModified - b.lastModified;

export const getFileImagePixels = async (file: File): Promise<number> => {
  const bitmap = await createImageBitmap(file);
  const pixels = bitmap.width * bitmap.height;
  bitmap.close();
  return pixels;
};

export const buildFileKey = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

export const validateSelectedBuildFiles = (
  files: File[],
  options: {
    maxPages: number;
    maxUploadMB: number;
    maxAssetBytes: number;
  }
): LocalizedText | null => {
  if (options.maxPages > 0 && files.length > options.maxPages) {
    return localized("error.pageLimit", { max: options.maxPages });
  }

  if (options.maxUploadMB > 0) {
    const maxUploadBytes = options.maxUploadMB * 1024 * 1024;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxUploadBytes) {
      return localized("error.requestTooLarge", { size: options.maxUploadMB });
    }
  }

  if (options.maxAssetBytes > 0) {
    const oversized = files.find((file) => file.size > options.maxAssetBytes);
    if (oversized) {
      return (intl) =>
        intl.formatMessage(
          { id: "error.assetSizeLimit" },
          { size: formatMiBFromBytes(intl, options.maxAssetBytes) }
        );
    }
  }

  return null;
};
