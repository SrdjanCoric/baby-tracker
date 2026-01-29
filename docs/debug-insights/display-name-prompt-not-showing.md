# DisplayNamePrompt Modal Not Showing After Authentication

## Problem

After a user signed in (via Google, Apple, or any OAuth provider), the `DisplayNamePrompt` modal was supposed to appear if the user had no `displayName` set. However, the modal was not rendering - the app became unresponsive with touches not registering, but no visible modal.

## Root Cause

The issue was a **navigation timing conflict**. Multiple components were racing to handle the post-authentication flow:

### 1. AuthGuard Navigation Race

In `app/_layout.tsx`, the `AuthGuard` component had this logic:

```typescript
if (isAuthenticated && inAuthGroup && hasCompletedOnboarding) {
  router.replace("/(tabs)");
}
```

As soon as `isAuthenticated` became `true`, AuthGuard would navigate away from the sign-in screen to the tabs. This unmounted the sign-in screen before the `DisplayNamePrompt` modal could render.

### 2. Onboarding Auto-Advance Race

In `app/onboarding/auth-choice.tsx`, there was similar auto-navigation:

```typescript
useEffect(() => {
  if (isAuthenticated && !hasAdvancedRef.current) {
    hasAdvancedRef.current = true;
    nextStep();
    router.push("/onboarding/features");
  }
}, [isAuthenticated, nextStep, router]);
```

This would navigate to the next onboarding step immediately after authentication, again unmounting the sign-in screen.

### 3. Modal Rendering During Navigation Transition

React Native's `Modal` component has issues when it tries to render during a navigation transition. Even though `visible={true}` was set, the modal would be "invisible" - blocking touches but not rendering any content.

## Solution

### 1. AuthGuard: Wait for displayName

Modified AuthGuard to only navigate away if the user has a `displayName`:

```typescript
if (isAuthenticated && inAuthGroup && hasCompletedOnboarding) {
  if (user?.displayName) {
    router.replace("/(tabs)");
  }
  // If no displayName, stay on auth screen - sign-in.tsx will show DisplayNamePrompt
}
```

### 2. Onboarding: Wait for displayName

Modified the auto-advance effect to also check for `displayName`:

```typescript
useEffect(() => {
  if (isAuthenticated && user?.displayName && !hasAdvancedRef.current) {
    hasAdvancedRef.current = true;
    nextStep();
    router.push("/onboarding/features");
  }
}, [isAuthenticated, user?.displayName, nextStep, router]);
```

### 3. Show Modal on Sign-In Screen

Instead of showing `DisplayNamePrompt` after navigation (in `_layout.tsx`), we show it directly on the sign-in screen before any navigation occurs:

```typescript
// sign-in.tsx
const handlePostAuth = useCallback(() => {
  setTimeout(() => {
    const currentUser = userRef.current;
    if (!currentUser?.displayName) {
      setShowDisplayNamePrompt(true);  // Show modal on current screen
    } else {
      router.back();  // Only navigate if displayName exists
    }
  }, 500);
}, [router]);
```

## Key Takeaways

1. **Avoid showing modals during navigation transitions** - React Native's Modal can become invisible but still block touches.

2. **Use refs for async callbacks** - When checking user state in a delayed callback, use a ref to get the latest value instead of relying on closure capture.

3. **Coordinate navigation guards** - When multiple components can trigger navigation based on auth state, ensure they all check the same conditions to avoid races.

4. **Show prompts before navigation, not after** - If you need user input after authentication, collect it before navigating away from the auth screen.
