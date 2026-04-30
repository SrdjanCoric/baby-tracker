jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@powersync/react-native", () => ({
  PowerSyncDatabase: jest.fn(),
  Schema: jest.fn(),
  Table: jest.fn(),
  column: {
    text: "TEXT",
    integer: "INTEGER",
    real: "REAL",
  },
}));

jest.mock("@/services/sync", () => ({
  SyncEngine: jest.fn(),
  SyncQueue: jest.fn(),
  ConflictResolver: jest.fn(),
}));

jest.mock("@/contexts/sync-context", () => ({
  useSync: () => ({
    status: "online",
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
    isConnected: true,
    forceSync: jest.fn(),
    retryFailedSync: jest.fn(),
  }),
  SyncProvider: ({ children }) => children,
}));

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  }),
  AuthProvider: ({ children }) => children,
}));

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
    t: (key, options) => {
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
        "summary.today": "Today",
        "summary.sleep": "Sleep",
        "errorFallback.title": "Something went wrong",
        "errorFallback.message": "We're sorry for the inconvenience. Please try again.",
        "errorFallback.tryAgain": "Try Again",
        "accessibility.breastfeeding": "Breastfeeding",
        "accessibility.pumping": "Pumping",
        "accessibility.tummyTime": "Tummy time",
        "accessibility.diaper": "Diaper change",
        "accessibility.timerStarted": "{{activity}} timer started",
        "accessibility.timerStoppedNoDuration": "{{activity}} timer stopped",
        "accessibility.timerStoppedDuration": "{{activity}} timer stopped. Duration: {{duration}}",
        "accessibility.savedSuccessfully": "{{activity}} saved successfully",
        "accessibility.errorGeneric": "An error occurred. Please try again.",
        "accessibility.errorWithContext": "Error {{context}}. Please try again.",
        "accessibility.hour_one": "1 hour",
        "accessibility.hour_other": "{{count}} hours",
        "accessibility.minute_one": "1 minute",
        "accessibility.minute_other": "{{count}} minutes",
        "accessibility.second_one": "1 second",
        "accessibility.second_other": "{{count}} seconds",
        "accessibility.zeroSeconds": "0 seconds",
        "notificationMessages.feedingTimerTitle": "Feeding Timer",
        "notificationMessages.pumpingTimerTitle": "Pumping Timer",
        "notificationMessages.tummyTimeTimerTitle": "Tummy Time",
        "notificationMessages.napTimerTitle": "Nap Timer",
        "notificationMessages.nightSleepTimerTitle": "Sleep Timer",
      };
      // Handle pluralization for summary keys
      if (key === "summary.feeding") {
        return options?.count === 1 ? "Feeding" : "Feedings";
      }
      if (key === "summary.nap") {
        return options?.count === 1 ? "Nap" : "Naps";
      }
      if (key === "summary.diaper") {
        return options?.count === 1 ? "Diaper" : "Diapers";
      }
      // Handle pluralization for i18next style keys (without _one/_other suffix)
      if (options?.count !== undefined) {
        const count = options.count;
        const pluralKey = count === 1 ? `${key}_one` : `${key}_other`;
        let result = translations[pluralKey] || translations[key] || key;
        // Replace count placeholder
        result = result.replace("{{count}}", String(count));
        // Replace other template variables
        Object.entries(options).forEach(([optKey, optValue]) => {
          if (optKey !== "count") {
            result = result.replace(`{{${optKey}}}`, String(optValue));
          }
        });
        return result;
      }
      // Handle template replacements
      if (typeof translations[key] === "string" && options) {
        let result = translations[key];
        Object.entries(options).forEach(([optKey, optValue]) => {
          result = result.replace(`{{${optKey}}}`, String(optValue));
        });
        return result;
      }
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
