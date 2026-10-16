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
  leftLongerThanSession: ["duration"],
  rightLongerThanSession: ["duration"],
};

describe("pumping duration translations", () => {
  it.each(Object.entries(locales))(
    "provides the side-length copy for %s",
    (_locale, translations) => {
      const pumping = translations.pumping as Record<string, string>;
      for (const [key, names] of Object.entries(placeholders)) {
        expect(pumping[key]).toBeTruthy();
        const found = [...pumping[key].matchAll(/{{\s*(\w+)\s*}}/g)].map(
          (match) => match[1]
        );
        expect(found.sort()).toEqual([...names].sort());
      }
    }
  );

  it("uses the decided English wording", () => {
    expect(en.pumping).toEqual(
      expect.objectContaining({
        leftLongerThanSession: "Left can't be longer than the session ({{duration}})",
        rightLongerThanSession: "Right can't be longer than the session ({{duration}})",
      })
    );
  });
});
