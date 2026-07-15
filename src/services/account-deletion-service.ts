/**
 * Account Deletion Service
 * Handles account and data deletion operations
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { supabase } from "./supabase";
import { FeedingStorageService } from "./feeding-storage";
import { SleepStorageService } from "./sleep-storage";
import { DiaperStorageService } from "./diaper-storage";
import { PumpingStorageService } from "./pumping-storage";
import { GrowthStorageService } from "./growth-storage";
import { TummyTimeStorageService } from "./tummyTime-storage";
import { BabyStorageService } from "./baby-storage";
import type { DeletionPreview, DeletionResult } from "@/types/account-deletion";

export const AccountDeletionService = {
  async getDeletionPreview(
    babyId: string,
    householdId: string | null,
    userId: string
  ): Promise<DeletionPreview> {
    const babyStorageScope = BabyStorageService.scopeForUser(userId, householdId);
    const [feedings, sleeps, diapers, pumpings, growth, tummyTimes, babies] =
      await Promise.all([
        FeedingStorageService.getAllFeedings(babyId),
        SleepStorageService.getAllSleeps(babyId),
        DiaperStorageService.getAllDiapers(babyId),
        PumpingStorageService.getAllPumpings(babyId),
        GrowthStorageService.getAllMeasurements(babyId),
        TummyTimeStorageService.getAllTummyTimes(babyId),
        BabyStorageService.getAllBabies(babyStorageScope),
      ]);

    let householdWillBeDeleted = false;
    let hasOtherCaregivers = false;

    if (householdId) {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id")
          .eq("household_id", householdId);

        if (!error && data) {
          const memberCount = data.length;
          householdWillBeDeleted = memberCount === 1;
          hasOtherCaregivers = memberCount > 1;
        }
      } catch {
        // Ignore errors, default to false
      }
    }

    return {
      feedings: feedings.length,
      sleep: sleeps.length,
      diapers: diapers.length,
      pumping: pumpings.length,
      growth: growth.length,
      tummyTime: tummyTimes.length,
      babies: babies.map((baby) => ({ id: baby.id, name: baby.name })),
      householdWillBeDeleted,
      hasOtherCaregivers,
    };
  },

  async deleteAccount(userId: string): Promise<DeletionResult> {
    try {
      const { error } = await supabase.rpc("delete_user_account", {
        user_id_param: userId,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      await this.clearLocalStorage();

      return { success: true };
    } catch (err) {
      console.error("[AccountDeletion] Unexpected error:", err);
      if (err instanceof Error && err.message.includes("Network")) {
        return { success: false, error: "networkError" };
      }
      return { success: false, error: "unknown" };
    }
  },

  async clearLocalStorage(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      if (allKeys.length > 0) {
        await AsyncStorage.multiRemove(allKeys);
      }
    } catch {
      // Ignore storage clearing errors
    }
  },

  async isOnline(): Promise<boolean> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      return networkState.isConnected ?? false;
    } catch {
      return false;
    }
  },
};
