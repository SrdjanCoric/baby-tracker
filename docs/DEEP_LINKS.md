# Deep links

SofiBaby uses the `sofibaby` URL scheme. Supabase authentication must allow this callback URL:

```text
sofibaby://login-callback/
```

The scheme and callback route are configured in `app.json` and `app/login-callback.tsx`. Add the same URL as the Supabase Site URL or an allowed Redirect URL. A bare `sofibaby://` value is not sufficient because Supabase requires a hostname.

## Authentication callbacks

Before authentication starts, onboarding saves its intent and current named state. The callback exchanges the session, loads the saved state, and returns to the matching production route:

- returning users resume household and baby restoration
- invited caregivers return to invitation confirmation or join recovery
- owners return to existing-account Home or complete baby setup

The callback opens Home after onboarding creates a baby or obtains one through joining or restoration. Legacy completed and skipped installations remain the compatibility exception.

## Timer action links

Live Activity and widget actions use the root scheme with an action query:

```text
sofibaby://?action=pause
sofibaby://?action=resume
sofibaby://?action=stop
```

`app/_layout.tsx` validates and queues these commands for the matching local timer. Authentication callback links use `/login-callback/` and do not share the timer-action path.

## Testing

Open an authentication callback on an installed simulator only with disposable test credentials. The onboarding auth-cancellation and returning-restoration Maestro flows cover callback-adjacent routing without requiring a real email link:

```bash
maestro test e2e/flows/onboarding/auth-cancellation.yaml
maestro test e2e/flows/onboarding/returning-user-restoration.yaml
```
