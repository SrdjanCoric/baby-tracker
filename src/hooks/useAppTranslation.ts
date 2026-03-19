import { useCallback } from "react";
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

  const tDynamic = useCallback(
    (key: string, options?: Record<string, unknown>): string => {
      return t(key, { ...options, defaultValue: key });
    },
    [t]
  );

  return {
    t: t as (key: TranslationKey, options?: Record<string, unknown>) => string,
    tDynamic,
    i18n,
    currentLanguage: i18n.language,
    changeLanguage: i18n.changeLanguage,
  };
}
