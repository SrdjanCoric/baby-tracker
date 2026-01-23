/** @type {import('tailwindcss').Config} */
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
        // ============================================
        // ACTIVITY COLORS - Soft warm pastels
        // ============================================
        activity: {
          // Feeding - Warm sage (nurturing)
          feeding: {
            light: "#8CB369",
            DEFAULT: "#8CB369",
            dark: "#A5C88A",
            muted: "#EEF4E9",
            "muted-dark": "#2A3325",
          },
          // Sleep - Dusty mauve (calming)
          sleep: {
            light: "#9E8DA9",
            DEFAULT: "#9E8DA9",
            dark: "#B5A7BD",
            muted: "#F2EFF4",
            "muted-dark": "#2A2630",
          },
          // Diaper - Dusty rose (soft alert)
          diaper: {
            light: "#E0A099",
            DEFAULT: "#E0A099",
            dark: "#EAB8B2",
            muted: "#FBF0EE",
            "muted-dark": "#382926",
          },
          // Pumping - Warm teal (calm focus)
          pumping: {
            light: "#7BA3A8",
            DEFAULT: "#7BA3A8",
            dark: "#96B8BC",
            muted: "#EDF3F4",
            "muted-dark": "#252E30",
          },
          // Growth - Sage teal (progress)
          growth: {
            light: "#6AAB9C",
            DEFAULT: "#6AAB9C",
            dark: "#88BEB0",
            muted: "#EBF4F2",
            "muted-dark": "#243330",
          },
          // Tummy Time - Warm honey (active)
          tummyTime: {
            light: "#D4A574",
            DEFAULT: "#D4A574",
            dark: "#E0B990",
            muted: "#F9F2EA",
            "muted-dark": "#332B22",
          },
        },

        // ============================================
        // SEMANTIC COLORS - Light Mode (Warm undertones)
        // ============================================
        surface: {
          // Main background - warm off-white
          DEFAULT: "#FAFAF8",
          secondary: "#F5F3F0",
          // Card backgrounds
          card: "#FFFFFF",
          "card-elevated": "#FFFFFF",
        },

        // Text colors - warm grays
        content: {
          primary: "#2D2A26",
          secondary: "#6B665E",
          tertiary: "#8A857D",
          inverse: "#FFFFFF",
        },

        // Primary action - warm sage green
        action: {
          primary: "#6B9E6E",
          "primary-hover": "#5A8A5D",
          "primary-pressed": "#4A754C",
        },

        // ============================================
        // DARK MODE COLORS (Warm undertones)
        // ============================================
        "surface-dark": {
          DEFAULT: "#1A1918",
          secondary: "#1F1E1C",
          card: "#242220",
          "card-elevated": "#2A2826",
        },

        "content-dark": {
          primary: "#FAF9F7",
          secondary: "#B5B0A8",
          tertiary: "#7A756D",
          inverse: "#2D2A26",
        },

        "action-dark": {
          primary: "#8FC091",
          "primary-hover": "#A0CDA2",
          "primary-pressed": "#7EB080",
        },

        // Primary dark mode color (matches action-dark.primary)
        "primary-dark": "#8FC091",

        // Border colors for light mode - warm tones
        border: {
          DEFAULT: "#E8E5E0",
          subtle: "#F0EDE8",
        },

        // Border colors for dark mode - warm tones
        "border-dark": {
          DEFAULT: "#3D3935",
          subtle: "#4A463F",
        },

        // ============================================
        // LEGACY COLORS (keeping for compatibility)
        // ============================================
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
        // Timer - Extra large for at-a-glance reading
        "timer-xl": ["3.5rem", { lineHeight: "1", fontWeight: "700" }],
        timer: ["3rem", { lineHeight: "1", fontWeight: "600" }],
        "timer-sm": ["2rem", { lineHeight: "1", fontWeight: "600" }],
        // Stats
        stat: ["2rem", { lineHeight: "1.2", fontWeight: "600" }],
        "stat-sm": ["1.5rem", { lineHeight: "1.2", fontWeight: "600" }],
        // Time since display
        "time-since": ["1.75rem", { lineHeight: "1.2", fontWeight: "700" }],
        // Activity labels
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
        "card": "0 2px 8px rgba(0, 0, 0, 0.08)",
        "card-elevated": "0 4px 16px rgba(0, 0, 0, 0.12)",
        "card-pressed": "0 1px 4px rgba(0, 0, 0, 0.08)",
        "glow-feeding": "0 0 20px rgba(140, 179, 105, 0.3)",
        "glow-sleep": "0 0 20px rgba(158, 141, 169, 0.3)",
        "glow-diaper": "0 0 20px rgba(224, 160, 153, 0.3)",
        "glow-pumping": "0 0 20px rgba(123, 163, 168, 0.3)",
        "glow-growth": "0 0 20px rgba(106, 171, 156, 0.3)",
        "glow-tummyTime": "0 0 20px rgba(212, 165, 116, 0.3)",
      },
    },
  },
  plugins: [],
};
