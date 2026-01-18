# Baby Tracker

A privacy-first, ad-free baby tracking app for iOS and Android with Apple Watch support, home screen widgets, and real-time multi-caregiver sync (coming soon).

## Tech Stack

- **Framework:** React Native with Expo (SDK 54)
- **Language:** TypeScript (strict mode)
- **Styling:** NativeWind v4 (Tailwind CSS for React Native)
- **Navigation:** Expo Router v6
- **State Management:** React Context + AsyncStorage
- **Internationalization:** i18next with expo-localization
- **Testing:** Vitest for unit tests

## Prerequisites

- Node.js 20+
- npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator

## Installation

```bash
# Clone the repository
git clone https://github.com/SrdjanCoric/baby-tracker.git
cd baby-tracker

# Install dependencies
npm install

# Start the development server
npx expo start
```

## Running the App

```bash
# Start Expo development server
npm start

# Run on iOS Simulator
npm run ios

# Run on Android Emulator
npm run android
```

You can also scan the QR code with Expo Go app on your physical device.

## Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit:watch

# Type check
npm run typecheck

# Lint
npm run lint
```

## Project Structure

```
baby-tracker/
├── app/                    # Expo Router screens and navigation
│   ├── (tabs)/            # Tab navigation screens (home, timeline, stats, profile)
│   ├── baby/              # Baby profile screens
│   ├── feeding/           # Feeding tracking screens
│   ├── sleep/             # Sleep tracking screens
│   ├── diaper/            # Diaper tracking screens
│   └── pumping/           # Pumping tracking screens
├── src/
│   ├── components/        # Reusable UI components
│   ├── constants/         # App constants and configuration
│   ├── contexts/          # React Context providers
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Internationalization setup
│   ├── services/          # Storage and API services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── validators/        # Input validation functions
├── plans/                  # Implementation plans and documentation
└── .github/workflows/      # CI/CD configuration
```

## Development Approach

This project follows **Test-Driven Development (TDD)**:

1. Write failing tests that define expected behavior
2. Implement minimum code to make tests pass
3. Refactor while keeping tests green

Each feature is developed on a separate branch and merged to main when complete.

## Current Features

- Baby profile management (add, edit, switch between babies)
- Breastfeeding tracking with timer and side memory
- Bottle feeding with volume tracking (ml/oz)
- Solid food tracking with reaction logging
- Sleep tracking with nap/night auto-detection
- Diaper tracking with stool color selection
- Pumping tracking with timer and volume
- Manual entry for all activities (log past events)
- Dark mode support

## Coming Soon

- Multi-caregiver sync (Supabase + PowerSync)
- Growth tracking and charts
- Tummy time with daily goals
- Statistics and trends
- Apple Watch app
- Home screen widgets
- Data export

## License

Private - All rights reserved
