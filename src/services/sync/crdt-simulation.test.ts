import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { HLC, merge, stampChanges, type ClockedRecord, type FieldClocks } from "./crdt";

/**
 * A minimal in-memory replica: an HLC, a keyed store of clocked records, and an
 * outbox modelling an offline queue. Edits stamp locally; `flush` broadcasts the
 * device's current record snapshots to a peer, which merges them (advancing its own
 * HLC by the incoming clocks first, as the real sync engine will in task 0004).
 */
class Replica {
  readonly store = new Map<string, ClockedRecord>();
  private readonly hlc: HLC;
  private wall: number;

  constructor(
    readonly id: string,
    startWall: number,
  ) {
    this.wall = startWall;
    this.hlc = new HLC({ deviceId: id, clock: () => this.wall });
  }

  advanceWall(delta: number): void {
    this.wall += delta;
  }

  edit(recordId: string, patch: Record<string, unknown>): void {
    const prev = this.store.get(recordId) ?? null;
    const next: ClockedRecord = {
      id: recordId,
      ...(prev ?? {}),
      ...patch,
      fieldClocks: { ...(prev?.fieldClocks ?? {}) },
    };
    this.store.set(recordId, stampChanges(prev, next, () => this.hlc.tick()));
  }

  delete(recordId: string): void {
    this.edit(recordId, { deleted: true });
  }

  private clone(record: ClockedRecord): ClockedRecord {
    return { ...record, fieldClocks: { ...(record.fieldClocks as FieldClocks) } };
  }

  flushTo(peer: Replica): void {
    for (const record of this.store.values()) {
      peer.receive(this.clone(record));
    }
  }

  receive(remote: ClockedRecord): void {
    for (const clock of Object.values(remote.fieldClocks)) {
      this.hlc.receive(clock);
    }
    const id = remote.id as string;
    const local = this.store.get(id);
    this.store.set(id, local ? merge(local, remote) : remote);
  }
}

/** Deliver every replica's full store to every other, enough rounds to fully propagate. */
function settle(replicas: Replica[]): void {
  for (let round = 0; round < replicas.length; round++) {
    for (const source of replicas) {
      for (const target of replicas) {
        if (source !== target) source.flushTo(target);
      }
    }
  }
}

function assertConverged(replicas: Replica[]): void {
  const [first, ...rest] = replicas;
  const reference = Object.fromEntries(first.store);
  for (const replica of rest) {
    expect(Object.fromEntries(replica.store)).toEqual(reference);
  }
}

describe("replica convergence simulation", () => {
  it("two devices creating separate records offline keep both without interference", () => {
    const a = new Replica("device-a", 1000);
    const b = new Replica("device-b", 1000);

    a.edit("rec-a", { notes: "made on a" });
    b.edit("rec-b", { notes: "made on b" });

    settle([a, b]);

    expect(a.store.get("rec-a")?.notes).toBe("made on a");
    expect(a.store.get("rec-b")?.notes).toBe("made on b");
    assertConverged([a, b]);
  });

  it("converges an edit vs concurrent delete on the same record (per-field LWW)", () => {
    const a = new Replica("device-a", 1000);
    const b = new Replica("device-b", 1000);

    a.edit("rec-1", { notes: "v1", deleted: false });
    a.flushTo(b); // both now share the same base

    // Concurrent offline actions: a edits notes, b deletes.
    a.advanceWall(10);
    a.edit("rec-1", { notes: "v2" });
    b.advanceWall(20);
    b.delete("rec-1");

    settle([a, b]);

    assertConverged([a, b]);
    // Per-field LWW: the newer delete wins `deleted`, and the concurrent notes edit
    // survives as a field on the tombstone — convergence alone must not hide a merge
    // that agreed on the wrong value.
    const merged = a.store.get("rec-1");
    expect(merged?.deleted).toBe(true);
    expect(merged?.notes).toBe("v2");
  });

  it("converges under arbitrary interleaved edits, deletes, and offline flushes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 3 }),
        fc.array(
          fc.record({
            device: fc.nat(),
            action: fc.constantFrom("edit", "delete", "flush"),
            recordId: fc.constantFrom("rec-1", "rec-2", "rec-3"),
            field: fc.constantFrom("notes", "amountMl", "side"),
            value: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            target: fc.nat(),
            wallDelta: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 1, maxLength: 60 },
        ),
        (deviceCount, steps) => {
          const replicas = Array.from(
            { length: deviceCount },
            (_unused, index) => new Replica(`device-${index}`, 1000 + index * 3),
          );

          for (const step of steps) {
            const device = replicas[step.device % deviceCount];
            device.advanceWall(step.wallDelta);
            if (step.action === "edit") {
              device.edit(step.recordId, { [step.field]: step.value });
            } else if (step.action === "delete") {
              device.delete(step.recordId);
            } else {
              const target = replicas[step.target % deviceCount];
              if (target !== device) device.flushTo(target);
            }
          }

          settle(replicas);
          assertConverged(replicas);
        },
      ),
    );
  });
});
