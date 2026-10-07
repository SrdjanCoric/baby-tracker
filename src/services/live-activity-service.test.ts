import { afterEach, expect, it, vi } from "vitest";
import { resetObservabilityIssueLimiter, setObservabilitySink } from "@/utils/observability-sink";

const { bind } = vi.hoisted(() => ({ bind: vi.fn() }));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: { LiveActivityController: { bindTimerActivity: bind } },
}));
import { bindTimerLiveActivity } from "./live-activity-service";

afterEach(() => { setObservabilitySink(null); vi.restoreAllMocks(); });

it("reports one failed Live Activity bind without exposing timer identity", async () => {
  const sink = { reportIssue: vi.fn(), addBreadcrumb: vi.fn(), setTag: vi.fn() };
  resetObservabilityIssueLimiter();
  setObservabilitySink(sink);
  vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new Error("native bind failed");
  bind.mockRejectedValue(error);
  await bindTimerLiveActivity("private-activity", {
    babyId: "private-baby", timerInstanceId: "private-run", userId: "private-user",
  });
  expect(sink.reportIssue).toHaveBeenCalledExactlyOnceWith({
    name: "live_activity.operation_failed", area: "live_activity",
    level: "warning", error, tags: { op: "bind" },
  });
});
