/** @type {import('tailwindcss').Config} */
const { SURFACE, TEXT, ACTION, BORDER, ACTIVITY } = require("./src/constants/colors.js");

module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito-Regular', 'System'],
        'sans-medium': ['Nunito-Medium', 'System'],
        'sans-semibold': ['Nunito-SemiBold', 'System'],
        'sans-bold': ['Nunito-Bold', 'System'],
      },
      colors: {
        activity: {
          feeding: {
            light: ACTIVITY.feeding.accent,
            DEFAULT: ACTIVITY.feeding.accent,
            dark: ACTIVITY.feeding.accentDark,
            muted: ACTIVITY.feeding.muted,
            "muted-dark": ACTIVITY.feeding.mutedDark,
          },
          sleep: {
            light: ACTIVITY.sleep.accent,
            DEFAULT: ACTIVITY.sleep.accent,
            dark: ACTIVITY.sleep.accentDark,
            muted: ACTIVITY.sleep.muted,
            "muted-dark": ACTIVITY.sleep.mutedDark,
          },
          diaper: {
            light: ACTIVITY.diaper.accent,
            DEFAULT: ACTIVITY.diaper.accent,
            dark: ACTIVITY.diaper.accentDark,
            muted: ACTIVITY.diaper.muted,
            "muted-dark": ACTIVITY.diaper.mutedDark,
          },
          pumping: {
            light: ACTIVITY.pumping.accent,
            DEFAULT: ACTIVITY.pumping.accent,
            dark: ACTIVITY.pumping.accentDark,
            muted: ACTIVITY.pumping.muted,
            "muted-dark": ACTIVITY.pumping.mutedDark,
          },
          growth: {
            light: ACTIVITY.growth.accent,
            DEFAULT: ACTIVITY.growth.accent,
            dark: ACTIVITY.growth.accentDark,
            muted: ACTIVITY.growth.muted,
            "muted-dark": ACTIVITY.growth.mutedDark,
          },
          tummyTime: {
            light: ACTIVITY.tummyTime.accent,
            DEFAULT: ACTIVITY.tummyTime.accent,
            dark: ACTIVITY.tummyTime.accentDark,
            muted: ACTIVITY.tummyTime.muted,
            "muted-dark": ACTIVITY.tummyTime.mutedDark,
          },
        },

        surface: {
          DEFAULT: SURFACE.light.background,
          secondary: SURFACE.light.secondary,
          card: SURFACE.light.card,
          "card-elevated": SURFACE.light.cardElevated,
          muted: SURFACE.light.muted,
          input: SURFACE.light.input,
        },

        content: {
          primary: TEXT.light.primary,
          secondary: TEXT.light.secondary,
          tertiary: TEXT.light.tertiary,
          inverse: TEXT.light.inverse,
          muted: TEXT.light.muted,
        },

        action: {
          primary: ACTION.light.primary,
          "primary-hover": ACTION.light.primaryHover,
          "primary-pressed": ACTION.light.primaryPressed,
        },

        "surface-dark": {
          DEFAULT: SURFACE.dark.background,
          secondary: SURFACE.dark.secondary,
          card: SURFACE.dark.card,
          "card-elevated": SURFACE.dark.cardElevated,
          muted: SURFACE.dark.muted,
          input: SURFACE.dark.input,
        },

        "content-dark": {
          primary: TEXT.dark.primary,
          secondary: TEXT.dark.secondary,
          tertiary: TEXT.dark.tertiary,
          inverse: TEXT.dark.inverse,
          muted: TEXT.dark.muted,
        },

        "action-dark": {
          primary: ACTION.dark.primary,
          "primary-hover": ACTION.dark.primaryHover,
          "primary-pressed": ACTION.dark.primaryPressed,
        },

        "primary-dark": ACTION.dark.primary,

        border: {
          DEFAULT: BORDER.light.default,
          subtle: BORDER.light.subtle,
          strong: BORDER.light.strong,
        },

        "border-dark": {
          DEFAULT: BORDER.dark.default,
          subtle: BORDER.dark.subtle,
          strong: BORDER.dark.strong,
        },

        primary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        night: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          bg: "#1a0a0a",
          surface: "#2d1515",
          text: "#fca5a5",
        },
      },
      fontSize: {
        "timer-xl": ["3.5rem", { lineHeight: "1", fontWeight: "700" }],
        timer: ["3rem", { lineHeight: "1", fontWeight: "600" }],
        "timer-sm": ["2rem", { lineHeight: "1", fontWeight: "600" }],
        stat: ["2rem", { lineHeight: "1.2", fontWeight: "600" }],
        "stat-sm": ["1.5rem", { lineHeight: "1.2", fontWeight: "600" }],
        "time-since": ["1.75rem", { lineHeight: "1.2", fontWeight: "700" }],
        "activity-label": ["0.75rem", { lineHeight: "1", fontWeight: "600", letterSpacing: "0.05em" }],
      },
      spacing: {
        touch: "44px",
        "touch-lg": "60px",
        "touch-xl": "72px",
      },
      borderRadius: {
        "card": "20px",
        "card-lg": "24px",
        "button": "16px",
        "button-lg": "20px",
        "pill": "9999px",
      },
      boxShadow: {
        "card": "0 2px 8px rgba(45, 35, 30, 0.06)",
        "card-elevated": "0 4px 16px rgba(45, 35, 30, 0.10)",
        "card-pressed": "0 1px 4px rgba(45, 35, 30, 0.06)",
        "soft": "0 4px 20px rgba(45, 35, 30, 0.08)",
        "card-dark": "0 2px 12px rgba(0, 0, 0, 0.35)",
        "card-elevated-dark": "0 4px 20px rgba(0, 0, 0, 0.45)",
        "card-pressed-dark": "0 1px 6px rgba(0, 0, 0, 0.30)",
        "glow-brand": "0 0 24px rgba(249, 168, 117, 0.15)",
        "glow-brand-strong": "0 0 32px rgba(249, 168, 117, 0.25)",
        "glow-feeding": "0 0 20px rgba(140, 179, 105, 0.25)",
        "glow-sleep": "0 0 20px rgba(158, 141, 169, 0.25)",
        "glow-diaper": "0 0 20px rgba(224, 160, 153, 0.25)",
        "glow-pumping": "0 0 20px rgba(123, 163, 168, 0.25)",
        "glow-growth": "0 0 20px rgba(106, 171, 156, 0.25)",
        "glow-tummyTime": "0 0 20px rgba(212, 165, 116, 0.25)",
        "glow-feeding-dark": "0 0 24px rgba(165, 200, 138, 0.30)",
        "glow-sleep-dark": "0 0 24px rgba(181, 167, 189, 0.30)",
        "glow-diaper-dark": "0 0 24px rgba(234, 184, 178, 0.30)",
        "glow-pumping-dark": "0 0 24px rgba(150, 184, 188, 0.30)",
        "glow-growth-dark": "0 0 24px rgba(136, 190, 176, 0.30)",
        "glow-tummyTime-dark": "0 0 24px rgba(224, 185, 144, 0.30)",
      },
    },
  },
  plugins: [],
};
