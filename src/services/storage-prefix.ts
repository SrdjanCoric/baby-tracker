let currentUserId: string | null = null;

export function setStorageUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getStorageUserId(): string | null {
  return currentUserId;
}

export function getUserScopedKey(baseKey: string): string {
  return getUserScopedKeyFor(baseKey, currentUserId);
}

export function getUserScopedKeyFor(baseKey: string, userId: string | null): string {
  if (!userId) {
    return baseKey;
  }
  return `${baseKey}:${userId}`;
}
