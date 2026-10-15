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

const placeholders: Record<string, string[]> = {
  minutesPerSide: [],
  pausedAndEnds: ["paused", "time"],
  pausedFor: ["paused"],
  endsAt: ["time"],
  leftLongerThanFeed: ["duration"],
  rightLongerThanFeed: ["duration"],
};

describe("breast feed duration translations", () => {
  it.each(Object.entries(locales))(
    "provides the duration and minutes-per-side copy for %s",
    (_locale, translations) => {
      const feeding = translations.feeding as Record<string, string>;
      for (const [key, names] of Object.entries(placeholders)) {
        expect(feeding[key]).toBeTruthy();
        const found = [...feeding[key].matchAll(/{{\s*(\w+)\s*}}/g)].map(
          (match) => match[1]
        );
        expect(found.sort()).toEqual([...names].sort());
      }
    }
  );
});
