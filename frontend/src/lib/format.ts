const jaIntegerFormatter = new Intl.NumberFormat("ja-JP");
const jaFixed1Formatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const jaFixed2Formatter = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const jaSecondsVariableFormatter = new Intl.NumberFormat("ja-JP", {
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
