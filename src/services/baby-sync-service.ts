import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { getUserScopedKey } from "./storage-prefix";
import type { StoredBabyProfile, CreateBabyInput, UpdateBabyInput } from "./baby-storage";

const BABIES_KEY_BASE = "@babies";
const SELECTED_BABY_KEY_BASE = "@selected_baby_id";

function getBabiesKey(): string {
  return getUserScopedKey(BABIES_KEY_BASE);
}

function getSelectedBabyKey(): string {
  return getUserScopedKey(SELECTED_BABY_KEY_BASE);
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

  const babies: StoredBabyProfile[] = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    birthDate: row.birth_date || undefined,
    gender: row.gender || undefined,
    photoUri: row.photo_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  await AsyncStorage.setItem(getBabiesKey(), JSON.stringify(babies));

  return babies;
}

export async function createBabyInDatabase(
  input: CreateBabyInput,
  householdId: string
): Promise<StoredBabyProfile> {
  const now = new Date().toISOString();
  const id = generateUUID();

  const { data, error } = await supabase
    .from("babies")
    .insert({
      id,
      household_id: householdId,
      name: input.name,
      birth_date: input.birthDate?.toISOString(),
      gender: input.gender,
      photo_url: input.photoUri,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    console.error("[BabySyncService] Failed to create baby:", error.message);
    throw new Error("Failed to create baby");
  }

  const baby: StoredBabyProfile = {
    id: data.id,
    name: data.name,
    birthDate: data.birth_date || undefined,
    gender: data.gender || undefined,
    photoUri: data.photo_url || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  // Also update local storage
  const localBabies = await getLocalBabies();
  localBabies.push(baby);
  await AsyncStorage.setItem(getBabiesKey(), JSON.stringify(localBabies));

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

  const { data, error } = await supabase
    .from("babies")
    .update(updateData)
    .eq("id", id)
    .eq("household_id", householdId)
    .select()
    .single();

  if (error) {
    console.error("[BabySyncService] Failed to update baby:", error.message);
    return null;
  }

  const baby: StoredBabyProfile = {
    id: data.id,
    name: data.name,
    birthDate: data.birth_date || undefined,
    gender: data.gender || undefined,
    photoUri: data.photo_url || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  // Update local storage
  const localBabies = await getLocalBabies();
  const index = localBabies.findIndex((b) => b.id === id);
  if (index !== -1) {
    localBabies[index] = baby;
    await AsyncStorage.setItem(getBabiesKey(), JSON.stringify(localBabies));
  }

  return baby;
}

export async function deleteBabyFromDatabase(
  id: string,
  householdId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("babies")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId)
    .select();

  if (error) {
    console.error("[BabySyncService] Failed to delete baby:", error.message);
    return false;
  }

  const deletedCount = data?.length ?? 0;
  if (deletedCount === 0) {
    return false;
  }

  // Update local storage
  const localBabies = await getLocalBabies();
  const filtered = localBabies.filter((b) => b.id !== id);
  await AsyncStorage.setItem(getBabiesKey(), JSON.stringify(filtered));

  // Clear selected baby if deleted
  const selectedId = await AsyncStorage.getItem(getSelectedBabyKey());
  if (selectedId === id) {
    await AsyncStorage.removeItem(getSelectedBabyKey());
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

async function remapActivityBabyIds(oldId: string, newId: string): Promise<void> {
  const activityKeys = [
    "@feedings:",
    "@diapers:",
    "@sleeps:",
    "@pumpings:",
    "@growth:",
    "@tummyTimes:",
  ];

  for (const keyPrefix of activityKeys) {
    const key = `${keyPrefix}${oldId}`;
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const activities = JSON.parse(data) as Array<{ babyId: string }>;
      const updated = activities.map((a) => ({ ...a, babyId: newId }));
      await AsyncStorage.setItem(`${keyPrefix}${newId}`, JSON.stringify(updated));
      await AsyncStorage.removeItem(key);
    }
  }

  const selectedBabyId = await AsyncStorage.getItem("@selected_baby_id");
  if (selectedBabyId === oldId) {
    await AsyncStorage.setItem("@selected_baby_id", newId);
  }
}

export async function syncLocalBabiesToDatabase(
  householdId: string,
  babies?: StoredBabyProfile[]
): Promise<{ idMap: Map<string, string> }> {
  const babiesToSync = babies ?? await getLocalBabies();
  const idMap = new Map<string, string>();

  for (const baby of babiesToSync) {
    let babyId = baby.id;

    if (!isValidUUID(baby.id)) {
      babyId = generateUUID();
      await remapActivityBabyIds(baby.id, babyId);
      idMap.set(baby.id, babyId);
    }

    const { error } = await supabase
      .from("babies")
      .upsert({
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
      console.error("[BabySyncService] Failed to sync baby:", babyId, error.message);
    }
  }

  return { idMap };
}
