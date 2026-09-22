import { catalogs } from "@publira/epub-web-locales";
import type { MessageId } from "@publira/epub-web-locales";
import { createIntl, createIntlCache } from "react-intl";
import type { IntlShape, PrimitiveType } from "react-intl";

/** A language with a catalog in `@publira/epub-web-locales`, such as `en`. */
export type Locale = string;

export const defaultLocale: Locale = "en";

export const localeQueryParam = "lang";

export const localeStorageKey = "epub-web-locale";

/**
 * Text formatted at render time rather than when it is produced, so a message
 * kept in state follows a later locale switch.
 */
export type LocalizedText = (intl: IntlShape) => string;

export const localized =
  (id: MessageId, values?: Record<string, PrimitiveType>): LocalizedText =>
  (intl) =>
    intl.formatMessage({ id }, values);

const isLocale = (value: string): value is Locale =>
  Object.hasOwn(catalogs, value);

/**
 * Maps a BCP 47 tag such as `ja-JP` to a locale with a catalog by its primary
 * language subtag.
 */
export const matchLocale = (tag: string | null | undefined): Locale | null => {
  const language = tag?.trim().toLowerCase().split(/[-_]/u)[0] ?? "";
  return isLocale(language) ? language : null;
};

/**
 * The server renders the initial language of each page request (`?lang=`,
 * then `Accept-Language`) into `<html lang>`.
 */
export const getDocumentLocale = (): Locale =>
  matchLocale(document.documentElement.lang) ?? defaultLocale;

const readStoredLocale = (): Locale | null => {
  try {
    return matchLocale(window.localStorage.getItem(localeStorageKey));
  } catch {
    // Storage can be unavailable (privacy mode, blocked site data).
    return null;
  }
};

/** The server's interface languages that this build has a catalog for. */
export const getSwitchableLocales = (
  interfaceLanguages: readonly string[]
): Locale[] => [
  ...new Set(
    interfaceLanguages
      .map((language) => matchLocale(language))
      .filter((locale) => locale !== null)
  ),
];

/** Remembers an explicit choice for later visits. */
export const persistLocale = (locale: Locale) => {
  try {
    window.localStorage.setItem(localeStorageKey, locale);
  } catch {
    // Without storage the choice lasts for this page only.
  }
};

/**
 * Resolves the locale to start with: an explicit `?lang=` (remembered), then
 * the remembered choice, then the server's initial language.
 */
export const resolveInitialLocale = (): Locale => {
  const requested = matchLocale(
    new URLSearchParams(window.location.search).get(localeQueryParam)
  );
  if (requested) {
    persistLocale(requested);
    return requested;
  }

  return readStoredLocale() ?? getDocumentLocale();
};

/** Reflects a locale chosen in the page in `?lang=`, keeping the other parameters. */
export const replaceLocaleQueryParam = (locale: Locale) => {
  const url = new URL(window.location.href);
  url.searchParams.set(localeQueryParam, locale);
  window.history.replaceState(window.history.state, "", url);
};

const intlCache = createIntlCache();
const intls = new Map<Locale, IntlShape>();

/** Returns one shared `IntlShape` per locale, so its identity is stable across renders. */
export const getAppIntl = (locale: Locale): IntlShape => {
  let intl = intls.get(locale);
  if (!intl) {
    intl = createIntl(
      { defaultLocale, locale, messages: catalogs[locale] },
      intlCache
    );
    intls.set(locale, intl);
  }

  return intl;
};

/** Keeps the document's language, title, and description in the current locale. */
export const applyDocumentLocale = (intl: IntlShape) => {
  document.documentElement.lang = intl.locale;
  document.title = intl.formatMessage({ id: "document.title" });
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      "content",
      intl.formatMessage({ id: "document.description" })
    );
};

/**
 * Picks the EPUB metadata language that matches the interface locale, or the
 * first supported language when the server does not offer it.
 */
export const resolveEpubLanguage = (
  locale: Locale,
  supportedLanguages: readonly string[]
): string =>
  supportedLanguages.find((code) => matchLocale(code) === locale) ??
  supportedLanguages[0] ??
  locale;
