import { useTranslation } from "react-i18next";
import type { TranslationKeys } from "@i18n/types";

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationKeys>;

export function useAppTranslation() {
  const { t, i18n } = useTranslation();

  return {
    t: t as (key: TranslationKey, options?: Record<string, unknown>) => string,
    i18n,
    currentLanguage: i18n.language,
    changeLanguage: i18n.changeLanguage,
  };
}
