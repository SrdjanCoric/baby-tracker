import type { TFunction } from "i18next";

export function translateErrors(
  errors: Record<string, string>,
  t: TFunction
): Record<string, string> {
  const translated: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    translated[key] = t(value, { defaultValue: value });
  }
  return translated;
}

export function te(t: TFunction, key: string): string {
  return t(key, { defaultValue: key });
}
