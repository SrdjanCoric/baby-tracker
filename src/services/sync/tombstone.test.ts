import { describe, it, expect } from "vitest";
import { tombstonedId, upsertById, dropTombstoned } from "./tombstone";
import type { RemoteChange } from "./real-time-sync";

function change(partial: Partial<RemoteChange>): RemoteChange {
  return { table: "feedings", eventType: "UPDATE", new: null, old: null, ...partial };
}

describe("tombstonedId", () => {
  it("returns the id when an UPDATE row carries deleted: true (tombstone)", () => {
    const c = change({ eventType: "UPDATE", new: { id: "f1", deleted: true } });
    expect(tombstonedId(c)).toBe("f1");
  });

  it("returns the id when an INSERT row is created already tombstoned", () => {
    const c = change({ eventType: "INSERT", new: { id: "f2", deleted: true } });
    expect(tombstonedId(c)).toBe("f2");
  });

  it("returns the old id for a legacy hard-delete event", () => {
    const c = change({ eventType: "DELETE", new: null, old: { id: "f3" } });
    expect(tombstonedId(c)).toBe("f3");
  });

  it("returns null for a live UPDATE with deleted: false (a restore or ordinary edit)", () => {
    const c = change({ eventType: "UPDATE", new: { id: "f4", deleted: false } });
    expect(tombstonedId(c)).toBeNull();
  });

  it("returns null for a live UPDATE with no deleted field", () => {
    const c = change({ eventType: "UPDATE", new: { id: "f5", amount_ml: 120 } });
    expect(tombstonedId(c)).toBeNull();
  });

  it("returns null for a live INSERT", () => {
    const c = change({ eventType: "INSERT", new: { id: "f6" } });
    expect(tombstonedId(c)).toBeNull();
  });
});

describe("upsertById", () => {
  it("appends an item whose id is not present (restore an un-deleted record)", () => {
    const list = [{ id: "a", v: 1 }];
    const next = upsertById(list, { id: "b", v: 2 });
    expect(next.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("replaces an existing item in place, preserving order", () => {
    const list = [{ id: "a", v: 1 }, { id: "b", v: 2 }];
    const next = upsertById(list, { id: "a", v: 9 });
    expect(next).toEqual([{ id: "a", v: 9 }, { id: "b", v: 2 }]);
  });

  it("does not mutate the input list", () => {
    const list = [{ id: "a", v: 1 }];
    upsertById(list, { id: "a", v: 9 });
    expect(list).toEqual([{ id: "a", v: 1 }]);
  });
});

describe("dropTombstoned", () => {
  it("removes rows with deleted === true, keeps the rest", () => {
    const rows = [
      { id: "a", deleted: false },
      { id: "b", deleted: true },
      { id: "c" },
    ];
    expect(dropTombstoned(rows).map((r) => r.id)).toEqual(["a", "c"]);
  });
});
