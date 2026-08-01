export const parseFilename = (
  contentDisposition: string | null,
  fallback: string
): string => {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(
    /filename\*=UTF-8''(?<name>[^;]+)/iu
  );
  if (utf8Match?.groups?.name) {
    return decodeURIComponent(utf8Match.groups.name);
  }

  const match = contentDisposition.match(/filename="?(?<name>[^";]+)"?/iu);
  return match?.groups?.name ?? fallback;
};

export const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
};
