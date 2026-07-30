# Display name prompt during authentication

The sign-in screen owns `DisplayNamePrompt`. It collects a missing name before onboarding resumes or navigation leaves authentication.

## Navigation contract

`AuthGuard` may route a completed onboarding state from `/auth` to Home only when `user.displayName` exists. Without a display name, the guard leaves the sign-in screen mounted so its modal can render.

The sign-in screen serializes post-auth work. After the name is saved, it resumes the persisted onboarding intent:

- returning users continue account restoration
- invited caregivers return to code confirmation or interrupted-join recovery
- owners with an existing baby complete onboarding
- owners without a baby continue to required baby setup

Authentication cancellation calls `cancelAuthentication()` and returns to the named state that opened sign-in. There is no separate onboarding auto-advance effect.

## Why the prompt stays on sign-in

Rendering a React Native modal while its screen is unmounting can leave an invisible modal that still intercepts touches. Keeping the prompt on the sign-in screen avoids a navigation race and gives auth completion one owner.

Use refs for delayed or asynchronous auth callbacks that need the latest user value. Do not add another root-level display-name modal or a second post-auth navigation branch.

## Regression test

`app/auth/sign-in.component.test.tsx` covers missing names for returning users, invited caregivers, and authenticated owner setup. It also verifies cancellation and serialized auth completion.
