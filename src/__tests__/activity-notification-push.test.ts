import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getPastActivity } from "../../supabase/functions/send-activity-notification/activity-age";
import webhooks from "./fixtures/activity-notification-webhooks.json";

const boundary = vi.hoisted(() => ({
  handler: null as null | ((request: Request) => Promise<Response>),
  createClient: vi.fn(),
  sendFcmNotification: vi.fn(),
}));

vi.mock("https://deno.land/std@0.168.0/http/server.ts", () => ({
  serve: (handler: (request: Request) => Promise<Response>) => {
    boundary.handler = handler;
  },
}));
vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: boundary.createClient,
}));
vi.mock("../../supabase/functions/_shared/fcm.ts", () => ({
  getFcmAccessToken: async () => ({
    accessToken: "test-token",
    projectId: "test-project",
  }),
  sendFcmNotification: boundary.sendFcmNotification,
  isFcmTokenInvalid: () => false,
}));

const now = new Date("2026-10-07T12:00:00.000Z");
const old = new Date(now.getTime() - 60 * 60 * 1000 - 1).toISOString();
const tables = [
  "feedings",
  "sleep_sessions",
  "diapers",
  "pumping_sessions",
  "growth_measurements",
  "tummy_time_sessions",
];
const durationTables = [
  "feedings",
  "sleep_sessions",
  "pumping_sessions",
  "tummy_time_sessions",
];
const testEnv = {
  get: (key: string) => (key === "APNS_AUTH_KEY" ? "AA==" : "test-config"),
};

// Synthetic PostgreSQL rows serialized by the local webhook's jsonb_build_object path.
function recordFor(table: string, time: unknown): Record<string, unknown> {
  const sample = webhooks.find((sample) => sample.payload.table === table)!;
  const record: Record<string, unknown> = { ...sample.payload.record };
  if (durationTables.includes(table)) record.ended_at = time;
  else if (table === "diapers") record.changed_at = time;
  else record.measured_at = time;
  return record;
}

