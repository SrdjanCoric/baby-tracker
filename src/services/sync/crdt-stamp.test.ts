import { describe, it, expect } from "vitest";
import { stampChanges } from "./crdt";

/** Deterministic clock issuer: c1, c2, c3, … so assertions can name exact clocks. */
function sequentialIssuer(): () => string {
  let n = 0;
  return () => `c${++n}`;
}

describe("stampChanges", () => {
  it("stamps a fresh clock only for changed fields and keeps existing clocks for unchanged ones", () => {
    const prev = {
      notes: "old",
      amountMl: 100,
      fieldClocks: { notes: "c0-notes", amountMl: "c0-amount" },
    };
    const next = { notes: "new", amountMl: 100, fieldClocks: { ...prev.fieldClocks } };

    const stamped = stampChanges(prev, next, sequentialIssuer());

    expect(stamped.fieldClocks.notes).toBe("c1");
    expect(stamped.fieldClocks.amountMl).toBe("c0-amount");
  });

  it("stamps newly added fields", () => {
    const prev = { notes: "hi", fieldClocks: { notes: "c0-notes" } };
    const next = { notes: "hi", amountMl: 50, fieldClocks: { ...prev.fieldClocks } };

    const stamped = stampChanges(prev, next, sequentialIssuer());

    expect(stamped.fieldClocks.notes).toBe("c0-notes");
    expect(stamped.fieldClocks.amountMl).toBe("c1");
  });

  it("never treats fieldClocks itself as a data field", () => {
    const prev = { notes: "hi", fieldClocks: { notes: "c0-notes" } };
    const next = { notes: "hi", fieldClocks: { notes: "c0-notes" } };

    const stamped = stampChanges(prev, next, sequentialIssuer());

    expect(stamped.fieldClocks).toEqual({ notes: "c0-notes" });
  });

  it("treats a null prev as a fresh create and stamps every field", () => {
    const next = { notes: "hi", amountMl: 30, fieldClocks: {} };

    const stamped = stampChanges(null, next, sequentialIssuer());

    expect(stamped.fieldClocks.notes).toBe("c1");
    expect(stamped.fieldClocks.amountMl).toBe("c2");
  });

  it("does not stamp fields named in ignoreFields even when they change", () => {
    const prev = { notes: "hi", updatedAt: "t0", fieldClocks: { notes: "c0-notes" } };
    const next = { notes: "hi", updatedAt: "t1", fieldClocks: { notes: "c0-notes" } };

    const stamped = stampChanges(prev, next, sequentialIssuer(), {
      ignoreFields: ["updatedAt"],
    });

    expect(stamped.fieldClocks.updatedAt).toBeUndefined();
  });

  it("drops the clock for a field removed in next", () => {
    const prev = {
      notes: "hi",
      amountMl: 100,
      fieldClocks: { notes: "c0-notes", amountMl: "c0-amount" },
    };
    const next = { notes: "hi", fieldClocks: { ...prev.fieldClocks } };

    const stamped = stampChanges(prev, next, sequentialIssuer());

    expect(stamped.fieldClocks.amountMl).toBeUndefined();
    expect(stamped.fieldClocks.notes).toBe("c0-notes");
  });
});
