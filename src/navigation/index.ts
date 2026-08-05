import type { Router } from "expo-router";

export function exitModal(router: Router): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace("/(tabs)");
}
