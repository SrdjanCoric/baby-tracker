import AsyncStorage from "@react-native-async-storage/async-storage";

export const importJournalKey = (collectionKey: string) =>
  `@import_batch:${collectionKey}`;
export const importIdsKey = (collectionKey: string) =>
  `@import_ids:${collectionKey}`;

export async function getImportedIds(
  collectionKey: string
): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(importIdsKey(collectionKey));
  return new Set<string>(raw ? JSON.parse(raw) : []);
}

// Call under the collection lock before exposing records after an interrupted save.
export async function settleImportJournal(
  collectionKey: string
): Promise<void> {
  const raw = await AsyncStorage.getItem(importJournalKey(collectionKey));
  if (!raw) return;
  const pendingIds = new Set<string>(JSON.parse(raw));
  const data = await AsyncStorage.getItem(collectionKey);
  const records: { id: string }[] = data ? JSON.parse(data) : [];
  const imported = await getImportedIds(collectionKey);
  for (const record of records) {
    if (pendingIds.has(record.id)) imported.add(record.id);
  }
  await AsyncStorage.setItem(
    importIdsKey(collectionKey),
    JSON.stringify([...imported])
  );
  await AsyncStorage.removeItem(importJournalKey(collectionKey));
}
