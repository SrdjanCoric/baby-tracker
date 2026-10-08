import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RealTimeSync, type RemoteChange } from './real-time-sync';

let client: SupabaseClient;
let admin: SupabaseClient;
let databaseUrl: string;
const identities: { userId: string; householdId: string; babyId: string; siblingId?: string }[] = [];
let realtime: RealTimeSync;
vi.mock('@/services/supabase', () => ({ get supabase() { return client; } }));

let restoreLocalGrants = '';
const SUBSCRIBED_TABLES = [
  'feedings', 'sleep_sessions', 'diapers', 'pumping_sessions', 'growth_measurements',
  'tummy_time_sessions', 'babies', 'users', 'households', 'active_timers',
  'wake_window_preferences', 'activity_goals', 'milestone_responses', 'health_entries',
];
const UNPUBLISHED_LOCALLY = ['users', 'households'];

function fixtureSql(sql: string): string {
  try {
    return execFileSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-At'], {
      input: sql, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8',
    });
  } catch (error) {
    throw new Error(`Local Realtime fixture SQL failed: ${String((error as { stderr?: Buffer }).stderr ?? '')}`);
  }
}

beforeAll(async () => {
  const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '--output', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }));
  databaseUrl = status.DB_URL;
  for (const url of [status.API_URL, databaseUrl]) {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) {
      throw new Error('Realtime integration requires loopback Supabase');
    }
  }
  // Mirror the hosted project: a fresh local reset lacks these reads and publications, and one
  // unreadable or unpublished table silently stops every postgres_changes event on the channel.
  // Record the local column-scoped grants first so afterAll restores them for the SQL suites.
  const tables = `ARRAY['${SUBSCRIBED_TABLES.join("','")}']`;
  const unpublished = `ARRAY['${UNPUBLISHED_LOCALLY.join("','")}']`;
  restoreLocalGrants = fixtureSql(`
    SELECT coalesce(string_agg(statement, ' '), '') FROM (
      SELECT format('REVOKE SELECT ON public.%I FROM authenticated;', c.relname) || coalesce((
        SELECT format(' GRANT SELECT (%s) ON public.%I TO authenticated;',
          string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum), c.relname)
        FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
          AND has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT')
        HAVING count(*) > 0), '') AS statement
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY(${tables})
        AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
      UNION ALL
      SELECT format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I;', name)
      FROM unnest(${unpublished}) AS name
      WHERE NOT EXISTS (SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = name)
    ) AS restore;`).trim();
  fixtureSql(`
    DO $$
    DECLARE name text;
    BEGIN
      FOREACH name IN ARRAY ${tables} LOOP
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated', name);
      END LOOP;
      FOREACH name IN ARRAY ${unpublished} LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = name) THEN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', name);
        END IF;
      END LOOP;
    END $$;`);
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  client = createClient(status.API_URL, status.ANON_KEY, options);
  for (let index = 0; index < 2; index++) {
    const email = `realtime-${randomUUID()}@example.test`;
    const password = randomUUID();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Could not create local Realtime user');
    const userId = created.data.user.id;
    const household = await admin.from('users').select('household_id').eq('id', userId).single();
    if (household.error) throw new Error('Could not read local Realtime household');
    const identity = { userId, siblingId: index === 0 ? randomUUID() : undefined, householdId: household.data.household_id as string, babyId: randomUUID() };
    identities.push(identity);
    fixtureSql(`INSERT INTO public.babies (id, household_id, name) VALUES ('${identity.babyId}', '${identity.householdId}', 'Realtime fixture');`);
    if (identity.siblingId) fixtureSql(`INSERT INTO public.babies (id, household_id, name) VALUES ('${identity.siblingId}', '${identity.householdId}', 'Realtime sibling');`);
    if (index === 0) {
      const login = await client.auth.signInWithPassword({ email, password });
      if (login.error) throw new Error('Could not sign in local Realtime user');
    }
  }
  realtime = new RealTimeSync();
  realtime.setAuthContext(identities[0]);
}, 30000);

afterAll(async () => {
  realtime?.destroy();
  if (client) { await client.removeAllChannels(); await client.auth.signOut(); }
  for (const identity of identities) {
    fixtureSql(`DELETE FROM public.babies WHERE household_id = '${identity.householdId}'; DELETE FROM auth.users WHERE id = '${identity.userId}'; DELETE FROM public.households WHERE id = '${identity.householdId}';`);
  }
  if (restoreLocalGrants) fixtureSql(restoreLocalGrants);
});

it('includes psql diagnostics when fixture SQL fails', () => {
  expect(() => fixtureSql('SELECT missing_realtime_fixture_column;'))
    .toThrow(/Local Realtime fixture SQL failed:.*column "missing_realtime_fixture_column" does not exist/s);
});

