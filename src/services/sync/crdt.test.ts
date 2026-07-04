import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  HLC,
  MemoryClockStorage,
  formatClock,
  parseClock,
  compareClocks,
} from "./crdt";

const DEVICE = "device-a";

describe("HLC", () => {
  describe("clock format", () => {
    it("formats as <ISO-8601 UTC ms>-<4-digit counter>-<deviceId>", () => {
      const clock = formatClock(Date.parse("2026-07-04T12:00:00.000Z"), 3, DEVICE);
      expect(clock).toBe("2026-07-04T12:00:00.000Z-0003-device-a");
    });

    it("round-trips through parseClock even when the deviceId contains dashes", () => {
      const deviceId = "device-1751630400000-a1b2c3";
      const clock = formatClock(Date.parse("2026-07-04T12:00:00.000Z"), 42, deviceId);
      const parsed = parseClock(clock);
      expect(parsed.millis).toBe(Date.parse("2026-07-04T12:00:00.000Z"));
      expect(parsed.counter).toBe(42);
      expect(parsed.deviceId).toBe(deviceId);
    });
  });

  describe("tick", () => {
    it("returns strictly increasing clocks on consecutive ticks", () => {
      const hlc = new HLC({ deviceId: DEVICE, clock: () => 1000 });
      const first = hlc.tick();
      const second = hlc.tick();
      const third = hlc.tick();
      expect(compareClocks(first, second)).toBeLessThan(0);
      expect(compareClocks(second, third)).toBeLessThan(0);
    });

    it("advances millis and resets the counter when the wall clock moves forward", () => {
      let now = 1000;
      const hlc = new HLC({ deviceId: DEVICE, clock: () => now });
      hlc.tick();
      const bumped = hlc.tick();
      expect(parseClock(bumped).counter).toBe(1);
      now = 2000;
      const advanced = hlc.tick();
      expect(parseClock(advanced).millis).toBe(2000);
      expect(parseClock(advanced).counter).toBe(0);
    });
  });

  describe("receive", () => {
    it("produces a clock strictly greater than the remote one even when the local wall clock is behind", () => {
      const localBehind = new HLC({ deviceId: DEVICE, clock: () => 1000 });
      const remote = formatClock(Date.parse("2026-07-04T12:00:00.000Z"), 7, "device-b");
      const merged = localBehind.receive(remote);
      expect(compareClocks(merged, remote)).toBeGreaterThan(0);
    });

    it("keeps the local clock ahead of both its previous value and the remote", () => {
      let now = 5000;
      const hlc = new HLC({ deviceId: DEVICE, clock: () => now });
      const previous = hlc.tick();
      now = 4000; // wall clock jumps backwards
      const remote = formatClock(6000, 2, "device-b");
      const merged = hlc.receive(remote);
      expect(compareClocks(merged, previous)).toBeGreaterThan(0);
      expect(compareClocks(merged, remote)).toBeGreaterThan(0);
    });

    it("receiveMany folds every clock but persists only once (skipping empty entries)", () => {
      let saves = 0;
      const storage = { load: async () => null, save: async () => { saves += 1; } };
      const hlc = new HLC({ deviceId: DEVICE, clock: () => 1000, storage });
      const c1 = formatClock(Date.parse("2026-01-01T00:00:00.000Z"), 1, "device-b");
      const c2 = formatClock(Date.parse("2027-01-01T00:00:00.000Z"), 1, "device-c");

      hlc.receiveMany([c1, "", c2]);

      expect(saves).toBe(1); // one write for the whole batch, not one per clock
      const next = hlc.tick();
      expect(compareClocks(next, c2)).toBeGreaterThan(0); // advanced past the latest observed clock
    });

    it("receiveMany with no real clocks does not persist", () => {
      let saves = 0;
      const storage = { load: async () => null, save: async () => { saves += 1; } };
      const hlc = new HLC({ deviceId: DEVICE, clock: () => 1000, storage });
      hlc.receiveMany(["", ""]);
      expect(saves).toBe(0);
    });
  });

  describe("restart safety", () => {
    it("never regresses after a restart seeded from persisted state", async () => {
      const storage = new MemoryClockStorage();
      const before = new HLC({ deviceId: DEVICE, clock: () => 9000, storage });
      const lastBeforeRestart = before.tick();
      await storage.flush();

      // Simulate a restart with the wall clock rewound behind the persisted state.
      const after = new HLC({ deviceId: DEVICE, clock: () => 1000, storage });
      await after.hydrate();
      const firstAfterRestart = after.tick();
      expect(compareClocks(firstAfterRestart, lastBeforeRestart)).toBeGreaterThan(0);
    });

    it("starts fresh when storage is empty", async () => {
      const storage = new MemoryClockStorage();
      const hlc = new HLC({ deviceId: DEVICE, clock: () => 1000, storage });
      await hlc.hydrate();
      expect(parseClock(hlc.tick()).millis).toBe(1000);
    });
  });

  describe("tie-break", () => {
    it("orders clocks with identical millis and counter by deviceId", () => {
      const a = formatClock(1000, 0, "device-a");
      const b = formatClock(1000, 0, "device-b");
      expect(compareClocks(a, b)).toBeLessThan(0);
      expect(compareClocks(b, a)).toBeGreaterThan(0);
    });
  });

  describe("monotonicity (property)", () => {
    it("issues strictly increasing clocks across arbitrary tick/receive sequences with a jittery wall clock", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              op: fc.constantFrom("tick", "receive"),
              wall: fc.integer({ min: 0, max: 10_000 }),
              remoteMillis: fc.integer({ min: 0, max: 10_000 }),
              remoteCounter: fc.integer({ min: 0, max: 500 }),
              remoteDevice: fc.constantFrom("device-x", "device-y"),
            }),
            { minLength: 1, maxLength: 50 },
          ),
          (steps) => {
            let now = 0;
            const hlc = new HLC({ deviceId: DEVICE, clock: () => now });
            let previous: string | null = null;
            for (const step of steps) {
              now = step.wall;
              const issued =
                step.op === "tick"
                  ? hlc.tick()
                  : hlc.receive(formatClock(step.remoteMillis, step.remoteCounter, step.remoteDevice));
              if (previous !== null) {
                expect(compareClocks(issued, previous)).toBeGreaterThan(0);
              }
              previous = issued;
            }
          },
        ),
      );
    });
  });
});
