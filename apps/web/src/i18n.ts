/**
 * Interface text and the person's language.
 *
 * @remarks All interface text lives in translation files (AGENTS.md hard rule 12, ADR-0015). English is the only
 * language in v0.1; others are added as `locales/<language>.json` and loaded on demand.
 * @packageDocumentation
 */
import i18next, { type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

/** The translations bundled with the app, by language. */
export const RESOURCES = { en: { translation: en } } as const;

/**
 * Creates the app's translation instance, ready to use as soon as it returns.
 *
 * @remarks A fresh instance per app, so tests don't share state. React escapes text itself, so i18next doesn't.
 * @returns The instance, set to English.
 */
export function createI18n(): i18n {
  const instance = i18next.createInstance().use(initReactI18next);
  void instance.init({
    lng: "en",
    fallbackLng: "en",
    resources: RESOURCES,
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}
