import { describe, it, expect, beforeEach } from "vitest";
import { CrdtSync, isCrdtTable, CRDT_TABLES, reconcileRemoteChange, reconcilePulledRows } from "./crdt-sync";
import { MemoryClockStorage, type ClockedRecord } from "./crdt";
import type { ShadowStore } from "./crdt-sync";

class MemoryShadowStore implements ShadowStore {
  private map = new Map<string, ClockedRecord>();
  async get(key: string): Promise<ClockedRecord | null> {
    const v = this.map.get(key);
    return v ? (JSON.parse(JSON.stringify(v)) as ClockedRecord) : null;
  }
  async set(key: string, record: ClockedRecord): Promise<void> {
    this.map.set(key, JSON.parse(JSON.stringify(record)) as ClockedRecord);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

function makeSync(deviceId: string, clock: () => number): CrdtSync {
  return new CrdtSync({
    deviceId,
    clockStorage: new MemoryClockStorage(),
    shadowStore: new MemoryShadowStore(),
    clock,
  });
}

describe("isCrdtTable", () => {
  it("recognizes the 9 in-scope tables and rejects out-of-scope ones", () => {
    expect(CRDT_TABLES).toHaveLength(9);
    expect(isCrdtTable("feedings")).toBe(true);
    expect(isCrdtTable("milestone_responses")).toBe(true);
    expect(isCrdtTable("babies")).toBe(true);
    expect(isCrdtTable("active_timers")).toBe(false);
    expect(isCrdtTable("activity_goals")).toBe(false);
    expect(isCrdtTable("users")).toBe(false);
  });
});

describe("CrdtSync.stampWrite", () => {
  let sync: CrdtSync;
  let now: number;
  beforeEach(() => {
    now = 1_000_000;
    sync = makeSync("devA", () => now);
  });

  it("stamps every field on a first create", async () => {
    const clocks = await sync.stampWrite("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 100,
    });
    expect(Object.keys(clocks).sort()).toEqual(["amount_ml", "baby_id", "id"]);
    for (const c of Object.values(clocks)) {
      expect(c).toContain("devA");
    }
  });

  it("re-stamps only changed fields on an update, with a strictly newer clock", async () => {
    const createClocks = await sync.stampWrite("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 100,
    });
    now += 1000;
    const updateClocks = await sync.stampWrite("feedings", "f1", {
      amount_ml: 150,
      updated_at: "t2",
    });
    expect(Object.keys(updateClocks).sort()).toEqual(["amount_ml", "updated_at"]);
    expect(updateClocks.amount_ml > createClocks.amount_ml).toBe(true);
  });
});

