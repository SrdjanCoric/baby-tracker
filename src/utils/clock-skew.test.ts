import { describe, expect, it } from "vitest";
import { clockSkewBucket, computeClockSkew } from "@/utils/clock-skew";

describe("clock skew", () => {
  const serverIso = "Wed, 10 Sep 2026 10:00:00 GMT";
  const serverMs = Date.parse(serverIso);

  it("returns null without a usable Date header", () => {
    expect(computeClockSkew(0, 10, null)).toBeNull();
    expect(computeClockSkew(0, 10, "")).toBeNull();
    expect(computeClockSkew(0, 10, "not a date")).toBeNull();
  });

  it("measures skew against the request midpoint", () => {
    const start = serverMs - 200;
    const end = serverMs + 200;
    const sample = computeClockSkew(start, end, serverIso);
    expect(sample).toEqual({ skewMs: 0, roundTripMs: 400 });
  });

  it("reports a device running three minutes behind as positive skew", () => {
    const start = serverMs - 180_000;
    const sample = computeClockSkew(start, start, serverIso);
    expect(sample?.skewMs).toBe(180_000);
  });

  it("buckets skew into low-cardinality values", () => {
    expect(clockSkewBucket(1_000)).toBe("ok");
    expect(clockSkewBucket(-30_000)).toBe("minor");
    expect(clockSkewBucket(120_000)).toBe("minutes");
    expect(clockSkewBucket(-3_600_000)).toBe("severe");
  });
});
