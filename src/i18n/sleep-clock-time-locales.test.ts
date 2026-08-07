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

const locales = {
  de,
  en,
  es,
  "es-ES": esES,
  fr,
  it: itLocale,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  sr,
};

describe("sleep clock-time translations", () => {
  it.each(Object.entries(locales))(
    "provides the shared clock-time copy for %s",
    (_locale, translations) => {
      const sleep = translations.sleep as Record<string, string>;
      const validation = translations.validation as Record<string, string>;

      expect(sleep.startTime).toBeTruthy();
      expect(sleep.endTime).toBeTruthy();
      expect(sleep.duration).toBeTruthy();
      expect(validation.endTimeNotInFuture).toBeTruthy();
      expect(sleep.durationMinutes).toBeUndefined();
      expect(sleep.durationPlaceholder).toBeUndefined();
      expect(sleep.quickDurations).toBeTruthy();
    }
  );
});
