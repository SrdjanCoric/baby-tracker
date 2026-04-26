import AsyncStorage from "@react-native-async-storage/async-storage";

const TIPS_DISMISSED_KEY = "@tips:dismissed";
const TIPS_ENABLED_KEY = "@tips:enabled";
const TIPS_SHOWN_KEY = "@tips:shown";
const TIPS_DISCOVERY_DISMISSED_KEY = "@tips:discovery_dismissed";

export async function getTipsDismissedDate(babyId: string): Promise<string | null> {
  return AsyncStorage.getItem(`${TIPS_DISMISSED_KEY}:${babyId}`);
}

export async function setTipsDismissedDate(babyId: string, date: string): Promise<void> {
  await AsyncStorage.setItem(`${TIPS_DISMISSED_KEY}:${babyId}`, date);
}

export async function getTipsEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(TIPS_ENABLED_KEY);
  return val === "true";
}

export async function setTipsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(TIPS_ENABLED_KEY, enabled.toString());
}

export async function getShownTipIds(babyId: string, ageGroup: string): Promise<string[]> {
  const val = await AsyncStorage.getItem(`${TIPS_SHOWN_KEY}:${babyId}:${ageGroup}`);
  return val ? JSON.parse(val) : [];
}

export async function addShownTipIds(babyId: string, ageGroup: string, tipIds: string[]): Promise<void> {
  const existing = await getShownTipIds(babyId, ageGroup);
  const updated = [...new Set([...existing, ...tipIds])];
  await AsyncStorage.setItem(`${TIPS_SHOWN_KEY}:${babyId}:${ageGroup}`, JSON.stringify(updated));
}

export async function resetShownTipIds(babyId: string, ageGroup: string): Promise<void> {
  await AsyncStorage.removeItem(`${TIPS_SHOWN_KEY}:${babyId}:${ageGroup}`);
}

export async function getDiscoveryBannerDismissed(): Promise<boolean> {
  const val = await AsyncStorage.getItem(TIPS_DISCOVERY_DISMISSED_KEY);
  return val === "true";
}

export async function setDiscoveryBannerDismissed(): Promise<void> {
  await AsyncStorage.setItem(TIPS_DISCOVERY_DISMISSED_KEY, "true");
}
