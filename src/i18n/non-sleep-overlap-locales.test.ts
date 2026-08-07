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

describe("non-sleep overlap translations", () => {
  it.each(Object.entries(locales))("provides overlap copy for every activity in %s", (_locale, translations) => {
    const duplicateDetection = translations.duplicateDetection as Record<string, string>;

    for (const activityType of ["feeding", "pumping", "tummyTime"]) {
      expect(duplicateDetection[`${activityType}OverlapTitle`]).toBeTruthy();
      expect(duplicateDetection[`${activityType}OverlapMessage`]).toBeTruthy();
    }
  });
});
