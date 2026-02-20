import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeParseArray, safeParseObject, safeGetArray, safeGetObject } from "./safe-json";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("safeParseArray", () => {
  it("parses valid JSON array", () => {
    const result = safeParseArray<{ id: string }>('[{"id":"1"},{"id":"2"}]');
    expect(result).toEqual([{ id: "1" }, { id: "2" }]);
  });

  it("returns empty array for empty JSON array", () => {
    expect(safeParseArray("[]")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(safeParseArray("")).toEqual([]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(safeParseArray("{broken")).toEqual([]);
  });

  it("returns empty array when JSON is not an array (object)", () => {
    expect(safeParseArray('{"key":"value"}')).toEqual([]);
  });

  it("returns empty array when JSON is a string", () => {
    expect(safeParseArray('"hello"')).toEqual([]);
  });

  it("returns empty array when JSON is a number", () => {
    expect(safeParseArray("42")).toEqual([]);
  });

  it("returns empty array when JSON is null", () => {
    expect(safeParseArray("null")).toEqual([]);
  });

  it("returns empty array when JSON is boolean", () => {
    expect(safeParseArray("true")).toEqual([]);
  });

  it("logs warning with context on parse error", () => {
    safeParseArray("{broken}", "testContext");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("testContext"),
      expect.anything()
    );
  });

  it("logs warning with context on wrong type", () => {
    safeParseArray('"hello"', "testContext");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("testContext")
    );
  });
});

describe("safeParseObject", () => {
  it("parses valid JSON object", () => {
    const result = safeParseObject<{ id: string; name: string }>(
      '{"id":"1","name":"test"}'
    );
    expect(result).toEqual({ id: "1", name: "test" });
  });

  it("returns null for empty string", () => {
    expect(safeParseObject("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(safeParseObject("{broken}")).toBeNull();
  });

  it("returns null when JSON is an array", () => {
    expect(safeParseObject("[1,2,3]")).toBeNull();
  });

  it("returns null when JSON is a string", () => {
    expect(safeParseObject('"hello"')).toBeNull();
  });

  it("returns null when JSON is a number", () => {
    expect(safeParseObject("42")).toBeNull();
  });

  it("returns null when JSON is null literal", () => {
    expect(safeParseObject("null")).toBeNull();
  });

  it("returns null when JSON is boolean", () => {
    expect(safeParseObject("true")).toBeNull();
  });

  it("logs warning with context on parse error", () => {
    safeParseObject("{broken}", "timerContext");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("timerContext"),
      expect.anything()
    );
  });

  it("logs warning with context on wrong type (array)", () => {
    safeParseObject("[1,2]", "timerContext");
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("timerContext")
    );
  });
});

describe("safeGetArray", () => {
  it("returns empty array when AsyncStorage returns null", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    const result = await safeGetArray("@test_key");
    expect(result).toEqual([]);
  });

  it("parses valid stored JSON array", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue('[{"id":"1"}]');
    const result = await safeGetArray<{ id: string }>("@test_key");
    expect(result).toEqual([{ id: "1" }]);
  });

  it("returns empty array for corrupted storage data", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("corrupted");
    const result = await safeGetArray("@test_key");
    expect(result).toEqual([]);
  });
});

describe("safeGetObject", () => {
  it("returns null when AsyncStorage returns null", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    const result = await safeGetObject("@test_key");
    expect(result).toBeNull();
  });

  it("parses valid stored JSON object", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue('{"startedAt":"2024-01-01"}');
    const result = await safeGetObject<{ startedAt: string }>("@test_key");
    expect(result).toEqual({ startedAt: "2024-01-01" });
  });

  it("returns null for corrupted storage data", async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue("corrupted");
    const result = await safeGetObject("@test_key");
    expect(result).toBeNull();
  });
});
