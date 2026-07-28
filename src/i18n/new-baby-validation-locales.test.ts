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

const locales = { de, en, "es-ES": esES, es, fr, it: italian, "pt-BR": ptBR, "pt-PT": ptPT, sr };

describe("new baby validation translations", () => {
  it.each(Object.entries(locales))("provides every required error in %s", (_locale, translations) => {
    expect(translations.validation.birthDateRequired).toBeTruthy();
    expect(translations.validation.birthDateInvalid).toBeTruthy();
    expect(translations.validation.genderRequired).toBeTruthy();
  });
});
