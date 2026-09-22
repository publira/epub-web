import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { resolveInitialLocale } from "#lib/i18n";

import { App } from "./components/app";
import { LocaleProvider } from "./components/i18n/locale-provider";

const main = () => {
  const root = document.querySelector("#root");

  if (!root) {
    throw new Error("Root element not found.");
  }

  createRoot(root).render(
    <StrictMode>
      <LocaleProvider initialLocale={resolveInitialLocale()}>
        <App />
      </LocaleProvider>
    </StrictMode>
  );
};

main();
