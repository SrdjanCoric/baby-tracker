# NativeWind dark: className Variant Crashes Modal Screen

## Symptom

The milestones screen (`app/milestones/index.tsx`) crashes with "Couldn't find a navigation context" on iOS. The screen opens but crashes after a few renders. The error points to a `<Pressable>` inside an `AGE_GROUPS.map()` callback.

## Misleading Signals

- The error message ("Couldn't find a navigation context. Have you wrapped your app with 'NavigationContainer'?") suggests a missing NavigationContainer or incorrect route setup.
- The error stack initially pointed to `useTranslation()` at the top of the component, making it look like a hook issue.
- The `_layout.tsx` file was suspected (tried `Stack`, `Slot`, matching working layouts exactly) — none of these changes helped.
- Adding `useRouter()` to the component had no effect.

## Debugging Process

1. **Added per-hook logging** — discovered ALL hooks (`useTranslation`, `useColorScheme`, `useBaby`, `useMilestones`) succeed on every render, including the crashing render.

2. **Added render counter + JSX logging** — the screen renders 4-5 times successfully. The error occurs on the final render DURING JSX rendering (after hooks complete), specifically at a `<Pressable className="...dark:bg-surface-dark-card...">`.

3. **Checked navigation context explicitly** — added `useNavigationState()` as a probe. It returned `navContext: true` on ALL renders including the one that crashes. The navigation context IS available at hook time.

4. **Narrowed to NativeWind** — the failing `<Pressable>` used `dark:` variants in its `className` prop. Earlier components in the JSX tree (like `<SafeAreaView className="...dark:bg-surface-dark">`) also had `dark:` variants and worked fine. The crash only happened after multiple re-renders.

5. **Replaced className with inline style** on the failing Pressable — error disappeared immediately.

## Root Cause

NativeWind v4's `dark:` variant resolution in `className` props internally accesses React Navigation's `NavigationStateContext`. With `darkMode: "class"` in the Tailwind config, NativeWind needs to determine the current color scheme to apply dark mode variants. This resolution mechanism becomes unstable after multiple rapid re-renders (the milestones screen re-renders 4-5 times on mount due to context updates from baby, milestones, sync, and theme providers).

The navigation context is available at the React hook level (`useNavigationState` succeeds), but NativeWind's internal className processing — which runs during the JSX rendering phase, not the hook phase — loses access to it on later re-renders. This appears to be a timing/race condition in NativeWind's CSS interop layer.

## Why Other Screens Aren't Affected

Other modal screens (feeding, diaper, sleep, etc.) also use `dark:` className variants. They likely don't hit this issue because:
- They may trigger fewer re-renders on mount
- Their `_layout.tsx` files use `useTheme()` which may stabilize NativeWind's theme resolution earlier in the render cycle
- The milestones screen's context (`MilestonesProvider`) sits high in the provider tree and triggers additional re-renders as it loads data

## Fix

Replace `dark:` className variants with inline `style` props using the `isDark` boolean from `useColorScheme()` (which works reliably at hook level). For example:

```tsx
// Before (crashes after multiple re-renders)
<Pressable className="bg-surface-card dark:bg-surface-dark-card">

// After (stable)
<Pressable style={{ backgroundColor: isDark ? SURFACE.dark.card : SURFACE.light.card }}>
```

Import `SURFACE`, `TEXT`, etc. from `@/constants/colors` and use them directly in style props instead of relying on NativeWind's dark mode resolution.

## Key Takeaway

When NativeWind's `dark:` className variants cause "navigation context" errors, the issue is NOT with your route/layout setup. It's NativeWind's internal dark mode resolution failing under rapid re-render conditions. The workaround is to use inline styles with a `useColorScheme()` boolean for dark mode switching, bypassing NativeWind's className processing entirely.
