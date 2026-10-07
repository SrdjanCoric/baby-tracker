import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/react-native", () => ({
  init: vi.fn(),
  expoRouterIntegration: vi.fn(),
  setTag: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
vi.mock("@react-native-community/netinfo", () => ({
  default: { addEventListener: vi.fn() },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("observability connectivity", () => {
  it.each(["", "https://example.test/dsn"])(
    "tracks connectivity before sync starts with DSN %s",
    async (dsn) => {
      vi.stubEnv("EXPO_PUBLIC_SENTRY_DSN", dsn);
      const { default: NetInfo } =
        await import("@react-native-community/netinfo");
      const Sentry = await import("@sentry/react-native");
      vi.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
        listener({
          type: "none",
          isConnected: false,
          isInternetReachable: false,
          details: null,
        });
        return vi.fn();
      });
      const sink = await import("@/utils/observability-sink");
      sink.resetObservabilityIssueLimiter();
      const { initObservability } = await import("./observability");
      initObservability();
      initObservability();
      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
      const report = vi.fn();
      if (!dsn)
        sink.setObservabilitySink({
          reportIssue: report,
          addBreadcrumb: vi.fn(),
          setTag: vi.fn(),
        });
      const issue = {
        name: "auth.initialize_failed",
        area: "auth",
        error: new TypeError("Network request failed"),
      };
      sink.reportIssue(issue);
      expect(dsn ? Sentry.captureMessage : report).not.toHaveBeenCalled();
      if (dsn)
        expect(Sentry.setTag).toHaveBeenCalledWith("network_online", "false");
      const listener = vi.mocked(NetInfo.addEventListener).mock.calls[0][0];
      listener({
        type: "wifi",
        isConnected: true,
        isInternetReachable: true,
        details: null,
      });
      sink.reportIssue(issue);
      sink.reportIssue(issue);
      expect(dsn ? Sentry.captureMessage : report).toHaveBeenCalledTimes(1);
      sink.setObservabilitySink(null);
    }
  );
});
