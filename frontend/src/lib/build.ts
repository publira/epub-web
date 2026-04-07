import { formatInteger, formatMiBFromBytes } from "./format";

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
): string | null => {
  if (options.maxPages > 0 && files.length > options.maxPages) {
    return `ページ数は最大 ${formatInteger(options.maxPages)} ページです。`;
  }

  if (options.maxUploadMB > 0) {
    const maxUploadBytes = options.maxUploadMB * 1024 * 1024;
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > maxUploadBytes) {
      return `1リクエストあたり最大 ${options.maxUploadMB} MiB です。`;
    }
  }

  if (options.maxAssetBytes > 0) {
    const oversized = files.find((file) => file.size > options.maxAssetBytes);
    if (oversized) {
      return `画像1枚あたり最大 ${formatMiBFromBytes(options.maxAssetBytes)} です。`;
    }
  }

  return null;
};
