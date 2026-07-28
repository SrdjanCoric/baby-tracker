import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { BabyStorageService, type StoredBabyProfile } from "@/services/baby-storage";
import { syncLocalBabiesToDatabase } from "@/services/baby-sync-service";
import {
  acknowledgeGuestActivityMigration,
  clearGuestActivitiesAfterMigration,
  syncGuestActivitiesToDatabase,
} from "@/services/activity-sync-service";

const GUEST_BABIES_KEY = "@babies";
const GUEST_SELECTED_BABY_KEY = "@selected_baby_id";
const MIGRATION_RECORD_KEY = "@guest_account_migration_v1";
const GUEST_DATA_PREFIXES = [
  "@feedings:",
  "@active_feeding_timer:",
  "@sleeps:",
  "@active_sleep_timer:",
  "@diapers:",
  "@pumpings:",
  "@active_pumping_timer:",
  "@growth:",
  "@tummyTimes:",
  "@active_tummyTime_timer:",
  "@health:",
  "@milestones:",
] as const;

interface GuestAccountMigrationRecord {
  version: 1;
  userId: string;
  householdId: string;
  status: "prepared" | "conflict";
  guestBabies: StoredBabyProfile[];
  selectedGuestBabyId: string | null;
  idMap: Record<string, string>;
}

export type GuestBabyMigrationClassification =
  | { kind: "ready"; idMap: Map<string, string> }
  | { kind: "conflict" };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizedName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function calendarDate(value: string | undefined): string | null {
  return value?.slice(0, 10) ?? null;
}

function isSameBaby(guest: StoredBabyProfile, account: StoredBabyProfile): boolean {
  if (!guest.birthDate || !account.birthDate || !guest.gender || !account.gender) return false;
  return (
    normalizedName(guest.name) === normalizedName(account.name) &&
    calendarDate(guest.birthDate) === calendarDate(account.birthDate) &&
    guest.gender === account.gender
  );
}

export function classifyGuestBabyMigration(
  guestBabies: StoredBabyProfile[],
  accountBabies: StoredBabyProfile[]
): GuestBabyMigrationClassification {
  if (accountBabies.length === 0) {
    return {
      kind: "ready",
      idMap: new Map(guestBabies.map(baby => [baby.id, baby.id])),
    };
  }
  if (accountBabies.length !== guestBabies.length) return { kind: "conflict" };

  const idMap = new Map<string, string>();
  const claimedAccountIds = new Set<string>();
  for (const guestBaby of guestBabies) {
    const matches = accountBabies.filter(accountBaby => isSameBaby(guestBaby, accountBaby));
    if (matches.length !== 1 || claimedAccountIds.has(matches[0].id)) {
      return { kind: "conflict" };
    }
    idMap.set(guestBaby.id, matches[0].id);
    claimedAccountIds.add(matches[0].id);
  }
  return { kind: "ready", idMap };
}

function isStoredBabyProfile(value: unknown): value is StoredBabyProfile {
  if (!value || typeof value !== "object") return false;
  const baby = value as Record<string, unknown>;
  return (
    typeof baby.id === "string" &&
    typeof baby.name === "string" &&
    (baby.birthDate === undefined || typeof baby.birthDate === "string") &&
    (baby.gender === undefined || baby.gender === "male" || baby.gender === "female") &&
    typeof baby.createdAt === "string" &&
    typeof baby.updatedAt === "string"
  );
}

function parseMigrationRecord(value: string | null): GuestAccountMigrationRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<GuestAccountMigrationRecord>;
    if (
      parsed.version !== 1 ||
      typeof parsed.userId !== "string" ||
      typeof parsed.householdId !== "string" ||
      (parsed.status !== "prepared" && parsed.status !== "conflict") ||
      !Array.isArray(parsed.guestBabies) ||
      !parsed.guestBabies.every(isStoredBabyProfile) ||
      (parsed.selectedGuestBabyId !== null && typeof parsed.selectedGuestBabyId !== "string") ||
      !parsed.idMap ||
      typeof parsed.idMap !== "object" ||
      !Object.entries(parsed.idMap).every(
        ([guestId, targetId]) => guestId.length > 0 && typeof targetId === "string"
      )
    ) return null;
    return parsed as GuestAccountMigrationRecord;
  } catch {
    return null;
  }
}

