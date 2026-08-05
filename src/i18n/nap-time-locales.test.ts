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
  it("keeps the approved nap schedule headers", () => {
    expect(en.sleepPatterns.napLength).toBe("Length");
    expect(en.sleepPatterns.napStarts).toBe("Starts");
  });

  it("uses compact native average labels in the narrow schedule columns", () => {
    expect({
      de: [de.sleepPatterns.napLength, de.sleepPatterns.napStarts],
      es: [es.sleepPatterns.napLength, es.sleepPatterns.napStarts],
      "es-ES": [esES.sleepPatterns.napLength, esES.sleepPatterns.napStarts],
      fr: [fr.sleepPatterns.napLength, fr.sleepPatterns.napStarts],
      it: [italian.sleepPatterns.napLength, italian.sleepPatterns.napStarts],
      "pt-BR": [ptBR.sleepPatterns.napLength, ptBR.sleepPatterns.napStarts],
      "pt-PT": [ptPT.sleepPatterns.napLength, ptPT.sleepPatterns.napStarts],
      sr: [sr.sleepPatterns.napLength, sr.sleepPatterns.napStarts],
    }).toEqual({
      de: ["Dauer", "Beginn"],
      es: ["Duración", "Empieza"],
      "es-ES": ["Duración", "Empieza"],
      fr: ["Durée", "Début"],
      it: ["Durata", "Inizio"],
      "pt-BR": ["Duração", "Começa"],
      "pt-PT": ["Duração", "Começa"],
      sr: ["Trajanje", "Početak"],
    });
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