it('delivers both siblings and household metadata without foreign household events', async () => {
  const received: RemoteChange[] = [];
  realtime.onRemoteChange(change => received.push(change));
  const delivered: { table: string; new: Record<string, unknown>; old: Record<string, unknown> }[] = [];
  const createChannel = client.channel.bind(client);
  vi.spyOn(client, 'channel').mockImplementation((...args) => {
    const channel = createChannel(...args);
    const on = channel.on.bind(channel);
    channel.on = ((event: string, filter: { table: string }, callback: (payload: unknown) => void) =>
      on(event as never, filter as never, ((payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
        delivered.push({ table: filter.table, ...payload });
        callback(payload);
      }) as never)) as typeof channel.on;
    return channel;
  });
  await realtime.subscribeToHousehold(identities[0].householdId, [identities[0].babyId, identities[0].siblingId!]);
  await vi.waitFor(() => expect(realtime.isConnected()).toBe(true), { timeout: 10000 });
  // Realtime reports the join before registering its listeners; writes before that are dropped.
  await vi.waitFor(() => expect(execFileSync('psql', [databaseUrl, '-Atc',
    `SELECT count(*) FROM realtime.subscription WHERE entity = 'public.active_timers'::regclass AND claims->>'sub' = '${identities[0].userId}'`],
  { encoding: 'utf8' }).trim()).not.toBe('0'), { timeout: 10000 });
  const siblingTimerId = randomUUID();
  fixtureSql(`INSERT INTO public.active_timers (id, baby_id, activity_type, started_by) VALUES ('${siblingTimerId}', '${identities[0].siblingId}', 'sleep', '${identities[0].userId}');`);
  await vi.waitFor(() => expect(received.some(c => c.table === 'active_timers' && c.new?.id === siblingTimerId)).toBe(true), { timeout: 10000 });
  fixtureSql(`DELETE FROM public.active_timers WHERE id = '${siblingTimerId}';`);
  for (const identity of [...identities].reverse()) {
    fixtureSql(`UPDATE public.babies SET name = 'Updated fixture' WHERE id = '${identity.babyId}'; UPDATE public.households SET created_at = '2026-01-01T00:00:00Z' WHERE id = '${identity.householdId}';`);
  }
  await vi.waitFor(() => {
    expect(received.some(c => c.table === 'babies' && c.new?.id === identities[0].babyId && c.new.name === 'Updated fixture')).toBe(true);
    expect(received.some(c => c.table === 'households' && c.new?.id === identities[0].householdId && String(c.new.created_at).startsWith('2026-01-01'))).toBe(true);
  }, { timeout: 10000 });
  expect(delivered.some(c => c.table === 'babies' && c.new?.id === identities[1].babyId)).toBe(false);
  expect(delivered.some(c => c.table === 'households' && c.new?.id === identities[1].householdId)).toBe(false);
  const timerIds = identities.map(() => randomUUID());
  const diaperIds = identities.map(() => randomUUID());
  for (const [index, identity] of identities.entries()) {
    fixtureSql(`INSERT INTO public.active_timers (id, baby_id, activity_type, started_by) VALUES ('${timerIds[index]}', '${identity.babyId}', 'sleep', '${identity.userId}');`);
  }
  await vi.waitFor(() => expect(received.some(c => c.table === 'active_timers' && c.eventType === 'INSERT' && c.new?.id === timerIds[0])).toBe(true), { timeout: 10000 });
  for (const id of timerIds) fixtureSql(`UPDATE public.active_timers SET timer_data = '{"fixture":true}' WHERE id = '${id}';`);
  await vi.waitFor(() => expect(received.some(c => c.table === 'active_timers' && c.eventType === 'UPDATE' && c.new?.id === timerIds[0])).toBe(true), { timeout: 10000 });
  // Delete the foreign row first; the own delete is the delivery barrier on the same stream.
  for (const id of [...timerIds].reverse()) fixtureSql(`DELETE FROM public.active_timers WHERE id = '${id}';`);
  await vi.waitFor(() => expect(received.some(c => c.table === 'active_timers' && c.eventType === 'DELETE' && c.old?.id === timerIds[0])).toBe(true), { timeout: 10000 });
  expect(received.filter(c => c.table === 'active_timers').map(c => c.new?.id ?? c.old?.id)).not.toContain(timerIds[1]);
  for (const [index, identity] of identities.entries()) {
    fixtureSql(`INSERT INTO public.diapers (id, baby_id, logged_by, type, changed_at) VALUES ('${diaperIds[index]}', '${identity.babyId}', '${identity.userId}', 'wet', now());`);
  }
  await vi.waitFor(() => expect(received.some(c => c.table === 'diapers' && c.eventType === 'INSERT' && c.new?.id === diaperIds[0])).toBe(true), { timeout: 10000 });
  for (const id of [...diaperIds].reverse()) fixtureSql(`UPDATE public.diapers SET deleted = true WHERE id = '${id}';`);
  await vi.waitFor(() => expect(received.some(c => c.table === 'diapers' && c.eventType === 'UPDATE' && c.new?.id === diaperIds[0] && c.new.deleted === true)).toBe(true), { timeout: 10000 });
  for (const id of [...diaperIds].reverse()) fixtureSql(`DELETE FROM public.diapers WHERE id = '${id}';`);
  await vi.waitFor(() => expect(received.some(c => c.table === 'diapers' && c.eventType === 'DELETE' && c.old?.id === diaperIds[0])).toBe(true), { timeout: 10000 });
  expect(received.filter(c => c.table === 'diapers').map(c => c.new?.id ?? c.old?.id)).not.toContain(diaperIds[1]);
}, 60000);
