import { afterAll, beforeAll, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SyncEngine } from "../sync/sync-engine";
import {
  updateFeedingInDatabase,
  deleteDiaperFromDatabase,
} from "../activity-sync-service";
import { createBabyInDatabase } from "../baby-sync-service";
import { HUCKLEBERRY_HEADER, readHuckleberry } from "./huckleberry-reader";
import { IMPORT_TABLES, importRecords, prepareImport } from "./import-records";
import { setStorageUserId } from "../storage-prefix";
import { __resetCrdtSyncForTests } from "../sync/crdt-sync-instance";

const store = new Map<string, string>();
let client: SupabaseClient;
let admin: SupabaseClient;
let engine: SyncEngine;
let userId: string;
let householdId: string;
let localDbUrl: string;
let outsider: SupabaseClient;
let outsiderUserId: string;
let outsiderHouseholdId: string;
const babyId = randomUUID();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  },
}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => randomUUID(),
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_algorithm: string, value: string) =>
    createHash("sha256").update(value).digest("hex"),
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    fetch: async () => ({ isConnected: true, isInternetReachable: true }),
    addEventListener: () => () => {},
  },
}));
vi.mock("@/contexts/sync-context", () => ({ getSyncEngine: () => engine }));
vi.mock("../supabase", () => ({
  get supabase() {
    return client;
  },
}));

// Privileged inspection is restricted to generated fixtures; authenticated reads above
// exercise the application's column grants and household policy.
function readFixture(table: string, id: string) {
  if (
    !Object.values(IMPORT_TABLES).includes(table as never) ||
    !/^[a-f0-9-]{36}$/.test(id)
  )
    throw new Error("Invalid fixture identity");
  try {
    return JSON.parse(
      execFileSync(
        "psql",
        [
          localDbUrl,
          "-At",
          "-c",
          `SELECT row_to_json(t) FROM public.${table} t WHERE id = '${id}' AND baby_id = '${babyId}'`,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      )
    );
  } catch {
    throw new Error("Could not inspect isolated fixture");
  }
}

beforeAll(async () => {
  const status = JSON.parse(
    execFileSync("npx", ["supabase", "status", "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  );
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(
      new URL(status.API_URL).hostname
    )
  )
    throw new Error("Import test requires loopback Supabase");
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  localDbUrl = status.DB_URL;
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(localDbUrl).hostname)
  )
    throw new Error("Import cleanup requires loopback Postgres");
  admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  client = createClient(status.API_URL, status.ANON_KEY, options);
  const email = `import-${randomUUID()}@example.test`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user)
    throw new Error("Could not create isolated import test user");
  userId = created.data.user.id;
  const household = await admin
    .from("users")
    .select("household_id")
    .eq("id", userId)
    .single();
  if (household.error) throw new Error("Could not read test household");
  householdId = household.data.household_id;
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) throw new Error("Could not sign in test user");
  setStorageUserId(userId);
  engine = new SyncEngine();
  await engine.initialize();
  engine.setAuthContext({ userId, householdId });
  await createBabyInDatabase(
    {
      id: babyId,
      name: "Import test baby",
      birthDate: new Date("2024-01-01T00:00:00Z"),
      gender: "female",
    },
    householdId
  );
  outsider = createClient(status.API_URL, status.ANON_KEY, options);
  const outsiderEmail = `import-outsider-${randomUUID()}@example.test`;
  const outsiderPassword = randomUUID();
  const other = await admin.auth.admin.createUser({
    email: outsiderEmail,
    password: outsiderPassword,
    email_confirm: true,
  });
  if (other.error || !other.data.user)
    throw new Error("Could not create outsider fixture");
  outsiderUserId = other.data.user.id;
  const otherHousehold = await admin
    .from("users")
    .select("household_id")
    .eq("id", outsiderUserId)
    .single();
  if (otherHousehold.error)
    throw new Error("Could not read outsider household");
  outsiderHouseholdId = otherHousehold.data.household_id;
  expect(outsiderHouseholdId).not.toBe(householdId);
  if (
    (
      await outsider.auth.signInWithPassword({
        email: outsiderEmail,
        password: outsiderPassword,
      })
    ).error
  )
    throw new Error("Could not sign in outsider");
}, 30000);

