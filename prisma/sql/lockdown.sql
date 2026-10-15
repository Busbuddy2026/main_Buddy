-- Keep the transport schema out of Supabase's public API.
--
-- The app reaches these tables only through Prisma, as the `postgres` role.
-- Supabase's PostgREST serves whatever the `anon` and `authenticated` roles can
-- see, to anyone holding the publishable key, so those roles get nothing here.
-- Row-level security with no policies is the second lock: even if a grant
-- slips back in, every row is denied.
--
-- Idempotent. `npm run db:deploy` and `npm run db:reset` run it after
-- migrations.

revoke all on schema transport from anon, authenticated;
revoke all on all tables in schema transport from anon, authenticated;
revoke all on all sequences in schema transport from anon, authenticated;
alter default privileges in schema transport revoke all on tables from anon, authenticated;
alter default privileges in schema transport revoke all on sequences from anon, authenticated;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'transport' loop
    execute format('alter table transport.%I enable row level security', t.tablename);
  end loop;
end $$;
