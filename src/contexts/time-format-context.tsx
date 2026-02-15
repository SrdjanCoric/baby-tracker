import React, { createContext, useContext, useEffect, useCallback, useState } from "react";
import { TimeFormatStorageService } from "@/services/time-format-storage";
import type { TimeFormat } from "@/utils/time";

export type { TimeFormat };

interface TimeFormatContextValue {
  timeFormat: TimeFormat;
  isLoading: boolean;
  setTimeFormat: (format: TimeFormat) => Promise<void>;
}

const TimeFormatContext = createContext<TimeFormatContextValue | null>(null);

export function TimeFormatProvider({ children }: { children: React.ReactNode }) {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>("12h");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreference = async () => {
      const stored = await TimeFormatStorageService.getTimeFormat();
      setTimeFormatState(stored);
      setIsLoading(false);
    };
    loadPreference();
  }, []);

  const handleSetTimeFormat = useCallback(async (newFormat: TimeFormat) => {
    await TimeFormatStorageService.setTimeFormat(newFormat);
    setTimeFormatState(newFormat);
  }, []);

  const value: TimeFormatContextValue = {
    timeFormat,
    isLoading,
    setTimeFormat: handleSetTimeFormat,
  };

  return <TimeFormatContext.Provider value={value}>{children}</TimeFormatContext.Provider>;
}

export function useTimeFormat(): TimeFormatContextValue {
  const context = useContext(TimeFormatContext);
  if (!context) {
    throw new Error("useTimeFormat must be used within a TimeFormatProvider");
  }
  return context;
}
