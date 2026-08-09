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
  de: { translations: de, range: "30 T", count: "2-mal", minutes: "5Min" },
  en: { translations: en, range: "30d", count: "2×", minutes: "5m" },
  es: { translations: es, range: "30 d", count: "2 veces", minutes: "5min" },
  "es-ES": { translations: esES, range: "30 d", count: "2 veces", minutes: "5min" },
  fr: { translations: fr, range: "30 j", count: "2 fois", minutes: "5min" },
  it: { translations: itLocale, range: "30 g", count: "2 volte", minutes: "5min" },
  "pt-BR": { translations: ptBR, range: "30 d", count: "2 vezes", minutes: "5min" },
  "pt-PT": { translations: ptPT, range: "30 d", count: "2 vezes", minutes: "5min" },
  sr: { translations: sr, range: "30 d", count: "2 puta", minutes: "5m" },
};

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{{${key}}}`, String(value)),
    template
  );
}

describe("statistics short labels", () => {
  it.each(Object.entries(locales))(
    "localizes health range, symptom count, and tummy-time minutes for %s",
    (_locale, { translations, range, count, minutes }) => {
      const health = translations.stats.health as Record<string, string>;

      expect(health.range30DaysShort).toBe(range);
      expect(interpolate(health.symptomCountShort, { count: 2 })).toBe(count);
      expect(interpolate(translations.common.durationM, { m: 5 })).toBe(minutes);
    }
  );
});
