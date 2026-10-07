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
const keys = [
  "title",
  "description",
  "sourcesTitle",
  "accountRequired",
  "accountRequiredDescription",
  "chooseFile",
  "chooseAnother",
  "preview",
  "forBaby",
  "toAdd",
  "alreadyImported",
  "skipped",
  "dateRange",
  "timeZone",
  "addRecords",
  "progress",
  "finished",
  "failed",
  "failedBeforeSave",
  "connectAndSync",
  "leaveTitle",
  "leaveMessage",
  "leave",
  "stay",
  "invalidFile",
  "fileTooLarge",
  "noBaby",
  "types.sleep",
  "types.feeding",
  "types.diaper",
  "types.growth",
  "types.pumping",
  "types.health",
  "types.tummyTime",
  "reasons.couldNotRead",
  "reasons.stillRunning",
  "reasons.outsideLimits",
  "reasons.future",
  "reasons.duplicateInFile",
  "reasons.unsupported",
];

describe("import screen translations", () => {
  it.each(Object.entries(locales))(
    "names both supported file formats in %s",
    (_language, translations) => {
      expect(translations.import.invalidFile).toContain("Huckleberry");
      expect(translations.import.invalidFile).toContain("Nara");
    }
  );
  it.each(Object.entries(locales))(
    "has every screen string in %s",
    (_language, translations) => {
      for (const key of keys) {
        const value = ["import", ...key.split(".")].reduce<unknown>(
          (object, field) =>
            object && typeof object === "object"
              ? (object as Record<string, unknown>)[field]
              : undefined,
          translations
        );
        expect(value, key).toBeTypeOf("string");
        expect(value, key).not.toBe("");
      }
    }
  );
});
