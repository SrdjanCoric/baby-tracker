module.exports = {
  preset: "jest-expo",
  testMatch: [
    "**/*.component.test.tsx",
    "**/*.integration.test.tsx",
  ],
  setupFilesAfterEnv: ["./jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-reanimated)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@screens/(.*)$": "<rootDir>/src/screens/$1",
    "^@navigation/(.*)$": "<rootDir>/src/navigation/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@constants/(.*)$": "<rootDir>/src/constants/$1",
    "^@contexts/(.*)$": "<rootDir>/src/contexts/$1",
    "^@validators/(.*)$": "<rootDir>/src/validators/$1",
    "^@i18n/(.*)$": "<rootDir>/src/i18n/$1",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "app/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
};
