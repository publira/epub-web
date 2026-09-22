import type { IntlShape } from "react-intl";

const mebibyte = 1024 * 1024;

const fixed1 = { maximumFractionDigits: 1, minimumFractionDigits: 1 };
const fixed2 = { maximumFractionDigits: 2, minimumFractionDigits: 2 };

export const formatMiBFromBytes = (intl: IntlShape, bytes: number): string =>
  `${intl.formatNumber(bytes / mebibyte, fixed1)} MiB`;

export const formatSizeLabel = (intl: IntlShape, bytes: number): string =>
  bytes >= mebibyte
    ? `${intl.formatNumber(bytes / mebibyte, fixed2)} MiB`
    : `${intl.formatNumber(bytes / 1024, fixed1)} KiB`;

export const formatSecondsFromMs = (intl: IntlShape, ms: number): string =>
  intl.formatNumber(ms / 1000, { maximumFractionDigits: 1 });

export const formatLanguageName = (intl: IntlShape, code: string): string =>
  intl.formatDisplayName(code, { type: "language" }) ?? code;

export const formatLastModified = (
  intl: IntlShape,
  lastModified: number
): string =>
  intl.formatDate(lastModified, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
