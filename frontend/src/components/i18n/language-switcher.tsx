import { Languages } from "lucide-react";
import { useId, useRef } from "react";
import { useIntl } from "react-intl";

import { useAppConfigQuery } from "#lib/hooks";
import {
  getSwitchableLocales,
  localeQueryParam,
  persistLocale,
} from "#lib/i18n";
import type { Locale } from "#lib/i18n";

import { useLocale, useSetLocale } from "./locale-provider";

// Each entry names its language in that language, so it stays recognisable
// whichever locale is active.
const getEndonym = (locale: Locale): string =>
  new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;

const getLocaleHref = (locale: Locale): string => {
  const url = new URL(window.location.href);
  url.searchParams.set(localeQueryParam, locale);
  return `${url.pathname}${url.search}`;
};

export const LanguageSwitcher = () => {
  const intl = useIntl();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const { data: config } = useAppConfigQuery();
  const menuId = useId();
  const menuRef = useRef<HTMLUListElement>(null);
  const label = intl.formatMessage({ id: "app.languageSwitcher.label" });

  const handleSelect = (
    event: React.MouseEvent<HTMLAnchorElement>,
    option: Locale
  ) => {
    // The link works on its own; with JavaScript the switch happens in place.
    event.preventDefault();
    persistLocale(option);
    setLocale(option);
    menuRef.current?.hidePopover();
  };

  // The languages come from the server; until they arrive, or when there is
  // nothing to switch to, there is no menu.
  const locales = config ? getSwitchableLocales(config.interfaceLanguages) : [];
  if (locales.length < 2) {
    return null;
  }

  // The popover gives light dismiss, Escape, and focus return; CSS anchor
  // positioning places it under the button.
  return (
    <>
      <button
        aria-label={label}
        className="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary/20 bg-transparent text-muted-foreground transition [anchor-name:--language-switcher] hover:bg-primary-subtle hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:outline-none"
        popoverTarget={menuId}
        title={label}
        type="button"
      >
        <Languages aria-hidden="true" size={18} />
      </button>
      <ul
        aria-label={label}
        className="inset-auto m-0 mt-2 min-w-36 list-none rounded-xl border border-primary/20 bg-card-surface p-1 text-foreground shadow-card [position-anchor:--language-switcher] [position-area:bottom_span-left] [position-try-fallbacks:flip-block]"
        id={menuId}
        popover="auto"
        ref={menuRef}
      >
        {locales.map((option) => (
          <li key={option}>
            <a
              aria-current={option === locale ? "true" : undefined}
              className="block rounded-lg px-3 py-1.5 text-sm text-foreground no-underline transition hover:bg-primary-subtle hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:outline-none aria-[current=true]:font-semibold aria-[current=true]:text-primary"
              href={getLocaleHref(option)}
              hrefLang={option}
              lang={option}
              onClick={(event) => handleSelect(event, option)}
            >
              {getEndonym(option)}
            </a>
          </li>
        ))}
      </ul>
    </>
  );
};
