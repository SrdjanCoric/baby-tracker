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

describe("feeding clock-time translations", () => {
  it.each(Object.entries(locales))(
    "provides the feeding clock-time copy for %s",
    (_locale, translations) => {
      const feeding = translations.feeding as Record<string, string>;
      const validation = translations.validation as Record<string, string>;

      expect(feeding.startTime).toBeTruthy();
      expect(feeding.endTime).toBeTruthy();
      expect(feeding.duration).toBeTruthy();
      expect(validation.endTimeNotInFuture).toBeTruthy();

      // Pumping still consumes these shared feeding keys until Task 0074.
      expect(feeding.durationMinutes).toBeTruthy();
      expect(feeding.durationPlaceholder).toBeTruthy();
    }
  );
});