describe("CrdtSync.reconcileRemote", () => {
  it("keeps a local field whose clock is newer than an incoming remote update", async () => {
    let now = Date.parse("2026-07-04T12:00:00.000Z");
    const sync = makeSync("devLocal", () => now);

    // Local optimistic edit stamps amount_ml at a late clock.
    await sync.stampWrite("feedings", "f1", { id: "f1", baby_id: "b1", amount_ml: 999 });
    now += 1000;
    const localClock = (await sync.stampWrite("feedings", "f1", { amount_ml: 998 })).amount_ml;

    // A remote update carrying an OLDER clock arrives.
    const merged = await sync.reconcileRemote("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 111,
      field_clocks: {
        amount_ml: "2020-01-01T00:00:00.000Z-0000-devRemote",
      },
    });

    expect(merged.amount_ml).toBe(998);
    expect((merged.field_clocks as Record<string, string>).amount_ml).toBe(localClock);
  });

  it("accepts a remote field whose clock is newer than local", async () => {
    const now = 1000;
    const sync = makeSync("devLocal", () => now);
    await sync.stampWrite("feedings", "f1", { id: "f1", baby_id: "b1", amount_ml: 100 });

    const merged = await sync.reconcileRemote("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 250,
      field_clocks: {
        amount_ml: "2999-01-01T00:00:00.000Z-0000-devRemote",
      },
    });
    expect(merged.amount_ml).toBe(250);
  });

  it("merges field-wise when each side wins a different field", async () => {
    let now = Date.parse("2026-07-04T12:00:00.000Z");
    const sync = makeSync("devLocal", () => now);
    await sync.stampWrite("feedings", "f1", { id: "f1", baby_id: "b1", amount_ml: 100, notes: "local" });
    now += 1000;
    const localNotesClock = (await sync.stampWrite("feedings", "f1", { notes: "local-edit" })).notes;

    const merged = await sync.reconcileRemote("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 250,
      notes: "remote",
      field_clocks: {
        amount_ml: "2999-01-01T00:00:00.000Z-0000-devRemote", // remote wins amount
        notes: "2020-01-01T00:00:00.000Z-0000-devRemote", // local wins notes
      },
    });
    expect(merged.amount_ml).toBe(250);
    expect(merged.notes).toBe("local-edit");
    expect((merged.field_clocks as Record<string, string>).notes).toBe(localNotesClock);
  });

  it("does not create a shadow for a record the device never edited locally", async () => {
    const now = 1000;
    const sync = makeSync("devLocal", () => now);
    await sync.reconcileRemote("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 42,
      field_clocks: { amount_ml: "2999-01-01T00:00:00.000Z-0000-devRemote" },
    });
    // No local edit to protect → no shadow persisted (avoids per-row bloat on full pulls).
    expect(await sync.getShadow("feedings", "f1")).toBeNull();
  });

  it("advances the local HLC past an incoming remote clock (causality)", async () => {
    const now = 1000;
    const sync = makeSync("devLocal", () => now);
    const futureRemote = "2999-01-01T00:00:00.000Z-0000-devRemote";
    await sync.reconcileRemote("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 1,
      field_clocks: { amount_ml: futureRemote },
    });
    // A subsequent local write must sort after the remote clock it just observed.
    const next = await sync.stampWrite("feedings", "f2", { id: "f2", baby_id: "b1", amount_ml: 2 });
    expect(next.amount_ml > futureRemote).toBe(true);
  });

  it("reconcileRemoteChange rewrites an in-scope UPDATE's row, preserving newer local fields", async () => {
    let now = Date.parse("2026-07-04T12:00:00.000Z");
    const sync = makeSync("devLocal", () => now);
    await sync.stampWrite("feedings", "f1", { id: "f1", baby_id: "b1", notes: "local" });
    now += 1000;
    await sync.stampWrite("feedings", "f1", { notes: "local-edit" });

    const change = {
      table: "feedings",
      eventType: "UPDATE" as const,
      new: {
        id: "f1",
        baby_id: "b1",
        notes: "stale-remote",
        field_clocks: { notes: "2020-01-01T00:00:00.000Z-0000-devRemote" },
      },
    };
    const out = await reconcileRemoteChange(sync, change);
    expect(out.new?.notes).toBe("local-edit");
  });

  it("reconcileRemoteChange leaves an out-of-scope change untouched", async () => {
    const now = 1000;
    const sync = makeSync("devLocal", () => now);
    const change = {
      table: "active_timers",
      eventType: "UPDATE" as const,
      new: { id: "t1", baby_id: "b1", state: "running" },
    };
    const out = await reconcileRemoteChange(sync, change);
    expect(out).toBe(change);
    expect(out.new?.state).toBe("running");
  });

  it("reconcileRemoteChange forgets the shadow on an in-scope DELETE", async () => {
    const now = 1000;
    const sync = makeSync("devLocal", () => now);
    await sync.stampWrite("feedings", "f1", { id: "f1", baby_id: "b1", amount_ml: 100 });
    await reconcileRemoteChange(sync, {
      table: "feedings",
      eventType: "DELETE",
      old: { id: "f1" },
    });
    // Shadow gone: a later older-clock remote now wins outright.
    const merged = await sync.reconcileRemote("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 5,
      field_clocks: { amount_ml: "2000-01-01T00:00:00.000Z-0000-devRemote" },
    });
    expect(merged.amount_ml).toBe(5);
  });

  it("reconcilePulledRows preserves a newer local field and passes untouched rows through", async () => {
    let now = Date.parse("2026-07-04T12:00:00.000Z");
    const sync = makeSync("devLocal", () => now);
    // Local optimistic edit on f1.notes (has a shadow); f2 was never edited locally.
    await sync.stampWrite("feedings", "f1", { id: "f1", baby_id: "b1", notes: "local" });
    now += 1000;
    await sync.stampWrite("feedings", "f1", { notes: "local-edit" });

    const merged = await reconcilePulledRows(sync, "feedings", [
      {
        id: "f1",
        baby_id: "b1",
        notes: "stale-remote",
        field_clocks: { notes: "2020-01-01T00:00:00.000Z-0000-devRemote" },
      },
      {
        id: "f2",
        baby_id: "b1",
        amount_ml: 7,
        field_clocks: { amount_ml: "2999-01-01T00:00:00.000Z-0000-devRemote" },
      },
    ]);

    expect(merged[0].notes).toBe("local-edit"); // newer local edit preserved
    expect(merged[1].amount_ml).toBe(7); // never-edited row passes through
    expect(await sync.getShadow("feedings", "f2")).toBeNull(); // no shadow bloat for f2
  });

  it("reconcilePulledRows feeds pulled clocks into the HLC so later local edits sort after", async () => {
    const now = 1000;
    const sync = makeSync("devLocal", () => now);
    const futureRemote = "2999-01-01T00:00:00.000Z-0000-devRemote";
    await reconcilePulledRows(sync, "feedings", [
      { id: "f1", baby_id: "b1", amount_ml: 1, field_clocks: { amount_ml: futureRemote } },
    ]);
    const next = await sync.stampWrite("feedings", "f2", { id: "f2", baby_id: "b1", amount_ml: 2 });
    expect(next.amount_ml > futureRemote).toBe(true);
  });

  it("forgets a record's shadow so a later reconcile starts clean", async () => {
    const now = 1000;
    const sync = makeSync("devLocal", () => now);
    await sync.stampWrite("feedings", "f1", { id: "f1", baby_id: "b1", amount_ml: 100 });
    await sync.forget("feedings", "f1");

    // With the shadow forgotten, an older remote now wins (no local clock to beat it).
    const merged = await sync.reconcileRemote("feedings", "f1", {
      id: "f1",
      baby_id: "b1",
      amount_ml: 7,
      field_clocks: { amount_ml: "2000-01-01T00:00:00.000Z-0000-devRemote" },
    });
    expect(merged.amount_ml).toBe(7);
  });
});
