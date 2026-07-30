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

function leafEntries(value: object, prefix = ""): Array<[string, string]> {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object"
      ? leafEntries(child, path)
      : [[path, String(child)]];
  });
}

function interpolationTokens(value: string): string[] {
  return [...value.matchAll(/{{\s*([^},\s]+)[^}]*}}/g)]
    .map(match => match[1])
    .sort();
}

describe("new owner onboarding translations", () => {
  it.each(Object.entries(locales))("keeps every onboarding key in parity for %s", (_locale, translations) => {
    const englishEntries = leafEntries(en.newOwnerOnboarding);
    const translatedEntries = new Map(leafEntries(translations.newOwnerOnboarding));

    expect([...translatedEntries.keys()].sort()).toEqual(
      englishEntries.map(([key]) => key).sort()
    );
    expect([...translatedEntries.values()].every(value => value.trim().length > 0)).toBe(true);

    for (const [key, englishValue] of englishEntries) {
      expect(interpolationTokens(translatedEntries.get(key) ?? ""), key).toEqual(
        interpolationTokens(englishValue)
      );
    }
  });

  it("keeps the approved Welcome title and promise direct", () => {
    expect(en.newOwnerOnboarding.welcome.title).toBe("Care for your baby with confidence");
    expect(en.newOwnerOnboarding.welcome.promise).not.toMatch(/—/);
  });
});
