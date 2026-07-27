import { describe, it, expect } from "vitest";
import { CrdtSync, type ShadowStore } from "./crdt-sync";
import { merge, MemoryClockStorage, type ClockedRecord, type FieldClocks } from "./crdt";

/**
 * End-to-end convergence simulation driving the REAL sync-layer entry points
 * (`CrdtSync.stampWrite` on save, `CrdtSync.reconcileRemote` on receive) against a mock
 * server that applies the same `merge_record` semantics the SQL RPC does. This is the
 * slice the pure-primitive `crdt-simulation.test.ts` cannot cover: it exercises the
 * shadow store, the outgoing clock stamping, and the incoming merge exactly as the app
 * wires them — with Supabase mocked at the RPC boundary.
 */

class MemoryShadowStore implements ShadowStore {
  private map = new Map<string, ClockedRecord>();
  async get(key: string) {
    const v = this.map.get(key);
    return v ? (JSON.parse(JSON.stringify(v)) as ClockedRecord) : null;
  }
  async set(key: string, record: ClockedRecord) {
    this.map.set(key, JSON.parse(JSON.stringify(record)) as ClockedRecord);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
}

/** Twin of the `merge_record` RPC: per-field LWW merge of the incoming record+clocks
 * into the stored row, returning the merged wire row. */
class MockServer {
  rows = new Map<string, ClockedRecord>();

  mergeRecord(table: string, record: Record<string, unknown>, clocks: FieldClocks): Record<string, unknown> {
    const key = `${table}:${record.id}`;
    const incoming: ClockedRecord = { ...record, fieldClocks: clocks };
    const existing = this.rows.get(key);
    const merged = existing ? merge(existing, incoming) : incoming;
    this.rows.set(key, merged);
    const { fieldClocks, ...data } = merged;
    return { ...data, field_clocks: fieldClocks };
  }

  row(table: string, id: string): Record<string, unknown> | null {
    const merged = this.rows.get(`${table}:${id}`);
    if (!merged) return null;
    const { fieldClocks, ...data } = merged;
    return { ...data, field_clocks: fieldClocks };
  }
}

interface OutboxEntry {
  table: string;
  id: string;
  record: Record<string, unknown>;
  clocks: FieldClocks;
}

/** A device: a real CrdtSync plus an offline outbox modelling the persistent sync queue. */
class Device {
  readonly crdt: CrdtSync;
  private outbox: OutboxEntry[] = [];

  constructor(id: string, startWall: number) {
    let wall = startWall;
    this.crdt = new CrdtSync({
      deviceId: id,
      clockStorage: new MemoryClockStorage(),
      shadowStore: new MemoryShadowStore(),
      clock: () => wall++,
    });
  }

  /** Local save: stamp the change and queue it for the server (offline-safe). */
  async edit(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
    const record = { id, ...patch };
    const clocks = await this.crdt.stampWrite(table as never, id, record);
    this.outbox.push({ table, id, record, clocks });
  }

  /** Flush the outbox to the server (reconnect). Returns the server rows produced. */
  async flush(server: MockServer): Promise<Record<string, unknown>[]> {
    const pushed: Record<string, unknown>[] = [];
    for (const entry of this.outbox) {
      pushed.push(server.mergeRecord(entry.table, entry.record, entry.clocks));
    }
    this.outbox = [];
    return pushed;
  }

  /** Receive a server row over Realtime and merge it into local state. */
  async receive(table: string, row: Record<string, unknown>): Promise<void> {
    await this.crdt.reconcileRemote(table as never, row.id as string, row);
  }

