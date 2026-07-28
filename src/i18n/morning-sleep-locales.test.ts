import { describe, expect, it } from "vitest";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import esES from "./locales/es-ES.json";
import fr from "./locales/fr.json";
import itLocale from "./locales/it.json";
import ptBR from "./locales/pt-BR.json";
import ptPT from "./locales/pt-PT.json";
import sr from "./locales/sr.json";

const locales = { de, en, es, "es-ES": esES, fr, it: itLocale, "pt-BR": ptBR, "pt-PT": ptPT, sr };
const keys = [
  "morningConfirmationQuestion",
  "firstNap",
  "backToSleep",
  "morningConfirmationAccessibility",
  "confirmMorningInApp",
] as const;

describe("morning sleep confirmation translations", () => {
  it.each(Object.entries(locales))("provides complete copy for %s", (locale, translations) => {
    for (const key of keys) {
      expect(translations.sleep[key]).toBeTruthy();
      if (locale !== "en") expect(translations.sleep[key]).not.toBe(en.sleep[key]);
    }
    expect(translations.sleep.napContinuationDesc).toBeTruthy();
  });
});
