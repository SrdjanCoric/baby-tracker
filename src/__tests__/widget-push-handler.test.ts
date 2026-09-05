import { describe, expect, it, vi } from "vitest";
import { createWidgetPushHandler } from "../../supabase/functions/send-widget-push/handler";

function setup({ peers = false } = {}) {
  const remove = vi.fn();
  const queries: { table: string; filters: unknown[][] }[] = [];
  const database = {
    from: vi.fn((table: string) => {
      const data: Record<string, unknown> = {
        babies: { name: "Baby", household_id: "household" },
        users: peers ? [{ id: "member" }] : [],
        widget_push_tokens: [
          {
            device_token: "widget-token",
            user_id: "member",
            is_sandbox: false,
          },
        ],
        live_activity_push_tokens: [
          {
            id: "activity-row",
            device_token: "activity-token",
            is_sandbox: false,
          },
        ],
      };
      const filters: unknown[][] = [];
      queries.push({ table, filters });
      const query: any = {
        select: () => query,
        eq: (...args: unknown[]) => { filters.push(["eq", ...args]); return query; },
        neq: (...args: unknown[]) => { filters.push(["neq", ...args]); return query; },
        in: (...args: unknown[]) => { filters.push(["in", ...args]); return query; },
        delete: () => {
          remove(table);
          return query;
        },
        single: () => query,
        then: (resolve: any) =>
          Promise.resolve({ data: data[table], error: null }).then(resolve),
      };
      return query;
    }),
  };
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  const handler = createWidgetPushHandler({
    env: (key: string) =>
      key === "SUPABASE_SERVICE_ROLE_KEY" ? "service-secret" : "config",
    createClient: () => database as any,
    fetch: send,
    createJwt: async () => "jwt",
  });
  return { handler, database, send, remove, queries };
}

function request(type: "INSERT" | "DELETE", auth = "service-secret") {
  const record = {
    id: "lock-row",
    baby_id: "baby",
    started_by: "starter",
    activity_type: "sleep",
    started_at: "2026-09-05T12:00:00Z",
    timer_data: { timerInstanceId: "run" },
  };
  return new Request("http://localhost/send-widget-push", {
    method: "POST",
    headers: { authorization: `Bearer ${auth}` },
    body: JSON.stringify({
      type,
      table: "active_timers",
      record: type === "INSERT" ? record : null,
      old_record: type === "DELETE" ? record : null,
    }),
  });
}

describe("widget push webhook", () => {
  it("ends the starter's activity even without another household member or widget token", async () => {
    const { handler, send, remove, queries } = setup();
    expect((await handler(request("DELETE"))).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].headers["apns-push-type"]).toBe(
      "liveactivity"
    );
    expect(remove).toHaveBeenCalledWith("live_activity_push_tokens");
    expect(queries.filter(q => q.table === "live_activity_push_tokens").map(q => q.filters)).toEqual([
      [["eq", "baby_id", "baby"], ["eq", "timer_instance_id", "run"]],
      [["in", "id", ["activity-row"]]],
    ]);
  });

  it("preserves widget pushes on INSERT and DELETE", async () => {
    const { handler, send, database } = setup({ peers: true });
    await handler(request("INSERT"));
    expect(database.from).not.toHaveBeenCalledWith("live_activity_push_tokens");
    expect(send.mock.calls[0][1].headers["apns-push-type"]).toBe("widgets");
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({
      aps: { "content-changed": true },
    });
    send.mockClear();
    await handler(request("DELETE"));
    expect(
      send.mock.calls.map((call) => call[1].headers["apns-push-type"])
    ).toEqual(["liveactivity", "widgets"]);
  });

  it("preserves legacy widget delivery without authorizing Live Activity ends", async () => {
    const { handler, database, send } = setup({ peers: true });
    expect((await handler(request("DELETE", "user-jwt"))).status).toBe(200);
    expect(database.from).not.toHaveBeenCalledWith("live_activity_push_tokens");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].headers["apns-push-type"]).toBe("widgets");
  });
});
