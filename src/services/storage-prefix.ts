let currentUserId: string | null = null;

export function setStorageUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getStorageUserId(): string | null {
  return currentUserId;
}

export function getUserScopedKey(baseKey: string): string {
  if (!currentUserId) {
    return baseKey;
  }
  return `${baseKey}:${currentUserId}`;
}
