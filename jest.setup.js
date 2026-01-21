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
        "settings.units": "Units",
        "settings.metric": "Metric (kg, cm, ml)",
        "settings.imperial": "Imperial (lbs, in, oz)",
        "settings.about": "About",
        "settings.version": "Version",
        "settings.privacyPolicy": "Privacy Policy",
        "settings.notifications": "Notifications",
        "settings.export": "Export Data",
        "baby.title": "Baby",
        "household.title": "Household",
        "household.joinHousehold": "Join Household",
        "household.joinHouseholdDescription": "Enter the invite code shared by another caregiver",
        "household.enterInviteCode": "Enter invite code",
        "household.inviteCodePlaceholder": "XXXX-XXXX",
        "household.join": "Join",
        "household.joining": "Joining household...",
        "household.joinSuccess": "Successfully joined household!",
        "household.inviteCodeRequired": "Please enter an invite code",
        "household.inviteCodeLength": "Invite code must be 8 characters",
        "household.inviteCodeInvalidChars": "Invalid characters in code",
        "household.householdNotFound": "Household not found",
        "household.alreadyInHousehold": "You already belong to a household with other members",
        "household.joinFailed": "Could not join household",
        "household.signInRequired": "Sign in to use Household",
        "household.signInRequiredDescription": "Create an account to share baby tracking with other caregivers and sync across devices",
        "common.ok": "OK",
        "common.success": "Success",
        "errors.generic": "Something went wrong",
        "auth.signIn": "Sign In",
        "auth.passwordRequirements": "At least 8 characters with uppercase, lowercase, and a number",
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

jest.mock("@/contexts/unit-context", () => ({
  useUnits: () => ({
    unitSystem: "metric",
    weightUnit: "kg",
    heightUnit: "cm",
    volumeUnit: "ml",
    isLoading: false,
    setUnitSystem: jest.fn(),
  }),
  UnitProvider: ({ children }) => children,
}));

global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
