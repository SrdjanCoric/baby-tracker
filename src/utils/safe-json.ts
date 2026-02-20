import AsyncStorage from "@react-native-async-storage/async-storage";

export function safeParseArray<T>(data: string, context?: string): T[] {
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.warn(
        `[SafeJSON] Expected array but got ${typeof parsed}${context ? ` in ${context}` : ""}. Returning empty array.`
      );
      return [];
    }
    return parsed as T[];
  } catch (error) {
    console.warn(
      `[SafeJSON] Failed to parse JSON array${context ? ` in ${context}` : ""}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    return [];
  }
}

export function safeParseObject<T>(data: string, context?: string): T | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn(
        `[SafeJSON] Expected object but got ${Array.isArray(parsed) ? "array" : typeof parsed}${context ? ` in ${context}` : ""}. Returning null.`
      );
      return null;
    }
    return parsed as T;
  } catch (error) {
    console.warn(
      `[SafeJSON] Failed to parse JSON object${context ? ` in ${context}` : ""}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
    return null;
  }
}

export async function safeGetArray<T>(key: string, context?: string): Promise<T[]> {
  const data = await AsyncStorage.getItem(key);
  if (!data) return [];
  return safeParseArray<T>(data, context ?? key);
}

export async function safeGetObject<T>(key: string, context?: string): Promise<T | null> {
  const data = await AsyncStorage.getItem(key);
  if (!data) return null;
  return safeParseObject<T>(data, context ?? key);
}
