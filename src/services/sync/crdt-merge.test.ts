import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { merge, formatClock, EMPTY_CLOCK, type ClockedRecord } from "./crdt";

const FIELD_NAMES = ["notes", "amountMl", "side", "deleted"] as const;

const clockArb = fc
  .record({
    millis: fc.integer({ min: 0, max: 5000 }),
    counter: fc.integer({ min: 0, max: 20 }),
    device: fc.constantFrom("device-a", "device-b", "device-c"),
  })
  .map(({ millis, counter, device }) => formatClock(millis, counter, device));

const valueArb = fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null));

/** Well-formed records: fieldClocks holds an entry only for present, clocked fields. */
const recordArb = fc
  .array(
    fc.record({
      name: fc.constantFrom(...FIELD_NAMES),
      value: valueArb,
      clock: fc.option(clockArb, { nil: EMPTY_CLOCK }),
    }),
    { maxLength: 4 },
  )
  .map((entries) => {
    const byName = new Map<string, { value: unknown; clock: string }>();
    for (const entry of entries) byName.set(entry.name, { value: entry.value, clock: entry.clock });
    const record: ClockedRecord = { fieldClocks: {} };
    for (const [name, { value, clock }] of byName) {
      record[name] = value;
      if (clock !== EMPTY_CLOCK) record.fieldClocks[name] = clock;
    }
    return record;
  });

const foldMerge = (records: ClockedRecord[]): ClockedRecord =>
  records.reduce((acc, record) => merge(acc, record));

const early = formatClock(1000, 0, "device-a");
const late = formatClock(2000, 0, "device-b");

describe("merge", () => {
  it("keeps both sides of disjoint field edits", () => {
    const a: ClockedRecord = {
      notes: "hello",
      amountMl: 100,
      fieldClocks: { notes: late, amountMl: early },
    };
    const b: ClockedRecord = {
      notes: "hello",
      amountMl: 150,
      fieldClocks: { notes: early, amountMl: late },
    };

    const result = merge(a, b);

    expect(result.notes).toBe("hello");
    expect(result.amountMl).toBe(150);
  });

  it("lets the greater clock win a same-field conflict", () => {
    const a: ClockedRecord = { notes: "local", fieldClocks: { notes: early } };
    const b: ClockedRecord = { notes: "remote", fieldClocks: { notes: late } };

    expect(merge(a, b).notes).toBe("remote");
    expect(merge(b, a).notes).toBe("remote");
  });

  it("lets any clocked write beat a legacy field with no clock", () => {
    const legacy: ClockedRecord = { notes: "legacy", fieldClocks: {} };
    const clocked: ClockedRecord = { notes: "clocked", fieldClocks: { notes: early } };

    expect(merge(legacy, clocked).notes).toBe("clocked");
    expect(merge(clocked, legacy).notes).toBe("clocked");
  });

  it("keeps a field present on only one side", () => {
    const a: ClockedRecord = { notes: "hi", fieldClocks: { notes: early } };
    const b: ClockedRecord = { amountMl: 90, fieldClocks: { amountMl: late } };

    const result = merge(a, b);

    expect(result.notes).toBe("hi");
    expect(result.amountMl).toBe(90);
  });

  it("carries the winning clock into the merged record's fieldClocks", () => {
    const a: ClockedRecord = { notes: "local", fieldClocks: { notes: early } };
    const b: ClockedRecord = { notes: "remote", fieldClocks: { notes: late } };

    expect(merge(a, b).fieldClocks.notes).toBe(late);
  });

  it("treats `deleted` as an ordinary LWW field (tombstone wins when newer)", () => {
    const edited: ClockedRecord = {
      notes: "edited",
      deleted: false,
      fieldClocks: { notes: early, deleted: early },
    };
    const tombstone: ClockedRecord = {
      notes: "edited",
      deleted: true,
      fieldClocks: { notes: early, deleted: late },
    };

    expect(merge(edited, tombstone).deleted).toBe(true);
  });

  it("allows un-delete when the later write flips `deleted` back to false", () => {
    const tombstone: ClockedRecord = { deleted: true, fieldClocks: { deleted: early } };
    const revived: ClockedRecord = { deleted: false, fieldClocks: { deleted: late } };

    expect(merge(tombstone, revived).deleted).toBe(false);
  });

  it("breaks an exact millis+counter tie by deviceId embedded in the clock", () => {
    const a: ClockedRecord = {
      notes: "from-a",
      fieldClocks: { notes: formatClock(1000, 0, "device-a") },
    };
    const b: ClockedRecord = {
      notes: "from-b",
      fieldClocks: { notes: formatClock(1000, 0, "device-b") },
    };

    // "device-b" > "device-a" lexicographically, so b wins, order-independently.
    expect(merge(a, b).notes).toBe("from-b");
    expect(merge(b, a).notes).toBe("from-b");
  });

  it("does not alias nested object/array values from its inputs", () => {
    const a: ClockedRecord = {
      tags: ["x"],
      meta: { count: 1 },
      fieldClocks: { tags: late, meta: late },
    };
    const b: ClockedRecord = {
      tags: ["y"],
      meta: { count: 2 },
      fieldClocks: { tags: early, meta: early },
    };

    const result = merge(a, b);

    expect(result.tags).not.toBe(a.tags);
    expect(result.meta).not.toBe(a.meta);
    (result.tags as string[]).push("mutated");
    (result.meta as { count: number }).count = 99;
    expect(a.tags).toEqual(["x"]);
    expect(a.meta).toEqual({ count: 1 });
  });

  it("is the identity when both sides are equal", () => {
    const a: ClockedRecord = {
      notes: "same",
      amountMl: 100,
      fieldClocks: { notes: early, amountMl: late },
    };

    expect(merge(a, { ...a, fieldClocks: { ...a.fieldClocks } })).toEqual(a);
  });

  describe("properties", () => {
    it("is commutative: merge(a, b) ≡ merge(b, a)", () => {
      fc.assert(
        fc.property(recordArb, recordArb, (a, b) => {
          expect(merge(a, b)).toEqual(merge(b, a));
        }),
      );
    });

    it("is associative: merge(merge(a, b), c) ≡ merge(a, merge(b, c))", () => {
      fc.assert(
        fc.property(recordArb, recordArb, recordArb, (a, b, c) => {
          expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)));
        }),
      );
    });

    it("is idempotent: merge(a, a) ≡ a", () => {
      fc.assert(
        fc.property(recordArb, (a) => {
          expect(merge(a, { ...a, fieldClocks: { ...a.fieldClocks } })).toEqual(a);
        }),
      );
    });

    it("converges: any permutation of pairwise merges yields the same result", () => {
      fc.assert(
        fc.property(
          fc.array(fc.tuple(recordArb, fc.integer()), { minLength: 1, maxLength: 6 }),
          (pairs) => {
            const inOrder = pairs.map((pair) => pair[0]);
            const shuffled = [...pairs].sort((x, y) => x[1] - y[1]).map((pair) => pair[0]);
            expect(foldMerge(inOrder)).toEqual(foldMerge(shuffled));
          },
        ),
      );
    });
  });
});
