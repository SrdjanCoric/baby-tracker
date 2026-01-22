import { describe, it, expect } from "vitest";
import { getNavigationRoute } from "./notification-routes";
import type { NotificationData } from "@/types/notifications";

describe("NotificationRoutes", () => {
  describe("getNavigationRoute", () => {
    it("should return feeding route for feeding_reminder", () => {
      const data: NotificationData = {
        type: "feeding_reminder",
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)/feeding");
    });

    it("should return activity route for timer_alert with feeding", () => {
      const data: NotificationData = {
        type: "timer_alert",
        activityType: "feeding",
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)/feeding");
    });

    it("should return activity route for timer_alert with pumping", () => {
      const data: NotificationData = {
        type: "timer_alert",
        activityType: "pumping",
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)/pumping");
    });

    it("should return activity route for timer_alert with sleep", () => {
      const data: NotificationData = {
        type: "timer_alert",
        activityType: "sleep",
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)/sleep");
    });

    it("should return activity route for timer_alert with tummyTime", () => {
      const data: NotificationData = {
        type: "timer_alert",
        activityType: "tummyTime",
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)/tummyTime");
    });

    it("should return activity route for timer_alert with diaper", () => {
      const data: NotificationData = {
        type: "timer_alert",
        activityType: "diaper",
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)/diaper");
    });

    it("should return home for unknown type", () => {
      const data = {
        type: "unknown" as NotificationData["type"],
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)");
    });

    it("should return home for timer_alert without activityType", () => {
      const data: NotificationData = {
        type: "timer_alert",
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)");
    });

    it("should return home for timer_alert with unknown activityType", () => {
      const data: NotificationData = {
        type: "timer_alert",
        activityType: "unknown",
      };

      const route = getNavigationRoute(data);

      expect(route).toBe("/(tabs)");
    });
  });
});
