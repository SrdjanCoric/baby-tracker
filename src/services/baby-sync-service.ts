import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { getUserScopedKey } from "./storage-prefix";
import type { StoredBabyProfile, CreateBabyInput, UpdateBabyInput } from "./baby-storage";
import { mergeRecordWrite } from "./sync/merge-record-write";
import { reconcilePulled } from "./sync/crdt-sync-instance";
import { dropTombstoned } from "./sync/tombstone";

function mapBabyRow(row: Record<string, unknown>): StoredBabyProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    birthDate: (row.birth_date as string) || undefined,
    gender: (row.gender as StoredBabyProfile["gender"]) || undefined,
    photoUri: (row.photo_url as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const BABIES_KEY_BASE = "@babies";

function getBabiesKey(): string {
  return getUserScopedKey(BABIES_KEY_BASE);
}

function generateUUID(): string {
  return Crypto.randomUUID();
}

export async function fetchAndSyncHouseholdBabies(householdId: string): Promise<StoredBabyProfile[]> {
  const { data, error } = await supabase
    .from("babies")
    .select("*")
    .eq("household_id", householdId);

  if (error) {
    console.error("[BabySyncService] Failed to fetch babies:", error.message);
    throw new Error("Failed to fetch household babies");
  }

  const reconciled = await reconcilePulled("babies", (data || []) as Record<string, unknown>[]);
  const babies: StoredBabyProfile[] = dropTombstoned(reconciled).map(mapBabyRow);

  return babies;
}

export async function createBabyInDatabase(
  input: CreateBabyInput,
  householdId: string
): Promise<StoredBabyProfile> {
  const now = new Date().toISOString();
  const id = input.id || generateUUID();

  const { data, error } = await mergeRecordWrite("babies", id, {
    id,
    household_id: householdId,
    name: input.name,
    birth_date: input.birthDate?.toISOString(),
    gender: input.gender,
    photo_url: input.photoUri,
    created_at: now,
    updated_at: now,
  });

  if (error || !data) {
    console.error("[BabySyncService] Failed to create baby:", error?.message);
    throw new Error("Failed to create baby");
  }

  const baby: StoredBabyProfile = mapBabyRow(data);

  return baby;
}

export async function updateBabyInDatabase(
  id: string,
  input: UpdateBabyInput,
  householdId: string
): Promise<StoredBabyProfile | null> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.birthDate !== undefined) updateData.birth_date = input.birthDate.toISOString();
  if (input.gender !== undefined) updateData.gender = input.gender;
  if (input.photoUri !== undefined) updateData.photo_url = input.photoUri;

  const { data, error } = await mergeRecordWrite("babies", id, {
    ...updateData,
    household_id: householdId,
  });

  if (error || !data) {
    console.error("[BabySyncService] Failed to update baby:", error?.message);
    return null;
  }

  const baby: StoredBabyProfile = mapBabyRow(data);

  return baby;
}

export async function deleteBabyFromDatabase(
  id: string,
  _householdId: string
): Promise<boolean> {
  // Tombstone: a `deleted: true` field write merged through the CRDT RPC, not a hard delete.
  // RLS enforces household ownership; the row is located by id.
  const { error } = await mergeRecordWrite("babies", id, { deleted: true });

  if (error) {
    console.error("[BabySyncService] Failed to delete baby:", error.message);
    return false;
  }

  return true;
}

async function getLocalBabies(): Promise<StoredBabyProfile[]> {
  const data = await AsyncStorage.getItem(getBabiesKey());
  if (!data) return [];
  return JSON.parse(data) as StoredBabyProfile[];
}

export async function clearLocalBabies(): Promise<void> {
  await AsyncStorage.removeItem(getBabiesKey());
}

function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export async function syncLocalBabiesToDatabase(
  householdId: string,
  babies?: StoredBabyProfile[],
  targetIds: Map<string, string> = new Map()
): Promise<{ idMap: Map<string, string> }> {
  const babiesToSync = babies ?? await getLocalBabies();
  const idMap = new Map<string, string>();

  for (const baby of babiesToSync) {
    const babyId = targetIds.get(baby.id) ?? (isValidUUID(baby.id) ? baby.id : generateUUID());
    idMap.set(baby.id, babyId);

    const { error } = await mergeRecordWrite("babies", babyId, {
      id: babyId,
      household_id: householdId,
      name: baby.name,
      birth_date: baby.birthDate,
      gender: baby.gender,
      photo_url: baby.photoUri,
      created_at: baby.createdAt,
      updated_at: baby.updatedAt,
    });

    if (error) {
      console.error("[BabySyncService] Failed to sync guest baby");
      throw new Error("Failed to sync guest baby");
    }
  }

  return { idMap };
}
