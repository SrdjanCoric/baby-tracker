/**
 * Stable, persisted per-device identifier for the CRDT hybrid logical clock.
 *
 * The HLC embeds this id in every clock string as the final tie-break component, so it
 * must be stable across app restarts (a regenerated id would let the same physical
 * device masquerade as two origins). It is device-global — deliberately not user-scoped —
 * mirroring `HLC_STORAGE_KEY`: scoping per user would mint a new id on an account switch
 * on the same device.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEVICE_ID_STORAGE_KEY = "@crdt_device_id";

let cached: string | null = null;
let inflight: Promise<string> | null = null;

function defaultGenerate(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  // Fallback for runtimes without crypto.randomUUID — colon-free so it stays safe
  // inside the HLC's `-`-delimited clock string.
  const rand = Math.random().toString(36).slice(2);
  return `dev-${rand}`;
}

/**
 * Return this device's stable id, generating and persisting one on first use. Concurrent
 * callers share a single in-flight resolution so only one id is ever minted.
 */
export async function getDeviceId(generate: () => string = defaultGenerate): Promise<string> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const stored = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
    const generated = generate();
    await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    cached = generated;
    return generated;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function __resetDeviceIdForTests(): void {
  cached = null;
  inflight = null;
}
