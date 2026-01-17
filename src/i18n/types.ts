import en from "./locales/en.json";

export type TranslationKeys = typeof en;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: TranslationKeys;
    };
  }
}
