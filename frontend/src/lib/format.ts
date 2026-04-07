const locale = "ja-JP";

const jaIntegerFormatter = new Intl.NumberFormat(locale);
const jaFixed1Formatter = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const jaFixed2Formatter = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const jaSecondsVariableFormatter = new Intl.NumberFormat(locale, {
  maximumFractionDigits: 1,
});

export const formatInteger = (value: number): string =>
  jaIntegerFormatter.format(value);

export const formatMiBFromBytes = (bytes: number): string =>
  `${jaFixed1Formatter.format(bytes / (1024 * 1024))} MiB`;

export const formatSizeLabel = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${jaFixed2Formatter.format(bytes / (1024 * 1024))} MiB`
    : `${jaFixed1Formatter.format(bytes / 1024)} KiB`;

export const formatSecondsFromMs = (ms: number): string =>
  jaSecondsVariableFormatter.format(ms / 1000);

const jaLanguageNames = new Intl.DisplayNames(locale, { type: "language" });

export const formatLanguageName = (code: string): string =>
  jaLanguageNames.of(code) ?? code;

const jaDateTimeFormatter = new Intl.DateTimeFormat(locale, {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const formatLastModified = (lastModified: number): string =>
  jaDateTimeFormatter.format(new Date(lastModified));
