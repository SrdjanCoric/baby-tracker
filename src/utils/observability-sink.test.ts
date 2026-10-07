import { PostgrestClient } from "@supabase/postgrest-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  errorCode,
  errorText,
  isObservabilitySinkActive,
  networkOnlineFromNetInfo,
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

  it("returns whether an issue reached the sink", () => {
    const issue = { name: "timers.pending_lock_release_failed", area: "timers" };
    setObservabilitySink(null);
    expect(reportIssue(issue)).toBe(false);
    const sink = createSink();
    setObservabilitySink(sink);
    setContextTag("network_online", false);
    expect(reportIssue({ ...issue, error: new TypeError("Network request failed") })).toBe(false);
    setContextTag("network_online", true);
    for (let i = 0; i < 5; i++) expect(reportIssue(issue)).toBe(true);
    expect(reportIssue(issue)).toBe(false);
    expect(sink.reportIssue).toHaveBeenCalledTimes(5);
    resetObservabilityIssueLimiter();
    sink.reportIssue.mockImplementation(() => { throw new Error("sink unavailable"); });
    expect(reportIssue(issue)).toBe(false);
  });

  it.each([
    [false, true, false],
    [true, false, false],
    [false, null, false],
    [null, false, false],
    [true, true, true],
    [null, null, null],
    [true, null, null],
    [null, true, null],
    [true, undefined, null],
  ] as const)(
    "maps connectivity %s/%s to %s",
    (isConnected, isInternetReachable, expected) => {
      expect(
        networkOnlineFromNetInfo({ isConnected, isInternetReachable })
      ).toBe(expected);
    }
  );

  it("is a silent no-op when no sink is registered", () => {
    expect(isObservabilitySinkActive()).toBe(false);
    expect(() =>
      reportIssue({ name: "sync.push_exhausted", area: "sync" })
    ).not.toThrow();
    expect(() =>
      recordBreadcrumb({ category: "sync", message: "completed" })
    ).not.toThrow();
    expect(() => setContextTag("realtime_connected", true)).not.toThrow();
  });

  it("forwards issues, breadcrumbs, and tags to the registered sink", () => {
    const sink = createSink();
    setObservabilitySink(sink);

    reportIssue({
      name: "timers.lock_release_queued",
      area: "timers",
      tags: { activityType: "sleep" },
    });
    recordBreadcrumb({
      category: "timers",
      message: "stop",
      data: { activityType: "sleep" },
    });
    setContextTag("realtime_connected", false);

    expect(sink.reportIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "timers.lock_release_queued",
        area: "timers",
      })
    );
    expect(sink.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: "timers", message: "stop" })
    );
    expect(sink.setTag).toHaveBeenCalledWith("realtime_connected", false);
  });

  it.each([false, true, null])(
    "filters channel errors with online state %s",
    (online) => {
      const sink = createSink();
      setObservabilitySink(sink);
      setContextTag("network_online", online);
      for (let i = 0; i < 100; i += 1) {
        reportIssue({ name: "realtime.channel_error", area: "realtime" });
      }
      expect(sink.reportIssue).toHaveBeenCalledTimes(online === false ? 0 : 1);
    }
  );

  it.each([false, true, null])(
    "filters network errors per issue name with online state %s",
    (online) => {
      const sink = createSink();
      setObservabilitySink(sink);
      setContextTag("network_online", online);
      for (const name of ["timers.restore_failed", "timers.lock_load_failed"]) {
        for (let i = 0; i < 100; i += 1) {
          reportIssue({
            name,
            area: "timers",
            error: new TypeError("Network request failed"),
          });
        }
      }
      expect(sink.reportIssue).toHaveBeenCalledTimes(online === false ? 0 : 2);
    }
  );

  it("does not spend the online allowance while offline or reset it on reconnect", () => {
    const sink = createSink();
    setObservabilitySink(sink);
    const issue = { name: "realtime.channel_error", area: "realtime" };
    setContextTag("network_online", false);
    for (let i = 0; i < 100; i += 1) reportIssue(issue);
    setContextTag("network_online", true);
    reportIssue(issue);
    setContextTag("network_online", false);
    reportIssue(issue);
    setContextTag("network_online", true);
    reportIssue(issue);
    expect(sink.reportIssue).toHaveBeenCalledTimes(1);
  });

  it.each([false, true, null])(
    "keeps non-network reporting unchanged with online state %s",
    (online) => {
      const sink = createSink();
      setObservabilitySink(sink);
      setContextTag("network_online", online);
      for (let i = 0; i < 10; i += 1) {
        reportIssue({
          name: "timers.restore_failed",
          area: "timers",
          error: new Error("Invalid timer"),
        });
      }
      expect(sink.reportIssue).toHaveBeenCalledTimes(5);
    }
  );

  it.each([
    new Error("Failed to fetch diapers"),
    { message: "remaining connection slots are reserved", code: "53300" },
    { message: "upstream connect error … connection failure" },
  ])(
    "keeps backend and wrapped failures on the general limiter offline: %s",
    (error) => {
      const sink = createSink();
      setObservabilitySink(sink);
      setContextTag("network_online", false);
      for (let i = 0; i < 10; i += 1) {
        reportIssue({ name: "sync.fetch_failed", area: "sync", error });
      }
      expect(sink.reportIssue).toHaveBeenCalledTimes(5);
    }
  );

  it.each([
    new TypeError("Network request failed"),
    new TypeError("Failed to fetch"),
    new TypeError("Load failed"),
    { name: "AuthRetryableFetchError", message: "request failed" },
  ])(
    "filters strict transport failures offline and dedups online: %s",
    (error) => {
      const sink = createSink();
      setObservabilitySink(sink);
      const issue = { name: "auth.profile_fetch_failed", area: "auth", error };
      setContextTag("network_online", false);
      reportIssue(issue);
      expect(sink.reportIssue).not.toHaveBeenCalled();
      setContextTag("network_online", true);
      reportIssue(issue);
      reportIssue(issue);
      expect(sink.reportIssue).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    new TypeError("Network request timed out"),
    { message: "TypeError: Network request timed out", code: "" },
  ])("filters timed-out transport failures offline and dedups online: %s", (error) => {
    const sink = createSink();
    setObservabilitySink(sink);
    const issue = { name: "timers.restore_failed", area: "timers", error };
    setContextTag("network_online", false);
    reportIssue(issue);
    expect(sink.reportIssue).not.toHaveBeenCalled();
    setContextTag("network_online", true);
    reportIssue(issue);
    reportIssue(issue);
    expect(sink.reportIssue).toHaveBeenCalledTimes(1);
  });

  it("filters the network error object produced by PostgREST", async () => {
    const client = new PostgrestClient("http://localhost/rest/v1", {
      fetch: async () => {
        throw new TypeError("Network request failed");
      },
    });
    const { error } = await client.from("session_locks").select();
    expect(error?.message).toBe("TypeError: Network request failed");
    const sink = createSink();
    setObservabilitySink(sink);
    setContextTag("network_online", false);
    const issue = { name: "timers.lock_load_failed", area: "timers", error };
    reportIssue(issue);
    expect(sink.reportIssue).not.toHaveBeenCalled();
    setContextTag("network_online", true);
    reportIssue(issue);
    reportIssue(issue);
    expect(sink.reportIssue).toHaveBeenCalledTimes(1);
    expect(sink.addBreadcrumb).toHaveBeenCalledTimes(1);
  });

  it("keeps network dedup across time windows and sink registration", () => {
    const sink = createSink();
    setObservabilitySink(sink);
    const issue = {
      name: "timers.restore_failed",
      area: "timers",
      error: new TypeError("Network request failed"),
    };
    reportIssue(issue);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120_000);
    try {
      setObservabilitySink(null);
      setObservabilitySink(sink);
      reportIssue(issue);
      expect(sink.reportIssue).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("leaves breadcrumbs for offline and deduplicated issues", () => {
    const sink = createSink();
    setObservabilitySink(sink);
    const issue = {
      name: "realtime.channel_error",
      area: "realtime",
      level: "warning" as const,
    };
    setContextTag("network_online", false);
    reportIssue(issue);
    setContextTag("network_online", true);
    reportIssue(issue);
    reportIssue(issue);
    expect(sink.reportIssue).toHaveBeenCalledTimes(1);
    expect(sink.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(sink.addBreadcrumb).toHaveBeenCalledWith({
      category: "realtime",
      message: issue.name,
      level: "warning",
      data: { suppressed: 1 },
    });
  });

  it("leaves a breadcrumb when the unchanged general limiter drops an issue", () => {
    const sink = createSink();
    setObservabilitySink(sink);
    for (let i = 0; i < 100; i += 1)
      reportIssue({ name: "auth.failure", area: "auth" });
    expect(sink.reportIssue).toHaveBeenCalledTimes(5);
    expect(sink.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(sink.addBreadcrumb).toHaveBeenCalledWith({
      category: "auth",
      message: "auth.failure",
      level: "error",
      data: { suppressed: 1 },
    });
  });

  it("collapses offline drops and counts suppression since the last breadcrumb", () => {
    const sink = createSink();
    setObservabilitySink(sink);
    setContextTag("network_online", false);
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const issue = { name: "realtime.channel_error", area: "realtime" };
    try {
      for (let i = 0; i < 100; i += 1) reportIssue(issue);
      expect(sink.addBreadcrumb).toHaveBeenCalledTimes(1);
      now.mockReturnValue(1_060_000);
      reportIssue(issue);
      expect(sink.addBreadcrumb).toHaveBeenCalledTimes(2);
      expect(sink.addBreadcrumb).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { suppressed: 100 },
        })
      );
      resetObservabilityIssueLimiter();
      setContextTag("network_online", false);
      reportIssue(issue);
      expect(sink.addBreadcrumb).toHaveBeenCalledTimes(3);
      expect(sink.addBreadcrumb).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { suppressed: 1 },
        })
      );
    } finally {
      now.mockRestore();
    }
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

  it("caps each issue name per session across windows", () => {
    const start = 1_000_000;
    let sent = 0;
    for (let i = 0; i < 25; i += 1) {
      // 25 reports spread over 10 minutes: never more than 3 per window.
      if (shouldReportIssue("a", start + i * 24_000)) sent += 1;
    }
    expect(sent).toBe(20);
    expect(shouldReportIssue("b", start)).toBe(true);
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
    expect(() =>
      recordBreadcrumb({ category: "x", message: "y" })
    ).not.toThrow();
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
