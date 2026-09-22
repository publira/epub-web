import { createContext, use, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { RawIntlProvider, useIntl } from "react-intl";

import {
  applyDocumentLocale,
  defaultLocale,
  getAppIntl,
  matchLocale,
  replaceLocaleQueryParam,
} from "#lib/i18n";
import type { Locale } from "#lib/i18n";

const SetLocaleContext = createContext<((locale: Locale) => void) | null>(null);

interface LocaleProviderProps {
  children: ReactNode;
  initialLocale: Locale;
}

export const LocaleProvider = ({
  children,
  initialLocale,
}: LocaleProviderProps) => {
  const [locale, setLocale] = useState(initialLocale);
  const intl = getAppIntl(locale);

  useEffect(() => {
    applyDocumentLocale(intl);
  }, [intl]);

  return (
    <SetLocaleContext value={setLocale}>
      <RawIntlProvider value={intl}>{children}</RawIntlProvider>
    </SetLocaleContext>
  );
};

export const useLocale = (): Locale =>
  matchLocale(useIntl().locale) ?? defaultLocale;

/** Returns a function that switches the interface locale in place and shows it in `?lang=`. */
export const useSetLocale = (): ((locale: Locale) => void) => {
  const setLocale = use(SetLocaleContext);
  if (!setLocale) {
    throw new Error("useSetLocale must be used within a LocaleProvider.");
  }

  return (locale) => {
    replaceLocaleQueryParam(locale);
    setLocale(locale);
  };
};
