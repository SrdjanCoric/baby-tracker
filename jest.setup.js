jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("nativewind", () => ({
  useColorScheme: () => ({
    colorScheme: "light",
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({}),
  usePathname: () => "/",
  Link: ({ children }) => children,
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => {
      const translations = {
        "common.back": "Back",
        "settings.appearance": "Appearance",
        "settings.theme": "Theme",
        "settings.systemDefault": "System Default",
        "settings.systemDefaultDesc": "Follow system setting",
        "settings.lightMode": "Light Mode",
        "settings.lightModeDesc": "Always use light theme",
        "settings.darkMode": "Dark Mode",
        "settings.darkModeDesc": "Always use dark theme",
        "settings.nightMode": "Night Mode",
        "settings.nightModeDesc": "Dim red light for nighttime",
        "settings.currentlyUsing": `Currently using: light`,
      };
      return translations[key] || key;
    },
    i18n: {
      language: "en",
      changeLanguage: jest.fn(),
    },
  }),
  Trans: ({ children }) => children,
  initReactI18next: {
    type: "3rdParty",
    init: jest.fn(),
  },
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
