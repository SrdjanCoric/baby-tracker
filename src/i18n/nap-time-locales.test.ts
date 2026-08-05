import { describe, expect, it } from "vitest";
import de from "./locales/de.json";
import en from "./locales/en.json";
import esES from "./locales/es-ES.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import italian from "./locales/it.json";
import ptBR from "./locales/pt-BR.json";
import ptPT from "./locales/pt-PT.json";
import sr from "./locales/sr.json";

const locales = {
  de,
  en,
  "es-ES": esES,
  es,
  fr,
  it: italian,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  sr,
};

const keys = [
  "avgNapTime",
  "avgNapTimeSubtitle",
  "napSchedule",
  "napColumn",
  "napLength",
  "napStarts",
  "napSlot",
  "napOccurrenceCount",
] as const;

describe("nap statistics translations", () => {
  it("labels both nap schedule measurements as averages", () => {
    expect(en.sleepPatterns.napLength).toBe("Avg. Length");
    expect(en.sleepPatterns.napStarts).toBe("Avg. Start");
  });

  it.each(Object.entries(locales))(
    "provides localized card copy for %s",
    (locale, translations) => {
      for (const key of keys) {
        expect(translations.sleepPatterns[key]).toBeTruthy();
        if (locale !== "en") {
          expect(translations.sleepPatterns[key]).not.toBe(en.sleepPatterns[key]);
        }
      }

      expect(translations.sleepPatterns.avgNapTimeSubtitle).toContain(
        "{{nappingDays}}"
      );
      expect(translations.sleepPatterns.avgNapTimeSubtitle).toContain("{{days}}");
      expect(translations.sleepPatterns.napSlot).toContain("{{slotNumber}}");
      expect(translations.sleepPatterns.napOccurrenceCount).toContain("{{count}}");
      expect(translations.sleepPatterns.napOccurrenceCount).toContain(
        "{{nappingDays}}"
      );
    }
  );
});