  async view(table: string, id: string): Promise<Record<string, unknown> | null> {
    const shadow = await this.crdt.getShadow(table as never, id);
    if (!shadow) return null;
    const { fieldClocks: _fieldClocks, ...data } = shadow;
    return data;
  }
}

/** Deliver each pushed server row to every device (Realtime fan-out), then re-broadcast
 * the server's final row so every device converges. */
async function broadcast(server: MockServer, table: string, id: string, devices: Device[]): Promise<void> {
  const row = server.row(table, id);
  if (!row) return;
  for (const device of devices) {
    await device.receive(table, row);
  }
}

describe("CRDT sync-layer convergence (real entry points, mock RPC)", () => {
  it("offline edit vs concurrent remote edit of the same record: neither edit is lost", async () => {
    const server = new MockServer();
    const a = new Device("device-a", 1000);
    const b = new Device("device-b", 2000);

    // Shared base: A creates the record and it propagates to B.
    await a.edit("feedings", "f1", { baby_id: "x", notes: "base", amount_ml: 10 });
    await a.flush(server);
    await broadcast(server, "feedings", "f1", [a, b]);

    // Concurrent: A edits amount_ml OFFLINE; B edits notes and syncs immediately.
    await a.edit("feedings", "f1", { amount_ml: 50 });
    await b.edit("feedings", "f1", { notes: "b-note" });
    await b.flush(server);
    await broadcast(server, "feedings", "f1", [a, b]);

    // A reconnects and flushes its offline edit; server merges per-field.
    await a.flush(server);
    await broadcast(server, "feedings", "f1", [a, b]);

    const viewA = await a.view("feedings", "f1");
    const viewB = await b.view("feedings", "f1");

    // Both edits survive on both devices, and the two devices agree.
    expect(viewA?.amount_ml).toBe(50);
    expect(viewA?.notes).toBe("b-note");
    expect(viewA).toEqual(viewB);
    expect(server.row("feedings", "f1")).toMatchObject({ amount_ml: 50, notes: "b-note" });
  });

  it("two caregivers converge on the newer milestone clear or recheck", async () => {
    const server = new MockServer();
    const firstCaregiver = new Device("caregiver-a", 1000);
    const secondCaregiver = new Device("caregiver-b", 2000);
    const devices = [firstCaregiver, secondCaregiver];

    await firstCaregiver.edit("milestone_responses", "response-1", {
      baby_id: "baby-1",
      milestone_id: "2m-social-1",
      state: "yes",
      deleted: false,
    });
    await firstCaregiver.flush(server);
    await broadcast(server, "milestone_responses", "response-1", devices);

    await firstCaregiver.edit("milestone_responses", "response-1", { deleted: true });
    await secondCaregiver.edit("milestone_responses", "response-1", {
      state: "not_sure",
      deleted: false,
    });

    await secondCaregiver.flush(server);
    await firstCaregiver.flush(server);
    await broadcast(server, "milestone_responses", "response-1", devices);

    const firstView = await firstCaregiver.view("milestone_responses", "response-1");
    const secondView = await secondCaregiver.view("milestone_responses", "response-1");
    expect(firstView).toEqual(secondView);
    expect(firstView).toMatchObject({ state: "not_sure", deleted: false });
    expect(server.rows).toHaveLength(1);
  });

  it("three devices editing different fields of one record all converge", async () => {
    const server = new MockServer();
    const devices = [new Device("d0", 1000), new Device("d1", 1500), new Device("d2", 2000)];

    await devices[0].edit("feedings", "f1", { baby_id: "x", a: 1, b: 1, c: 1 });
    await devices[0].flush(server);
    await broadcast(server, "feedings", "f1", devices);

    await devices[0].edit("feedings", "f1", { a: 100 });
    await devices[1].edit("feedings", "f1", { b: 200 });
    await devices[2].edit("feedings", "f1", { c: 300 });

    for (const d of devices) await d.flush(server);
    await broadcast(server, "feedings", "f1", devices);

    const views = await Promise.all(devices.map((d) => d.view("feedings", "f1")));
    expect(views[0]).toEqual(views[1]);
    expect(views[1]).toEqual(views[2]);
    expect(views[0]).toMatchObject({ a: 100, b: 200, c: 300 });
  });
});
