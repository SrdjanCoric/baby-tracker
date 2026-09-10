import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  errorCode,
  errorText,
  isObservabilitySinkActive,
  recordBreadcrumb,
  reportIssue,
  resetObservabilityIssueLimiter,
  setContextTag,
  setObservabilitySink,
  shouldReportIssue,
  type ObservabilitySink,
} from "@/utils/observability-sink";

function createSink(): ObservabilitySink & {
  reportIssue: ReturnType<typeof vi.fn>;
  addBreadcrumb: ReturnType<typeof vi.fn>;
  setTag: ReturnType<typeof vi.fn>;
} {
  return {
    reportIssue: vi.fn(),
    addBreadcrumb: vi.fn(),
    setTag: vi.fn(),
  };
}

describe("observability sink", () => {
  beforeEach(() => {
    resetObservabilityIssueLimiter();
  });

  afterEach(() => {
    setObservabilitySink(null);
  });

  it("is a silent no-op when no sink is registered", () => {
    expect(isObservabilitySinkActive()).toBe(false);
    expect(() => reportIssue({ name: "sync.push_exhausted", area: "sync" })).not.toThrow();
    expect(() => recordBreadcrumb({ category: "sync", message: "completed" })).not.toThrow();
    expect(() => setContextTag("realtime_connected", true)).not.toThrow();
  });

  it("forwards issues, breadcrumbs, and tags to the registered sink", () => {
    const sink = createSink();
    setObservabilitySink(sink);

    reportIssue({ name: "timers.lock_release_queued", area: "timers", tags: { activityType: "sleep" } });
    recordBreadcrumb({ category: "timers", message: "stop", data: { activityType: "sleep" } });
    setContextTag("realtime_connected", false);

    expect(sink.reportIssue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "timers.lock_release_queued", area: "timers" })
    );
    expect(sink.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: "timers", message: "stop" })
    );
    expect(sink.setTag).toHaveBeenCalledWith("realtime_connected", false);
  });

  it("rate limits repeats of the same issue name per minute", () => {
    const sink = createSink();
    setObservabilitySink(sink);

    for (let i = 0; i < 20; i += 1) {
      reportIssue({ name: "sync.crdt_reconcile_failed", area: "sync" });
    }
    reportIssue({ name: "sync.initialize_failed", area: "sync" });

    expect(sink.reportIssue).toHaveBeenCalledTimes(6);
  });

  it("opens a new window after a minute", () => {
    const start = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      expect(shouldReportIssue("a", start + i)).toBe(true);
    }
    expect(shouldReportIssue("a", start + 10)).toBe(false);
    expect(shouldReportIssue("a", start + 60_000)).toBe(true);
  });

  it("never lets a throwing sink escape", () => {
    setObservabilitySink({
      reportIssue: () => {
        throw new Error("boom");
      },
      addBreadcrumb: () => {
        throw new Error("boom");
      },
      setTag: () => {
        throw new Error("boom");
      },
    });

    expect(() => reportIssue({ name: "x", area: "sync" })).not.toThrow();
    expect(() => recordBreadcrumb({ category: "x", message: "y" })).not.toThrow();
    expect(() => setContextTag("x", "y")).not.toThrow();
  });

  it("summarises errors and extracts low-cardinality codes", () => {
    expect(errorText(new TypeError("bad"))).toBe("TypeError: bad");
    expect(errorText("plain")).toBe("plain");
    expect(errorText(undefined)).toBeUndefined();
    expect(errorText({ message: "obj" })).toContain("obj");

    expect(errorCode({ code: "PGRST116" })).toBe("PGRST116");
    expect(errorCode({ code: 42 })).toBe("42");
    expect(errorCode({ status: 401 })).toBe("401");
    expect(errorCode(new Error("no code"))).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
  });
});
