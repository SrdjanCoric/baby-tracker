import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubEvent, scrubString, scrubValue } from "@/utils/observability-scrub";

describe("observability scrubbing", () => {
  it("redacts emails, bearer tokens, and JWTs inside strings", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const input = `user jane.doe@example.com failed, Authorization: Bearer abc.def-123 body=${jwt}`;
    const output = scrubString(input);
    expect(output).not.toContain("jane.doe@example.com");
    expect(output).not.toContain("abc.def-123");
    expect(output).not.toContain(jwt);
    expect(output).toContain("[redacted]");
  });

  it("redacts credential-shaped keys and nested emails", () => {
    const output = scrubValue({
      email: "jane@example.com",
      accessToken: "secret-token",
      nested: { refresh_token: "r", note: "mail me at a@b.co", count: 3 },
      list: ["x@y.io", 1],
    }) as Record<string, unknown>;
    expect(output.email).toBe("[redacted]");
    expect(output.accessToken).toBe("[redacted]");
    expect((output.nested as Record<string, unknown>).refresh_token).toBe("[redacted]");
    expect((output.nested as Record<string, unknown>).note).toBe("mail me at [redacted]");
    expect((output.nested as Record<string, unknown>).count).toBe(3);
    expect(output.list).toEqual(["[redacted]", 1]);
  });

  it("keeps only the opaque user id on events", () => {
    const event = scrubEvent({
      type: undefined,
      user: { id: "uuid-1", email: "jane@example.com", ip_address: "1.2.3.4" },
      message: "sync failed for jane@example.com",
      request: { url: "https://x.supabase.co/auth?token=abc", method: "POST", headers: { Authorization: "Bearer t" } },
      exception: { values: [{ type: "Error", value: "denied for jane@example.com" }] },
      breadcrumbs: [{ message: "login jane@example.com", data: { password: "p" } }],
    } as never);
    expect(event?.user).toEqual({ id: "uuid-1" });
    expect(event?.message).toBe("sync failed for [redacted]");
    expect(event?.request).toEqual({ url: "https://x.supabase.co/auth?token=abc", method: "POST" });
    expect(event?.exception?.values?.[0].value).toBe("denied for [redacted]");
    expect(event?.breadcrumbs?.[0]).toEqual({ message: "login [redacted]", data: { password: "[redacted]" } });
  });

  it("scrubs breadcrumb data without dropping the crumb", () => {
    expect(scrubBreadcrumb({ category: "console", message: "ok", data: { token: "t", route: "/home" } })).toEqual({
      category: "console",
      message: "ok",
      data: { token: "[redacted]", route: "/home" },
    });
  });
});
