import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import en from "./locales/en.json";
import sr from "./locales/sr.json";
import es from "./locales/es.json";
import esES from "./locales/es-ES.json";
import fr from "./locales/fr.json";
import ptPT from "./locales/pt-PT.json";
import ptBR from "./locales/pt-BR.json";
import de from "./locales/de.json";
import it from "./locales/it.json";

const resources = {
  en: { translation: en },
  sr: { translation: sr },
  es: { translation: es },
  "es-ES": { translation: esES },
  fr: { translation: fr },
  "pt-PT": { translation: ptPT },
  "pt-BR": { translation: ptBR },
  de: { translation: de },
  it: { translation: it },
};

i18n.use(initReactI18next).init({
  resources,
  lng: Localization.getLocales()[0]?.languageCode ?? "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: "v4",
});

export default i18n;
