export const AUTH_CONFIG = {
  OAUTH_REDIRECT_URI: "babytracker://auth/callback",
  MIN_PASSWORD_LENGTH: 8,
  SESSION_PERSIST_KEY: "supabase.auth.token",
} as const;
