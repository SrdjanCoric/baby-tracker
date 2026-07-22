#!/usr/bin/env node

import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { URL } from "node:url";

const FIXTURE_EMAILS = [
  "timer-edge-owner@test.local",
  "timer-edge-member@test.local",
  "timer-edge-outsider@test.local",
];
const PASSWORD = "LocalTimerTest!2026";
const BABY_ID = "7e000000-0000-0000-0000-000000000001";
const EMAILS_SQL = FIXTURE_EMAILS.map((email) => `'${email}'`).join(", ");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getLocalStatus() {
  const output = execFileSync(
    "npx",
    ["supabase", "status", "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  const status = JSON.parse(output);
  for (const key of ["API_URL", "DB_URL", "FUNCTIONS_URL"]) {
    const url = new URL(status[key]);
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      throw new Error(`${key} must point to local Supabase`);
    }
  }
  return status;
}

function psql(databaseUrl, sql) {
  return execFileSync(
    "psql",
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-Atqc", sql],
    { encoding: "utf8" }
  ).trim();
}

async function request(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

function authHeaders(anonKey, accessToken) {
  return {
    apikey: anonKey,
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
}

async function createUser(apiUrl, anonKey, email) {
  const signup = await request(`${apiUrl}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (signup.status >= 200 && signup.status < 300 && signup.body?.access_token) {
    return { id: signup.body.user.id, accessToken: signup.body.access_token };
  }

  const signIn = await request(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (signIn.status !== 200 || !signIn.body?.access_token) {
    throw new Error(`Could not create local auth fixture ${email}: HTTP ${signIn.status}`);
  }
  return { id: signIn.body.user.id, accessToken: signIn.body.access_token };
}

function createExpiredToken(jwtSecret, userId) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    aud: "authenticated",
    exp: 1,
    role: "authenticated",
    sub: userId,
  });
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function assertStatus(result, expected, label) {
  if (result.status !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, received ${result.status}`);
  }
}

function cleanupFixtures(databaseUrl) {
  const householdOutput = psql(
    databaseUrl,
    `SELECT DISTINCT household_id FROM public.users WHERE email IN (${EMAILS_SQL});`
  );
  const householdIds = householdOutput ? householdOutput.split("\n") : [];
  if (householdIds.some((id) => !UUID_PATTERN.test(id))) {
    throw new Error("Local cleanup found an invalid household ID");
  }

  psql(databaseUrl, `
    DELETE FROM public.active_timers WHERE baby_id = '${BABY_ID}'::uuid;
    DELETE FROM public.babies WHERE id = '${BABY_ID}'::uuid;
    DELETE FROM auth.users WHERE email IN (${EMAILS_SQL});
  `);

  if (householdIds.length > 0) {
    const householdList = householdIds.map((id) => `'${id}'::uuid`).join(", ");
    psql(databaseUrl, `
      DELETE FROM public.households AS household
      WHERE household.id IN (${householdList})
        AND NOT EXISTS (
          SELECT 1 FROM public.users AS caregiver
          WHERE caregiver.household_id = household.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.babies AS baby
          WHERE baby.household_id = household.id
        );
    `);
  }
}

const status = getLocalStatus();
const apiUrl = status.API_URL;
const functionUrl = `${status.FUNCTIONS_URL}/toggle-timer-pause`;
const anonKey = status.ANON_KEY;

cleanupFixtures(status.DB_URL);

try {
  const [owner, member, outsider] = await Promise.all([
    createUser(apiUrl, anonKey, FIXTURE_EMAILS[0]),
    createUser(apiUrl, anonKey, FIXTURE_EMAILS[1]),
    createUser(apiUrl, anonKey, FIXTURE_EMAILS[2]),
  ]);
  for (const user of [owner, member, outsider]) {
    if (!UUID_PATTERN.test(user.id)) throw new Error("Local Auth returned an invalid user ID");
  }

  psql(status.DB_URL, `
    UPDATE public.users
    SET household_id = (SELECT household_id FROM public.users WHERE id = '${owner.id}'::uuid),
        is_owner = false
    WHERE id = '${member.id}'::uuid;
    INSERT INTO public.babies (id, household_id, name)
    SELECT '${BABY_ID}'::uuid, household_id, 'Edge Timer Baby'
    FROM public.users
    WHERE id = '${owner.id}'::uuid;
  `);

  const acquire = await request(`${apiUrl}/rest/v1/rpc/acquire_timer_lock`, {
    method: "POST",
    headers: authHeaders(anonKey, owner.accessToken),
    body: JSON.stringify({
      p_baby_id: BABY_ID,
      p_activity_type: "sleep",
      p_user_id: owner.id,
      p_timer_data: {},
      p_started_at: "2026-07-21T12:00:00.000Z",
    }),
  });
  assertStatus(acquire, 200, "owner acquire");
  if (!Array.isArray(acquire.body) || acquire.body[0]?.success !== true) {
    throw new Error("owner acquire did not create a timer lock");
  }

  const anonymous = await request(functionUrl, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assertStatus(anonymous, 401, "anonymous Edge request");

  const expired = await request(functionUrl, {
    method: "POST",
    headers: authHeaders(anonKey, createExpiredToken(status.JWT_SECRET, owner.id)),
    body: JSON.stringify({}),
  });
  assertStatus(expired, 401, "expired-token Edge request");

  const pausePayload = {
    babyId: BABY_ID,
    activityType: "sleep",
    action: "pause",
    timerData: {
      isPaused: true,
      pausedAt: "2026-07-21T12:05:00.000Z",
      accumulatedSeconds: 300,
    },
    elapsedSeconds: 300,
  };

  const outsiderPause = await request(functionUrl, {
    method: "POST",
    headers: authHeaders(anonKey, outsider.accessToken),
    body: JSON.stringify({ ...pausePayload, userId: outsider.id }),
  });
  assertStatus(outsiderPause, 403, "cross-household pause");

  const memberPause = await request(functionUrl, {
    method: "POST",
    headers: authHeaders(anonKey, member.accessToken),
    body: JSON.stringify({ ...pausePayload, userId: member.id }),
  });
  assertStatus(memberPause, 403, "wrong-owner pause");

  const impersonatingPause = await request(functionUrl, {
    method: "POST",
    headers: authHeaders(anonKey, member.accessToken),
    body: JSON.stringify({ ...pausePayload, userId: owner.id }),
  });
  assertStatus(impersonatingPause, 403, "impersonating pause");

  const malformedPause = await request(functionUrl, {
    method: "POST",
    headers: authHeaders(anonKey, owner.accessToken),
    body: JSON.stringify({ ...pausePayload, action: "stop", userId: owner.id }),
  });
  assertStatus(malformedPause, 400, "malformed pause");

  const untouched = psql(
    status.DB_URL,
    `SELECT timer_data = '{}'::jsonb FROM public.active_timers WHERE baby_id = '${BABY_ID}'::uuid;`
  );
  if (untouched !== "t") throw new Error("a denied Edge request mutated the timer");

  const ownerPause = await request(functionUrl, {
    method: "POST",
    headers: authHeaders(anonKey, owner.accessToken),
    body: JSON.stringify({ ...pausePayload, userId: owner.id }),
  });
  assertStatus(ownerPause, 200, "owner pause");

  const ownerResume = await request(functionUrl, {
    method: "POST",
    headers: authHeaders(anonKey, owner.accessToken),
    body: JSON.stringify({
      babyId: BABY_ID,
      activityType: "sleep",
      userId: owner.id,
      action: "resume",
      timerData: {
        isPaused: false,
        effectiveStartTime: "2026-07-21T12:00:00.000Z",
        accumulatedSeconds: 300,
      },
      elapsedSeconds: 300,
      effectiveStartTimeISO: "2026-07-21T12:00:00.000Z",
    }),
  });
  assertStatus(ownerResume, 200, "owner resume");

  const resumed = psql(
    status.DB_URL,
    `SELECT (timer_data -> 'isPaused' = 'false'::jsonb) AND NOT (timer_data ? 'pausedAt')
     FROM public.active_timers WHERE baby_id = '${BABY_ID}'::uuid;`
  );
  if (resumed !== "t") throw new Error("owner resume left an invalid pause state");

  const memberRelease = await request(`${apiUrl}/rest/v1/rpc/release_timer_lock`, {
    method: "POST",
    headers: authHeaders(anonKey, member.accessToken),
    body: JSON.stringify({
      p_baby_id: BABY_ID,
      p_activity_type: "sleep",
      p_user_id: owner.id,
    }),
  });
  assertStatus(memberRelease, 403, "wrong-owner release");

  const ownerRelease = await request(`${apiUrl}/rest/v1/rpc/release_timer_lock`, {
    method: "POST",
    headers: authHeaders(anonKey, owner.accessToken),
    body: JSON.stringify({
      p_baby_id: BABY_ID,
      p_activity_type: "sleep",
      p_user_id: owner.id,
    }),
  });
  assertStatus(ownerRelease, 200, "owner release");
  if (ownerRelease.body !== true) throw new Error("owner release did not remove the timer lock");

  console.log("Active timer Edge authorization passed.");
} finally {
  cleanupFixtures(status.DB_URL);
}
