import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TimeFormat } from "@/utils/time";

const TIME_FORMAT_KEY = "@time_format";
const DEFAULT_TIME_FORMAT: TimeFormat = "12h";
const VALID_FORMATS: TimeFormat[] = ["12h", "24h"];

function isValidTimeFormat(value: string): value is TimeFormat {
  return VALID_FORMATS.includes(value as TimeFormat);
}

export const TimeFormatStorageService = {
  async getTimeFormat(): Promise<TimeFormat> {
    const stored = await AsyncStorage.getItem(TIME_FORMAT_KEY);
    if (stored && isValidTimeFormat(stored)) {
      return stored;
    }
    return DEFAULT_TIME_FORMAT;
  },

  async setTimeFormat(format: TimeFormat): Promise<void> {
    await AsyncStorage.setItem(TIME_FORMAT_KEY, format);
  },

  async clearTimeFormat(): Promise<void> {
    await AsyncStorage.removeItem(TIME_FORMAT_KEY);
  },
};
