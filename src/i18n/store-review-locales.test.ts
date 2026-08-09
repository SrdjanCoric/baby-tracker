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

describe("store review translations", () => {
  it.each(Object.entries(locales))(
    "provides the Rate App setting in %s",
    (_locale, translations) => {
      expect(translations.settings.rateApp).toBeTruthy();
    }
  );
});
