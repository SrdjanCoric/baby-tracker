import { diaperReducer, initialDiaperState } from "@/contexts/diaper-context";
import { feedingReducer, initialFeedingState } from "@/contexts/feeding-context";
import { growthReducer, initialGrowthState } from "@/contexts/growth-context";
import { healthReducer, initialHealthState } from "@/contexts/health-context";
import { initialMilestonesState, milestonesReducer } from "@/contexts/milestones-context";
import { initialPumpingState, pumpingReducer } from "@/contexts/pumping-context";
import { initialSleepState, sleepReducer } from "@/contexts/sleep-context";
import { initialTummyTimeState, tummyTimeReducer } from "@/contexts/tummyTime-context";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import type { StoredHealthEntry } from "@/services/health-storage";
import type { StoredMilestoneResponse } from "@/services/milestones-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

jest.mock("@/services/supabase", () => ({
  supabase: {},
}));

jest.mock("@/services/sync", () =>
  jest.requireActual("@/services/sync/tombstone")
);

const timestamp = "2026-07-16T08:00:00.000Z";

function diaperEntry(notes: string, id = "diaper-1"): StoredDiaperEntry {
  return {
    id,
    babyId: "baby-1",
    type: "wet",
    changedAt: timestamp,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function feedingEntry(notes: string): StoredFeedingEntry {
  return {
    id: "feeding-1",
    babyId: "baby-1",
    type: "bottle",
    startedAt: timestamp,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function sleepEntry(notes: string): StoredSleepEntry {
  return {
    id: "sleep-1",
    babyId: "baby-1",
    type: "nap",
    startedAt: timestamp,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function pumpingEntry(notes: string): StoredPumpingEntry {
  return {
    id: "pumping-1",
    babyId: "baby-1",
    side: "left",
    startedAt: timestamp,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function growthEntry(notes: string): StoredGrowthEntry {
  return {
    id: "growth-1",
    babyId: "baby-1",
    measuredAt: timestamp,
    weightKg: 7,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function tummyTimeEntry(notes: string): StoredTummyTimeEntry {
  return {
    id: "tummy-time-1",
    babyId: "baby-1",
    startedAt: timestamp,
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function healthEntry(notes: string): StoredHealthEntry {
  return {
    id: "health-1",
    babyId: "baby-1",
    type: "medication",
    loggedAt: timestamp,
    medicationName: "acetaminophen",
    notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function milestoneResponse(state: "yes" | "not_sure"): StoredMilestoneResponse {
  return {
    id: "milestone-response-1",
    babyId: "baby-1",
    milestoneId: "milestone-1",
    state,
    deleted: false,
    respondedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("activity acknowledgement reducers", () => {
  it("keeps one diaper with the local create result when Realtime inserts first", () => {
    const afterRemote = diaperReducer(initialDiaperState, {
      type: "REMOTE_INSERT",
      payload: diaperEntry("remote acknowledgement"),
    });

    const afterLocal = diaperReducer(afterRemote, {
      type: "ADD_DIAPER",
      payload: diaperEntry("local create result"),
    });

    expect(afterLocal.diapers).toEqual([diaperEntry("local create result")]);
  });

  it("keeps one diaper with the latest acknowledgement when the local result arrives first", () => {
    const afterLocal = diaperReducer(initialDiaperState, {
      type: "ADD_DIAPER",
      payload: diaperEntry("local create result"),
    });

    const afterRemote = diaperReducer(afterLocal, {
      type: "REMOTE_INSERT",
      payload: diaperEntry("remote acknowledgement"),
    });

    expect(afterRemote.diapers).toEqual([diaperEntry("remote acknowledgement")]);
  });

  it("preserves list order and keeps activities with different ids separate", () => {
    const state = {
      ...initialDiaperState,
      diapers: [diaperEntry("other activity", "diaper-2"), diaperEntry("remote acknowledgement")],
    };

    const afterLocal = diaperReducer(state, {
      type: "ADD_DIAPER",
      payload: diaperEntry("local create result"),
    });

    expect(afterLocal.diapers).toEqual([
      diaperEntry("other activity", "diaper-2"),
      diaperEntry("local create result"),
    ]);
  });

  it("keeps one feeding with the local create result when Realtime inserts first", () => {
    const afterRemote = feedingReducer(initialFeedingState, {
      type: "REMOTE_INSERT",
      payload: feedingEntry("remote acknowledgement"),
    });

    const afterLocal = feedingReducer(afterRemote, {
      type: "ADD_FEEDING",
      payload: feedingEntry("local create result"),
    });

    expect(afterLocal.feedings).toEqual([feedingEntry("local create result")]);
  });

  it("removes every same-id feeding presentation when that logical id is deleted", () => {
    const duplicateState = {
      ...initialFeedingState,
      feedings: [
        feedingEntry("remote acknowledgement"),
        feedingEntry("local create result"),
      ],
    };

    const afterDelete = feedingReducer(duplicateState, {
      type: "DELETE_FEEDING",
      payload: "feeding-1",
    });

    expect(afterDelete.feedings).toEqual([]);
  });

  it("keeps one sleep with the local create result when Realtime inserts first", () => {
    const afterRemote = sleepReducer(initialSleepState, {
      type: "REMOTE_INSERT",
      payload: sleepEntry("remote acknowledgement"),
    });

    const afterLocal = sleepReducer(afterRemote, {
      type: "ADD_SLEEP",
      payload: sleepEntry("local create result"),
    });

    expect(afterLocal.sleeps).toEqual([sleepEntry("local create result")]);
  });

  it("applies a confirmed morning type from another caregiver", () => {
    const state = {
      ...initialSleepState,
      sleeps: [{
        ...sleepEntry("awaiting confirmation"),
        type: "night" as const,
        morningClassification: "unresolved" as const,
        morningClassificationVersion: 1,
      }],
    };

    const afterRemote = sleepReducer(state, {
      type: "REMOTE_UPDATE",
      payload: {
        ...sleepEntry("confirmed remotely"),
        type: "nap",
        morningClassification: "confirmed_first_nap",
        morningClassificationVersion: 1,
      },
    });

    expect(afterRemote.sleeps).toEqual([expect.objectContaining({
      type: "nap",
      morningClassification: "confirmed_first_nap",
      morningClassificationVersion: 1,
    })]);
  });

  it("keeps one pumping with the local create result when Realtime inserts first", () => {
    const afterRemote = pumpingReducer(initialPumpingState, {
      type: "REMOTE_INSERT",
      payload: pumpingEntry("remote acknowledgement"),
    });

    const afterLocal = pumpingReducer(afterRemote, {
      type: "ADD_PUMPING",
      payload: pumpingEntry("local create result"),
    });

    expect(afterLocal.pumpings).toEqual([pumpingEntry("local create result")]);
  });

  it("keeps one growth measurement with the local create result when Realtime inserts first", () => {
    const afterRemote = growthReducer(initialGrowthState, {
      type: "REMOTE_INSERT",
      payload: growthEntry("remote acknowledgement"),
    });

    const afterLocal = growthReducer(afterRemote, {
      type: "ADD_MEASUREMENT",
      payload: growthEntry("local create result"),
    });

    expect(afterLocal.measurements).toEqual([growthEntry("local create result")]);
  });

  it("keeps one tummy-time entry with the local create result when Realtime inserts first", () => {
    const afterRemote = tummyTimeReducer(initialTummyTimeState, {
      type: "REMOTE_INSERT",
      payload: tummyTimeEntry("remote acknowledgement"),
    });

    const afterLocal = tummyTimeReducer(afterRemote, {
      type: "ADD_TUMMY_TIME",
      payload: tummyTimeEntry("local create result"),
    });

    expect(afterLocal.tummyTimes).toEqual([tummyTimeEntry("local create result")]);
  });

  it("keeps one health entry with the local create result when Realtime inserts first", () => {
    const afterRemote = healthReducer(initialHealthState, {
      type: "REMOTE_INSERT",
      payload: healthEntry("remote acknowledgement"),
    });

    const afterLocal = healthReducer(afterRemote, {
      type: "ADD_HEALTH",
      payload: healthEntry("local create result"),
    });

    expect(afterLocal.healthEntries).toEqual([healthEntry("local create result")]);
  });

  it("keeps one milestone response with the local result when Realtime inserts first", () => {
    const afterRemote = milestonesReducer(initialMilestonesState, {
      type: "REMOTE_INSERT",
      payload: milestoneResponse("not_sure"),
    });

    const afterLocal = milestonesReducer(afterRemote, {
      type: "UPSERT_RESPONSE",
      payload: milestoneResponse("yes"),
    });

    expect(afterLocal.responses).toEqual([milestoneResponse("yes")]);
  });
});
