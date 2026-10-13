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

describe("discard timer translations", () => {
  it.each(Object.entries(locales))(
    "provides all discard copy for %s",
    (_locale, translations) => {
      const common = translations.common as Record<string, string>;
      for (const key of [
        "discardTimer",
        "discardTimerBody",
        "keepTiming",
        "discard",
      ]) {
        expect(common[key]).toBeTruthy();
      }
      expect(common.discardTimerBody.match(/{{\s*elapsed\s*}}/g)).toHaveLength(
        1
      );
      for (const type of [
        "sleep",
        "feeding",
        "pumping",
        "tummyTime",
      ] as const) {
        expect(
          (translations[type] as Record<string, string>).discardTimerTitle
        ).toBeTruthy();
      }
    }
  );

  it("keeps the decided English alert and link text", () => {
    expect(en.common.discardTimer).toBe("Discard timer");
    expect(en.common.discardTimerBody).toBe(
      "{{elapsed}} will not be saved. The timer is cleared on every phone."
    );
    expect(en.common.keepTiming).toBe("Keep timing");
    expect(en.common.discard).toBe("Discard");
    expect(en.sleep.discardTimerTitle).toBe("Discard this sleep?");
    expect(en.feeding.discardTimerTitle).toBe("Discard this feed?");
    expect(en.pumping.discardTimerTitle).toBe("Discard this pumping session?");
    expect(en.tummyTime.discardTimerTitle).toBe("Discard this tummy time?");
  });
});
