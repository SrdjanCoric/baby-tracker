import { describe, expect, it, vi } from "vitest";
import {
  ActivityRangeLoader,
  type UtcActivityRange,
} from "./activity-range-loader";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const firstDay: UtcActivityRange = {
  start: "2026-01-01T00:00:00.000Z",
  end: "2026-01-02T00:00:00.000Z",
};

const twoDays: UtcActivityRange = {
  start: firstDay.start,
  end: "2026-01-03T00:00:00.000Z",
};

describe("ActivityRangeLoader", () => {
  it("reuses in-flight coverage and requests only the missing part of an overlapping interval", async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const fetchRange = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const accepted: string[][] = [];
    const loader = new ActivityRangeLoader(fetchRange, (entries) => accepted.push(entries));

    const firstRequest = loader.load(firstDay);
    const overlappingRequest = loader.load(twoDays);

    expect(fetchRange.mock.calls).toEqual([
      [firstDay],
      [{ start: firstDay.end, end: twoDays.end }],
    ]);
    expect(loader.status(twoDays)).toBe("loading");

    first.resolve(["first"]);
    second.resolve(["second"]);
    await Promise.all([firstRequest, overlappingRequest]);

    expect(accepted).toEqual([["first"], ["second"]]);
    expect(loader.status(twoDays)).toBe("loaded");

    await loader.load(twoDays);
    expect(fetchRange).toHaveBeenCalledTimes(2);
  });

  it("marks failed coverage retryable and verifies it after a successful retry", async () => {
    const fetchRange = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(["recovered"]);
    const accepted: string[][] = [];
    const loader = new ActivityRangeLoader(fetchRange, (entries) => accepted.push(entries));

    await expect(loader.load(firstDay)).rejects.toThrow("offline");
    expect(loader.status(firstDay)).toBe("error");

    await loader.load(firstDay);

    expect(loader.status(firstDay)).toBe("loaded");
    expect(accepted).toEqual([["recovered"]]);
  });

  it("does not publish caller-local failures to shared range status", async () => {
    const loader = new ActivityRangeLoader(
      vi.fn().mockRejectedValue(new Error("offline")),
      vi.fn()
    );

    await expect(
      loader.load(firstDay, { failureState: "caller" })
    ).rejects.toThrow("offline");

    expect(loader.status(firstDay)).toBe("unverified");
  });

  it("ignores completion from a reset baby or storage scope", async () => {
    const pending = deferred<string[]>();
    const accepted: string[][] = [];
    const loader = new ActivityRangeLoader(
      () => pending.promise,
      (entries) => accepted.push(entries)
    );

    const loading = loader.load(firstDay);
    loader.reset();
    pending.resolve(["stale"]);
    await loading;

    expect(accepted).toEqual([]);
    expect(loader.status(firstDay)).toBe("unverified");
  });
});
