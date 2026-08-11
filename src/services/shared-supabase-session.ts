import type { AsyncStorageStatic } from "@react-native-async-storage/async-storage";

/**
 * Cross-process bridge to the shared Keychain session capsule and the App Group
 * POSIX lock. The native module (`plugins/with-shared-supabase-session`) backs
 * this on iOS; tests and non-iOS platforms inject fakes or skip it entirely.
 */
export interface SharedSupabaseSessionBridge {
  readSession(): Promise<string | null>;
  writeSession(envelopeJson: string): Promise<void>;
  removeSession(): Promise<void>;
}

export interface SharedSupabaseSessionLock {
  withLock<T>(fn: () => Promise<T>): Promise<T>;
}

export interface SharedSupabaseSessionEnvelope {
  version: 1;
  revision: number;
  lineage: string;
  session: string;
}

export type SupabaseAuthStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const SHARED_SESSION_VERSION = 1;

/**
 * Extract the Supabase `session_id` claim from an access token JWT without
 * verifying the signature. Refresh preserves `session_id`, so it is a stable
 * lineage across rotations and changes only on a new sign-in.
 */
export function decodeSupabaseSessionLineage(accessToken: string): string | null {
  const segments = accessToken.split(".");
  if (segments.length < 2) return null;
  let base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  try {
    const json = base64DecodeUtf8(base64);
    const payload = JSON.parse(json) as Record<string, unknown>;
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

function extractAccessToken(sessionJson: string): string | null {
  try {
    const parsed = JSON.parse(sessionJson) as Record<string, unknown>;
    return typeof parsed.access_token === "string" ? parsed.access_token : null;
  } catch {
    return null;
  }
}

function parseEnvelope(envelopeJson: string): SharedSupabaseSessionEnvelope | null {
  try {
    const parsed = JSON.parse(envelopeJson) as Record<string, unknown>;
    if (parsed.version !== SHARED_SESSION_VERSION) return null;
    if (typeof parsed.revision !== "number") return null;
    if (typeof parsed.lineage !== "string") return null;
    if (typeof parsed.session !== "string") return null;
    return {
      version: SHARED_SESSION_VERSION,
      revision: parsed.revision,
      lineage: parsed.lineage,
      session: parsed.session,
    };
  } catch {
    return null;
  }
}

export function buildSharedSessionEnvelope(
  revision: number,
  sessionJson: string,
  fallbackLineage?: string
): SharedSupabaseSessionEnvelope {
  const accessToken = extractAccessToken(sessionJson);
  const lineage =
    (accessToken ? decodeSupabaseSessionLineage(accessToken) : null) ?? fallbackLineage ?? "unknown";
  return { version: SHARED_SESSION_VERSION, revision, lineage, session: sessionJson };
}

export interface CreateSharedSupabaseClientOptionsOptions {
  isIOS: boolean;
  bridge: SharedSupabaseSessionBridge;
  appLock: SharedSupabaseSessionLock;
  sessionKey: string;
  legacyStorage: AsyncStorageStatic | SupabaseAuthStorage;
}

export interface SharedSupabaseClientOptions {
  storage: SupabaseAuthStorage;
}

/**
 * Build the Supabase client `auth` options for the shared session. On iOS the
 * auth session key routes to the shared Keychain capsule through `bridge` and
 * every read/write/redeem is serialized by `appLock`; unrelated keys (the PKCE
 * verifier) keep using AsyncStorage. On Android and web the legacy AsyncStorage
 * storage stays the single source of truth with no cross-process lock, since no
 * extension holds the Supabase credential there.
 *
 * The adapter returns no `lock` for `createClient`: auth-js would wrap every
 * storage call in the *same* native flock that the storage adapter already
 * takes internally. flock locks are per open-file-description, so a nested
 * acquire opens a distinct fd and self-deadlocks against the held one for the
 * full native timeout (and on iOS a held-but-unreleased sign-out lock leaves the
 * shared Keychain capsule in place). The storage adapter owns serialization; a
 * second auth-js lock adds no protection and breaks it.
 */
export function createSharedSupabaseClientOptions(
  options: CreateSharedSupabaseClientOptionsOptions
): SharedSupabaseClientOptions {
  if (!options.isIOS) {
    return { storage: options.legacyStorage as SupabaseAuthStorage };
  }

  const { bridge, appLock, sessionKey, legacyStorage } = options;
  const legacy = legacyStorage as SupabaseAuthStorage;

  const storage: SupabaseAuthStorage = {
    async getItem(key: string): Promise<string | null> {
      if (key !== sessionKey) {
        return legacy.getItem(key);
      }
      return appLock.withLock(async () => {
        const raw = await bridge.readSession();
        if (raw != null) {
          const envelope = parseEnvelope(raw);
          if (envelope) return envelope.session;
          // A corrupt Keychain capsule cannot be trusted as a session; surface
          // a sign-out rather than serving malformed credentials.
          return null;
        }
        const legacySession = await legacy.getItem(sessionKey);
        if (legacySession == null) return null;
        const accessToken = extractAccessToken(legacySession);
        const lineage = accessToken ? decodeSupabaseSessionLineage(accessToken) : null;
        if (!lineage) {
          // Cannot safely persist an unidentifiable session; keep it available
          // for this read without deleting the legacy copy.
          return legacySession;
        }
        const envelope = buildSharedSessionEnvelope(1, legacySession, lineage);
        await bridge.writeSession(JSON.stringify(envelope));
        await legacy.removeItem(sessionKey);
        return legacySession;
      });
    },

    async setItem(key: string, value: string): Promise<void> {
      if (key !== sessionKey) {
        return legacy.setItem(key, value);
      }
      await appLock.withLock(async () => {
        const raw = await bridge.readSession();
        const current = raw != null ? parseEnvelope(raw) : null;
        const revision = (current?.revision ?? 0) + 1;
        const envelope = buildSharedSessionEnvelope(revision, value, current?.lineage);
        await bridge.writeSession(JSON.stringify(envelope));
      });
    },

    async removeItem(key: string): Promise<void> {
      if (key !== sessionKey) {
        return legacy.removeItem(key);
      }
      await appLock.withLock(async () => {
        await bridge.removeSession();
      });
    },
  };

  return { storage };
}

// Pure base64 -> UTF-8 decoder that avoids Node `Buffer` so the module runs in
// the React Native Hermes runtime.
function base64DecodeUtf8(input: string): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Int8Array(256).fill(-1);
  for (let i = 0; i < chars.length; i += 1) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const raw of input) {
    const code = lookup[raw.charCodeAt(0)];
    if (code === -1) continue;
    buffer = (buffer << 6) | code;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  let out = "";
  for (const byte of bytes) {
    out += String.fromCharCode(byte);
  }
  return decodeUtf8(out);
}

function decodeUtf8(binary: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < binary.length; i += 1) {
    bytes.push(binary.charCodeAt(i) & 0xff);
  }
  const utf8Decoder = new TextDecoder("utf-8");
  return utf8Decoder.decode(new Uint8Array(bytes));
}