describe("activity webhook delivery", () => {
  let sendApns: ReturnType<typeof vi.fn>;
  let log: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    vi.stubGlobal("Deno", { env: testEnv });
    await import("../../supabase/functions/send-activity-notification/index.ts");
  });

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(now.getTime());
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(crypto.subtle, "importKey").mockResolvedValue({} as CryptoKey);
    vi.spyOn(crypto.subtle, "sign").mockResolvedValue(new ArrayBuffer(64));
    sendApns = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", sendApns);
    boundary.sendFcmNotification
      .mockReset()
      .mockResolvedValue({ success: true, status: 200 });
    boundary.createClient.mockReset().mockImplementation(() => ({
      from: (table: string) => {
        let columns = "";
        const query: any = {
          select: (value: string) => {
            columns = value;
            return query;
          },
          eq: () => query,
          neq: () => query,
          in: () => query,
          not: () => query,
          single: () => query,
          then: (resolve: any) =>
            Promise.resolve({
              error: null,
              data:
                table === "babies"
                  ? { name: "Baby", household_id: "household" }
                  : table === "user_push_tokens"
                    ? [
                        {
                          device_token: "ios-peer",
                          user_id: "peer",
                          device_type: "ios",
                          is_sandbox: false,
                        },
                        {
                          device_token: "android-peer",
                          user_id: "peer",
                          device_type: "android",
                        },
                      ]
                    : columns === "id"
                      ? [{ id: "peer" }]
                      : { display_name: "Caregiver" },
            }).then(resolve),
        };
        return query;
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function notify(table: string, record: Record<string, unknown>) {
    return invokeWebhook({ type: "INSERT", table, record });
  }

  async function invokeWebhook(payload: object) {
    vi.stubGlobal("Deno", { env: testEnv });
    const response = await boundary.handler!(
      new Request("http://localhost/send-activity-notification", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
    return { status: response.status, body: await response.json() };
  }

  function expectNoPush() {
    expect(sendApns).not.toHaveBeenCalled();
    expect(boundary.sendFcmNotification).not.toHaveBeenCalled();
    expect(boundary.createClient).not.toHaveBeenCalled();
  }

  describe.each(tables)("webhook delivery for %s", (table) => {
    it("skips before any database or push work and logs timestamp and age", async () => {
      expect(await notify(table, recordFor(table, old))).toEqual({
        status: 200,
        body: { skipped: "past activity" },
      });
      expectNoPush();
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("past activity"),
        { activityTime: old, ageMs: 3600001 }
      );
    });

    it("delivers a recent activity to both platforms", async () => {
      expect(await notify(table, recordFor(table, now.toISOString()))).toEqual({
        status: 200,
        body: { success: true, sent: 2, total: 2 },
      });
      expect(sendApns).toHaveBeenCalledOnce();
      expect(boundary.sendFcmNotification).toHaveBeenCalledOnce();
      expect(JSON.parse(sendApns.mock.calls[0][1].body)).toMatchObject({
        type: "activity_logged",
        table,
        babyId: recordFor(table, old).baby_id,
      });
    });

    it("skips tombstones before considering activity time", async () => {
      expect(
        await notify(table, { ...recordFor(table, old), deleted: true })
      ).toEqual({ status: 200, body: { skipped: "tombstoned" } });
      expectNoPush();
    });

    it.each(["baby_id", "logged_by"])(
      "preserves rejection of missing %s",
      async (field) => {
        const record = recordFor(table, old);
        delete record[field];
        expect(await notify(table, record)).toEqual({
          status: 400,
          body: { error: "Missing baby_id or logged_by" },
        });
        expectNoPush();
      }
    );
  });

  it("rejects an unmapped table before delivery", async () => {
    expect(
      (await notify("health_entries", recordFor("diapers", old))).status
    ).toBe(400);
    expectNoPush();
  });

  it("preserves delivery when the activity timestamp is unreadable", async () => {
    expect(
      (
        await notify(
          "sleep_sessions",
          recordFor("sleep_sessions", "unreadable")
        )
      ).body
    ).toEqual({ success: true, sent: 2, total: 2 });
    expect(sendApns).toHaveBeenCalledOnce();
    expect(boundary.sendFcmNotification).toHaveBeenCalledOnce();
  });

  it.each(webhooks)(
    "handles PostgreSQL $payload.table timestamp at $case through the webhook",
    async (sample) => {
      const result = await invokeWebhook(sample.payload);
      if (sample.case === "past") {
        expect(result).toEqual({
          status: 200,
          body: { skipped: "past activity" },
        });
        expectNoPush();
      } else {
        expect(result).toEqual({
          status: 200,
          body: { success: true, sent: 2, total: 2 },
        });
        expect(sendApns).toHaveBeenCalledOnce();
        expect(boundary.sendFcmNotification).toHaveBeenCalledOnce();
      }
    }
  );
});

describe.each(tables)("activity age for %s", (table) => {
  it("identifies activities more than 60 minutes old even when inserted now", () => {
    expect(
      getPastActivity(table, recordFor(table, old), now.getTime())
    ).toEqual({ activityTime: old, ageMs: 3600001 });
  });

  it.each([
    now.toISOString(),
    new Date(now.getTime() - 3600000).toISOString(),
    new Date(now.getTime() - 3599999).toISOString(),
    new Date(now.getTime() + 3600000).toISOString(),
  ])(
    "keeps recent, exactly 60-minute-old, and future activity (%s)",
    (time) => {
      expect(
        getPastActivity(table, recordFor(table, time), now.getTime())
      ).toBeNull();
    }
  );

  it.each([undefined, null, "", "unreadable", 0, {}, []])(
    "keeps missing or unreadable activity time (%j)",
    (time) => {
      const record = recordFor(table, time);
      if (durationTables.includes(table)) record.started_at = time;
      expect(getPastActivity(table, record, now.getTime())).toBeNull();
    }
  );
});

describe.each(durationTables)("age without end time for %s", (table) => {
  it.each([undefined, null])(
    "uses an old start when end is absent (%j)",
    (end) => {
      expect(
        getPastActivity(
          table,
          { ...recordFor(table, end), started_at: old },
          now.getTime()
        )
      ).toEqual({ activityTime: old, ageMs: 3600001 });
    }
  );

  it.each([undefined, null])(
    "keeps a recent start when end is absent (%j)",
    (end) => {
      expect(
        getPastActivity(
          table,
          { ...recordFor(table, end), started_at: now.toISOString() },
          now.getTime()
        )
      ).toBeNull();
    }
  );

  it("does not replace an unreadable end with an old start", () => {
    expect(
      getPastActivity(table, recordFor(table, "unreadable"), now.getTime())
    ).toBeNull();
  });
});

describe.each(["diapers", "growth_measurements"])(
  "single-time activity %s",
  (table) => {
    it("uses its own timestamp instead of unrelated start/end fields", () => {
      const record = {
        ...recordFor(table, old),
        started_at: now.toISOString(),
        ended_at: now.toISOString(),
      };
      expect(getPastActivity(table, record, now.getTime())).toEqual({
        activityTime: old,
        ageMs: 3600001,
      });
    });
  }
);
