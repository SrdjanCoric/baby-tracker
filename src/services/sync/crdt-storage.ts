/**
 * AsyncStorage-backed `ClockStorage` for the HLC. Kept out of the pure `crdt.ts`
 * module so the CRDT logic and its tests never touch native modules; the sync
 * wiring (task 0004) constructs this adapter and injects it into the HLC.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ClockStorage, HlcState } from "./crdt";

// Device-global on purpose: the HLC is a per-device logical clock, so its state must
// NOT be user-scoped. Scoping it per user would reset it to 0 on an account switch on
// the same device, letting the same deviceId re-issue clocks it already handed out.
export const HLC_STORAGE_KEY = "@crdt_hlc";
const HLC_STORAGE_VERSION = 1;

interface PersistedClock {
  value: HlcState;
  version: number;
}

export class AsyncStorageClockStorage implements ClockStorage {
  async load(): Promise<HlcState | null> {
    const raw = await AsyncStorage.getItem(HLC_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PersistedClock;
      if (parsed.version !== HLC_STORAGE_VERSION) {
        await AsyncStorage.removeItem(HLC_STORAGE_KEY);
        return null;
      }
      return parsed.value;
    } catch {
      await AsyncStorage.removeItem(HLC_STORAGE_KEY);
      return null;
    }
  }

  async save(state: HlcState): Promise<void> {
    const payload: PersistedClock = { value: state, version: HLC_STORAGE_VERSION };
    await AsyncStorage.setItem(HLC_STORAGE_KEY, JSON.stringify(payload));
  }
}
