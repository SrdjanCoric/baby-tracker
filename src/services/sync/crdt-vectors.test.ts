import { describe, it, expect } from "vitest";
import { merge, type ClockedRecord, type FieldClocks } from "./crdt";
import vectorFile from "./crdt-vectors.json";

interface VectorRecord {
  fields: Record<string, unknown>;
  fieldClocks: FieldClocks;
}

interface Vector {
  name: string;
  a: VectorRecord;
  b: VectorRecord;
  expected: VectorRecord;
}

const vectors = (vectorFile as { vectors: Vector[] }).vectors;

function toClockedRecord(record: VectorRecord): ClockedRecord {
  return { ...record.fields, fieldClocks: { ...record.fieldClocks } };
}

function splitResult(record: ClockedRecord): VectorRecord {
  const { fieldClocks, ...fields } = record;
  return { fields, fieldClocks };
}

describe("crdt-vectors.json", () => {
  it("covers every harvested conflict scenario", () => {
    expect(vectors.length).toBeGreaterThanOrEqual(11);
  });

  for (const vector of vectors) {
    it(`TS merge reproduces vector: ${vector.name}`, () => {
      const result = splitResult(merge(toClockedRecord(vector.a), toClockedRecord(vector.b)));
      expect(result).toEqual(vector.expected);
    });

    it(`is order-independent: ${vector.name}`, () => {
      const forward = splitResult(merge(toClockedRecord(vector.a), toClockedRecord(vector.b)));
      const reverse = splitResult(merge(toClockedRecord(vector.b), toClockedRecord(vector.a)));
      expect(forward).toEqual(reverse);
    });
  }
});
