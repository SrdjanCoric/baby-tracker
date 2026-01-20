import React, { createContext, useContext, useEffect, useCallback, useState } from "react";
import { useColorScheme } from "nativewind";
import { ThemeStorageService } from "@/services/theme-storage";
import { resolveThemeMode, isNightModeEnabled, type ThemePreference, type ThemeMode } from "@/utils/theme";

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
  isNight: boolean;
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
      // Night mode uses dark color scheme as the base
      if (storedPreference === "system") {
        setColorScheme("system");
      } else if (storedPreference === "night") {
        setColorScheme("dark");
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
    // Night mode uses dark color scheme as the base
    if (newPreference === "system") {
      setColorScheme("system");
    } else if (newPreference === "night") {
      setColorScheme("dark");
    } else {
      setColorScheme(newPreference);
    }
  }, [setColorScheme]);

  const systemColorScheme = colorScheme === "dark" ? "dark" : "light";
  const resolvedMode = resolveThemeMode(preference, systemColorScheme);

  const value: ThemeContextValue = {
    preference,
    resolvedMode,
    isDark: resolvedMode === "dark" || resolvedMode === "night",
    isNight: isNightModeEnabled(resolvedMode),
    isLoading,
    setThemePreference: handleSetThemePreference,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
