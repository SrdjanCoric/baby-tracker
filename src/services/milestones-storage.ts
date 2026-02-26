import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getUserScopedKey } from "./storage-prefix";

const MILESTONES_KEY_PREFIX = "@milestones:";

export type MilestoneState = "yes" | "not_sure";

export interface StoredMilestoneResponse {
  id: string;
  babyId: string;
  milestoneId: string;
  state: MilestoneState;
  respondedAt: string;
  respondedBy?: string;
  createdAt: string;
  updatedAt: string;
}

function getMilestonesKey(babyId: string): string {
  return getUserScopedKey(`${MILESTONES_KEY_PREFIX}${babyId}`);
}

export const MilestonesStorageService = {
  async getResponses(babyId: string): Promise<StoredMilestoneResponse[]> {
    const data = await AsyncStorage.getItem(getMilestonesKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as StoredMilestoneResponse[];
  },

  async setMilestoneState(input: {
    babyId: string;
    milestoneId: string;
    state: MilestoneState;
    respondedBy?: string;
  }): Promise<StoredMilestoneResponse> {
    const responses = await this.getResponses(input.babyId);
    const now = new Date().toISOString();
    const existing = responses.find((r) => r.milestoneId === input.milestoneId);

    if (existing) {
      const updated: StoredMilestoneResponse = {
        ...existing,
        state: input.state,
        respondedAt: now,
        respondedBy: input.respondedBy ?? existing.respondedBy,
        updatedAt: now,
      };
      const updatedResponses = responses.map((r) =>
        r.milestoneId === input.milestoneId ? updated : r
      );
      await AsyncStorage.setItem(getMilestonesKey(input.babyId), JSON.stringify(updatedResponses));
      return updated;
    }

    const newResponse: StoredMilestoneResponse = {
      id: Crypto.randomUUID(),
      babyId: input.babyId,
      milestoneId: input.milestoneId,
      state: input.state,
      respondedAt: now,
      respondedBy: input.respondedBy,
      createdAt: now,
      updatedAt: now,
    };
    await AsyncStorage.setItem(
      getMilestonesKey(input.babyId),
      JSON.stringify([...responses, newResponse])
    );
    return newResponse;
  },

  async clearMilestoneState(babyId: string, milestoneId: string): Promise<boolean> {
    const responses = await this.getResponses(babyId);
    const filtered = responses.filter((r) => r.milestoneId !== milestoneId);
    if (filtered.length === responses.length) return false;
    await AsyncStorage.setItem(getMilestonesKey(babyId), JSON.stringify(filtered));
    return true;
  },
};