export async function discardGuestAccountMigration(): Promise<void> {
  const record = parseMigrationRecord(await AsyncStorage.getItem(MIGRATION_RECORD_KEY));
  const serializedBabies = await AsyncStorage.getItem(GUEST_BABIES_KEY);
  const parsedBabies: unknown = serializedBabies ? JSON.parse(serializedBabies) : [];
  const storedBabies = Array.isArray(parsedBabies)
    ? parsedBabies.filter(isStoredBabyProfile)
    : [];
  const babyIds = new Set([
    ...storedBabies.map(baby => baby.id),
    ...(record?.guestBabies.map(baby => baby.id) ?? []),
  ]);

  for (const babyId of babyIds) {
    for (const prefix of GUEST_DATA_PREFIXES) {
      await AsyncStorage.removeItem(`${prefix}${babyId}`);
    }
  }
  await AsyncStorage.removeItem(GUEST_BABIES_KEY);
  await AsyncStorage.removeItem(GUEST_SELECTED_BABY_KEY);
  await AsyncStorage.removeItem(MIGRATION_RECORD_KEY);
}

export type GuestAccountMigrationResult =
  | { status: "none" }
  | { status: "conflict" }
  | { status: "completed" };

export async function runGuestAccountMigration({
  userId,
  householdId,
  accountBabies,
}: {
  userId: string;
  householdId: string;
  accountBabies: StoredBabyProfile[];
}): Promise<GuestAccountMigrationResult> {
  const storedRecord = parseMigrationRecord(await AsyncStorage.getItem(MIGRATION_RECORD_KEY));
  let record = storedRecord?.userId === userId && storedRecord.householdId === householdId
    ? storedRecord
    : null;

  if (!record) {
    const serializedBabies = await AsyncStorage.getItem(GUEST_BABIES_KEY);
    const parsedBabies: unknown = serializedBabies ? JSON.parse(serializedBabies) : [];
    if (!Array.isArray(parsedBabies) || !parsedBabies.every(isStoredBabyProfile)) {
      throw new Error("Guest baby snapshot is invalid");
    }
    const guestBabies = parsedBabies;
    if (guestBabies.length === 0) return { status: "none" };

    const classification = classifyGuestBabyMigration(guestBabies, accountBabies);
    const selectedGuestBabyId = await AsyncStorage.getItem(GUEST_SELECTED_BABY_KEY);
    record = {
      version: 1,
      userId,
      householdId,
      status: classification.kind === "conflict" ? "conflict" : "prepared",
      guestBabies,
      selectedGuestBabyId,
      idMap: classification.kind === "ready"
        ? Object.fromEntries(Array.from(classification.idMap, ([guestId, targetId]) => [
          guestId,
          isUuid(targetId) ? targetId : Crypto.randomUUID(),
        ]))
        : {},
    };
    await AsyncStorage.setItem(MIGRATION_RECORD_KEY, JSON.stringify(record));
  }

  if (record.status === "conflict") return { status: "conflict" };

  const idMap = new Map(Object.entries(record.idMap));
  const accountBabyIds = new Set(accountBabies.map(baby => baby.id));
  const babiesToCreate = record.guestBabies.filter(baby => {
    const targetId = idMap.get(baby.id);
    return targetId !== undefined && !accountBabyIds.has(targetId);
  });
  if (babiesToCreate.length > 0) {
    await syncLocalBabiesToDatabase(householdId, babiesToCreate, idMap);
  }
  await syncGuestActivitiesToDatabase(userId, idMap);
  await acknowledgeGuestActivityMigration();

  const selectedAccountBabyId = record.selectedGuestBabyId
    ? idMap.get(record.selectedGuestBabyId) ?? null
    : null;
  await BabyStorageService.setSelectedBabyId(
    selectedAccountBabyId,
    BabyStorageService.scopeForUser(userId, householdId)
  );

  await clearGuestActivitiesAfterMigration(record.guestBabies.map(baby => baby.id));
  await AsyncStorage.removeItem(GUEST_BABIES_KEY);
  await AsyncStorage.removeItem(GUEST_SELECTED_BABY_KEY);
  await AsyncStorage.removeItem(MIGRATION_RECORD_KEY);
  return { status: "completed" };
}
