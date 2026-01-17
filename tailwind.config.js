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
      colors: {
        // ============================================
        // ACTIVITY COLORS - Each activity has personality
        // ============================================
        activity: {
          // Sleep - Dreamy lavender purple
          sleep: {
            light: "#6B5B95",
            DEFAULT: "#6B5B95",
            dark: "#8B7BB5",
            muted: "#E8E4F0",
            "muted-dark": "#2D2640",
          },
          // Feeding - Fresh sage green
          feeding: {
            light: "#88B04B",
            DEFAULT: "#88B04B",
            dark: "#A8D06B",
            muted: "#E8F0E0",
            "muted-dark": "#263320",
          },
          // Diaper - Soft peachy pink
          diaper: {
            light: "#F7CAC9",
            DEFAULT: "#E8A5A3",
            dark: "#FFD4D3",
            muted: "#FDF0EF",
            "muted-dark": "#3D2828",
          },
          // Pumping - Calm sky blue
          pumping: {
            light: "#92A8D1",
            DEFAULT: "#92A8D1",
            dark: "#B2C8F1",
            muted: "#E8EDF5",
            "muted-dark": "#252D3D",
          },
          // Growth - Vibrant teal
          growth: {
            light: "#009B77",
            DEFAULT: "#009B77",
            dark: "#20BB97",
            muted: "#E0F5EF",
            "muted-dark": "#1A3330",
          },
          // Tummy Time - Warm orange/amber
          tummyTime: {
            light: "#E67E22",
            DEFAULT: "#E67E22",
            dark: "#F39C12",
            muted: "#FEF3E2",
            "muted-dark": "#3D2E1A",
          },
        },

        // ============================================
        // SEMANTIC COLORS - Light Mode
        // ============================================
        surface: {
          // Main background - warm off-white
          DEFAULT: "#FAFAFA",
          secondary: "#F5F5F5",
          // Card backgrounds
          card: "#FFFFFF",
          "card-elevated": "#FFFFFF",
        },

        // Text colors
        content: {
          primary: "#1A1A1A",
          secondary: "#6B6B6B",
          tertiary: "#9CA3AF",
          inverse: "#FFFFFF",
        },

        // Primary action - calming forest green
        action: {
          primary: "#2E7D32",
          "primary-hover": "#256029",
          "primary-pressed": "#1B4D1E",
        },

        // ============================================
        // DARK MODE COLORS
        // ============================================
        "surface-dark": {
          DEFAULT: "#121212",
          secondary: "#1A1A1A",
          card: "#1E1E1E",
          "card-elevated": "#252525",
        },

        "content-dark": {
          primary: "#FFFFFF",
          secondary: "#A0A0A0",
          tertiary: "#6B6B6B",
          inverse: "#1A1A1A",
        },

        "action-dark": {
          primary: "#81C784",
          "primary-hover": "#A5D6A7",
          "primary-pressed": "#66BB6A",
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
        "glow-sleep": "0 0 20px rgba(107, 91, 149, 0.3)",
        "glow-feeding": "0 0 20px rgba(136, 176, 75, 0.3)",
        "glow-diaper": "0 0 20px rgba(232, 165, 163, 0.3)",
      },
    },
  },
  plugins: [],
};