afterAll(async () => {
  engine?.destroy();
  if (client) await client.auth.signOut();
  if (outsider) await outsider.auth.signOut();
  if (localDbUrl) {
    const identities = [
      [userId, householdId],
      [outsiderUserId, outsiderHouseholdId],
    ];
    const deletes = identities
      .filter(([id, household]) => id && household)
      .map(
        ([id, household]) =>
          `DELETE FROM auth.users WHERE id = '${id}'; DELETE FROM public.households WHERE id = '${household}';`
      )
      .join(" ");
    try {
      execFileSync("psql", [localDbUrl, "-v", "ON_ERROR_STOP=1"], {
        input: `BEGIN; DELETE FROM public.babies WHERE id = '${babyId}'; ${deletes} COMMIT;`,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      throw new Error("Could not clean isolated import fixtures");
    }
  }
  setStorageUserId(null);
  store.clear();
});

it("sends every imported type once through the real local merge RPC, with attribution, and preserves server edits and tombstones", async () => {
  const rows = [
    [
      "Sleep",
      "2024-01-12 12:00",
      "2024-01-12 13:00",
      "",
      "",
      "",
      "",
      "synthetic sleep",
    ],
    [
      "Feed",
      "2024-01-12 12:00",
      "",
      "",
      "Mixed",
      "Bottle",
      "80 ml",
      "synthetic bottle",
    ],
    [
      "Feed",
      "2024-01-12 14:00",
      "2024-01-12 14:10",
      "",
      "0:10R",
      "Breast",
      "",
      "synthetic breast",
    ],
    ["Solids", "2024-01-12 15:00", "", "", "pear", "", "", "synthetic solids"],
    [
      "Diaper",
      "2024-01-12 12:00",
      "",
      "yellow",
      "",
      "",
      "Both",
      "synthetic diaper",
    ],
    [
      "Growth",
      "2024-01-12 12:00",
      "",
      "",
      "5 kg",
      "65 cm",
      "40 cm",
      "synthetic growth",
    ],
    [
      "Pump",
      "2024-01-12 12:00",
      "",
      "0:10",
      "20 ml",
      "",
      "30 ml",
      "synthetic pump",
    ],
    [
      "Meds",
      "2024-01-12 12:00",
      "",
      "",
      "2 ml",
      "Test medicine",
      "",
      "synthetic medication",
    ],
    [
      "Tummy time",
      "2024-01-12 12:00",
      "2024-01-12 12:05",
      "",
      "",
      "",
      "",
      "synthetic tummy time",
    ],
  ];
  const preview = readHuckleberry(
    [HUCKLEBERRY_HEADER, ...rows].map((row) => row.join(",")).join("\n")
  );
  for (const table of Object.values(IMPORT_TABLES)) {
    const check = await client
      .from(table)
      .select("id")
      .eq("baby_id", babyId)
      .limit(1);
    if (check.error)
      throw new Error(
        `Local fixture read failed for ${table}: ${check.error.code} ${check.error.message}`
      );
  }
  expect(preview.skipped).toEqual({});
  const plan = await prepareImport(preview, babyId, userId);
  const rpc = vi.spyOn(client, "rpc");
  expect(await importRecords(plan)).toEqual({ added: 9, alreadyImported: 0 });
  expect(engine.getPendingCount()).toBe(0);
  expect(rpc).toHaveBeenCalledTimes(9);
  for (const item of plan.records) {
    const table = IMPORT_TABLES[item.record.kind];
    const result = { data: readFixture(table, item.id) };
    expect(result.data).toMatchObject({
      id: item.id,
      baby_id: babyId,
      logged_by: userId,
      notes: item.record.input.notes,
      deleted: false,
    });
    expect(Object.keys(result.data.field_clocks).length).toBeGreaterThan(0);
    if (item.record.kind === "growth")
      expect(result.data).toMatchObject({
        weight_kg: 5,
        height_cm: 65,
        head_cm: 40,
      });
    if (item.record.kind === "pumping")
      expect(result.data).toMatchObject({ amount_ml: 50, side: "both" });
    // An unlabelled imported sleep must not take the column's version default,
    // which would turn history into morning confirmations.
    if (item.record.kind === "sleep")
      expect(result.data).toMatchObject({
        morning_classification: null,
        morning_classification_version: null,
      });
  }
  const medication = plan.records.find(
    (item) => item.record.kind === "health"
  )!;
  const ownRead = await client
    .from("health_entries")
    .select("id,baby_id")
    .eq("id", medication.id);
  expect(ownRead.error).toBeNull();
  expect(ownRead.data).toEqual([{ id: medication.id, baby_id: babyId }]);
  const otherRead = await outsider
    .from("health_entries")
    .select("id,baby_id")
    .eq("id", medication.id);
  expect(otherRead.error).toBeNull();
  expect(otherRead.data).toEqual([]);
  const feeding = plan.records.find((item) => item.record.kind === "feeding")!;
  const diaper = plan.records.find((item) => item.record.kind === "diaper")!;
  expect(
    await updateFeedingInDatabase(babyId, feeding.id, {
      notes: "caregiver edit",
    })
  ).not.toBeNull();
  expect(await deleteDiaperFromDatabase(babyId, diaper.id)).toBe(true);
  await engine.sync();
  expect(engine.getPendingCount()).toBe(0);
  rpc.mockClear();
  // A fresh device has neither the local ledger nor CRDT shadows; server identity still wins.
  store.clear();
  __resetCrdtSyncForTests();
  const again = await prepareImport(preview, babyId, userId);
  expect(again.alreadyImported).toBe(9);
  expect(await importRecords(again)).toEqual({ added: 0, alreadyImported: 9 });
  expect(rpc).not.toHaveBeenCalled();
  expect(readFixture("feedings", feeding.id).notes).toBe("caregiver edit");
  expect(readFixture("diapers", diaper.id).deleted).toBe(true);
}, 30000);

it("uploads a 3,600-record import once with bounded queue storage and re-imports zero", async () => {
  const preview = readHuckleberry(
    [
      HUCKLEBERRY_HEADER.join(","),
      ...Array.from(
        { length: 3600 },
        (_, i) =>
          `Feed,2024-01-12 12:00,,,Formula,Bottle,80 ml,synthetic volume ${i}`
      ),
    ].join("\n")
  );
  let maximumPending = 0;
  let peakQueueBytes = 0;
  const original = AsyncStorage.setItem;
  const persist = vi
    .spyOn(AsyncStorage, "setItem")
    .mockImplementation(async (key, value) => {
      if (key === "@sync_queue") {
        maximumPending = Math.max(
          maximumPending,
          JSON.parse(value).operations.length
        );
        peakQueueBytes = Math.max(peakQueueBytes, Buffer.byteLength(value));
      }
      await original(key, value);
    });
  try {
    const before = await client
      .from("feedings")
      .select("id", { count: "exact", head: true })
      .eq("baby_id", babyId);
    expect(before.error).toBeNull();
    const plan = await prepareImport(preview, babyId, userId);
    const rpc = vi.spyOn(client, "rpc");
    rpc.mockClear();
    const result = await importRecords(plan);
    expect(result).toEqual({ added: 3600, alreadyImported: 0 });
    const queued = JSON.parse(store.get("@sync_queue")!).operations;
    expect(
      queued.every(
        (operation: { localMutation?: unknown }) => !operation.localMutation
      )
    ).toBe(true);
    expect(Buffer.byteLength(store.get("@sync_queue")!)).toBeLessThan(
      6 * 1024 * 1024
    );
    const deadline = Date.now() + 180000;
    while (engine.getPendingCount() && Date.now() < deadline) {
      await engine.sync();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(engine.getPendingCount()).toBe(0);
    expect(rpc).toHaveBeenCalledTimes(3600);
    const after = await client
      .from("feedings")
      .select("id", { count: "exact", head: true })
      .eq("baby_id", babyId);
    expect(after.error).toBeNull();
    expect(after.count).toBe((before.count ?? 0) + 3600);
    const again = await prepareImport(preview, babyId, userId);
    expect(await importRecords(again)).toEqual({
      added: 0,
      alreadyImported: 3600,
    });
    expect(rpc).toHaveBeenCalledTimes(3600);
    expect(maximumPending).toBeLessThanOrEqual(50);
    expect(peakQueueBytes).toBeLessThan(2 * 1024 * 1024);
  } finally {
    persist.mockRestore();
  }
}, 240000);
