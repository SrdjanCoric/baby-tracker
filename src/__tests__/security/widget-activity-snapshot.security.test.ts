import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/061_get_baby_activity_snapshot.sql", import.meta.url),
  "utf8"
);

describe("widget activity snapshot RPC security", () => {
  it("uses caller RLS identity without accepting a caller-supplied account id", () => {
    expect(migration).toMatch(/SECURITY\s+INVOKER/i);
    expect(migration).not.toMatch(/SECURITY\s+DEFINER/i);
    expect(migration).toMatch(/SET\s+search_path\s*=\s*''/i);
    expect(migration).toContain("auth.uid()");

    const signature = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION"),
      migration.indexOf("RETURNS jsonb")
    );
    expect(signature).toContain("p_baby_id uuid");
    expect(signature).toContain("p_timezone text");
    expect(signature).not.toMatch(/user|account|household/i);
  });

  it("exposes execution only to authenticated clients", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_baby_activity_snapshot\(uuid, text\)\s+FROM PUBLIC, anon, authenticated;/i
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_baby_activity_snapshot\(uuid, text\)\s+TO authenticated;/i
    );
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon|service_role)/i);
  });

  it("keeps the deterministic test clock session-scoped without another RPC", () => {
    expect(migration).toContain("pg_catalog.current_setting('widget.snapshot_now', true)");
    expect(migration).not.toContain("widget_snapshot_statement_timestamp");
  });

  it("grants only the summary columns required by invoker execution", () => {
    expect(migration).toContain("GRANT SELECT (id, household_id, display_name)");
    expect(migration).toContain("ON TABLE public.users TO authenticated;");
    expect(migration).toContain("ON TABLE public.diapers TO authenticated;");
    expect(migration).not.toMatch(/GRANT SELECT ON TABLE public\.(?:users|babies|feedings|sleep_sessions|diapers)/i);
    expect(migration).not.toMatch(/GRANT SELECT \([^)]*\bnotes\b[^)]*\)/i);
  });

  it("qualifies every application relation used by the empty-search-path function", () => {
    const applicationRelations = [
      "babies",
      "users",
      "wake_window_preferences",
      "activity_goals",
      "active_timers",
      "feedings",
      "sleep_sessions",
      "diapers",
      "pumping_sessions",
      "growth_measurements",
      "tummy_time_sessions",
    ];

    for (const relation of applicationRelations) {
      expect(migration).not.toMatch(new RegExp(`\\b(?:FROM|JOIN)\\s+${relation}\\b`, "i"));
      expect(migration).toMatch(new RegExp(`\\b(?:FROM|JOIN)\\s+public\\.${relation}\\b`, "i"));
    }
  });
});
