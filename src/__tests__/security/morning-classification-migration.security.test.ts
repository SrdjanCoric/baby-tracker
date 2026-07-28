import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/059_morning_sleep_classification.sql"
);

function migrationSql(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("morning sleep classification migration", () => {
  it("keeps historical rows legacy while identifying future old-client inserts", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/ADD COLUMN morning_classification TEXT;/);
    expect(sql).toMatch(/ADD COLUMN morning_classification_version SMALLINT;/);
    expect(sql).toMatch(/ALTER COLUMN morning_classification_version SET DEFAULT 1;/);
    expect(sql).not.toMatch(/UPDATE\s+(?:public\.)?sleep_sessions/i);
    expect(sql).not.toMatch(/morning_classification(?:_version)?[^;]*NOT NULL/i);
  });

  it("allows only version-one classification states without changing access control", () => {
    const sql = migrationSql();

    for (const state of [
      "automatic",
      "unresolved",
      "confirmed_first_nap",
      "confirmed_night_continuation",
    ]) {
      expect(sql).toContain(`'${state}'`);
    }
    expect(sql).toMatch(/morning_classification_version IS NULL OR morning_classification_version = 1/);
    expect(sql).not.toMatch(/(?:CREATE|ALTER|DROP) POLICY|GRANT|REVOKE|DISABLE ROW LEVEL SECURITY/i);
  });

  it("changes only the default continuation allowance for future preference rows", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/wake_window_preferences[\s\S]*nap_continuation_minutes SET DEFAULT 25/);
    expect(sql).not.toMatch(/UPDATE\s+(?:public\.)?wake_window_preferences/i);
  });
});
