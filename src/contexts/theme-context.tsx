import React, { createContext, useContext, useEffect, useCallback, useMemo, useState } from "react";
import { useColorScheme } from "nativewind";
import { ThemeStorageService } from "@/services/theme-storage";
import { resolveThemeMode, type ThemePreference, type ThemeMode } from "@/utils/theme";

export {
  type ThemePreference,
  type ThemeMode,
};

// Re-export for tests
export { themeReducer, initialThemeState, type ThemeState, type ThemeAction } from "./theme-reducer";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedMode: ThemeMode;
  isDark: boolean;
  isLoading: boolean;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [isLoading, setIsLoading] = useState(true);

  // Load stored preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      const storedPreference = await ThemeStorageService.getThemePreference();
      setPreference(storedPreference);

      // Apply the theme
      if (storedPreference === "system") {
        setColorScheme("system");
      } else {
        setColorScheme(storedPreference);
      }

      setIsLoading(false);
    };
    loadPreference();
  }, [setColorScheme]);

  const handleSetThemePreference = useCallback(async (newPreference: ThemePreference) => {
    await ThemeStorageService.setThemePreference(newPreference);
    setPreference(newPreference);

    // Apply the theme via NativeWind
    if (newPreference === "system") {
      setColorScheme("system");
    } else {
      setColorScheme(newPreference);
    }
  }, [setColorScheme]);

  const systemColorScheme = colorScheme === "dark" ? "dark" : "light";
  const resolvedMode = resolveThemeMode(preference, systemColorScheme);

  const isDark = resolvedMode === "dark";

  const value: ThemeContextValue = useMemo(() => ({
    preference,
    resolvedMode,
    isDark,
    isLoading,
    setThemePreference: handleSetThemePreference,
  }), [preference, resolvedMode, isDark, isLoading, handleSetThemePreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
