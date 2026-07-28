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

function leafKeys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" ? leafKeys(child, path) : [path];
  });
}

describe("new owner onboarding translations", () => {
  it.each(Object.entries(locales))("keeps every onboarding key in parity for %s", (_locale, translations) => {
    expect(leafKeys(translations.newOwnerOnboarding).sort()).toEqual(
      leafKeys(en.newOwnerOnboarding).sort()
    );
    expect(Object.values(translations.newOwnerOnboarding.welcome).every(Boolean)).toBe(true);
  });
});
