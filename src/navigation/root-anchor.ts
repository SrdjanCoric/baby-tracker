/**
 * Root stack anchor for expo-router.
 *
 * Declared in its own module so the deep-link anchor contract (a cold launch of
 * `sofibaby://<activity>` stacks the activity modal on top of `(tabs)` instead of
 * replacing the tabs and becoming the stack root) has a passing automated check.
 * `app/_layout.tsx` re-exports this as `unstable_settings`, which expo-router reads
 * from the root layout file.
 */
export const unstable_settings = {
  anchor: "(tabs)",
} as const;