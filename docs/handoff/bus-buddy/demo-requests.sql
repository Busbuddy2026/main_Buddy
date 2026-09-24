-- Bus Buddy demo requests — the table behind POST /api/demo-request.
--
-- Run once against your Supabase project (SQL Editor, or `supabase db execute`).
-- Read the leads in the dashboard: Table Editor → demo_requests.

create table if not exists public.demo_requests (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text        not null,
  email       text        not null,
  school      text        not null,
  buses       text,
  note        text,
  interests   text[]      not null default '{}',

  -- Mirrors src/lib/marketing/demo-request.ts. The application already
  -- rejects these, so the database is the second line, not the first.
  constraint demo_requests_name_len   check (char_length(name)   between 1 and 120),
  constraint demo_requests_email_len  check (char_length(email)  between 3 and 200),
  constraint demo_requests_school_len check (char_length(school) between 1 and 160),
  constraint demo_requests_buses_len  check (buses is null or char_length(buses) <= 12),
  constraint demo_requests_note_len   check (note  is null or char_length(note)  <= 2000)
);

create index if not exists demo_requests_created_at_idx
  on public.demo_requests (created_at desc);

alter table public.demo_requests enable row level security;

-- Submitting is public; reading is not. With RLS on and no SELECT policy, the
-- publishable key can insert a row and can never read one back — so the lead
-- list is not exposed by the key that ships to every browser.
create policy "Anyone can submit a demo request"
  on public.demo_requests
  for insert
  to anon, authenticated
  with check (true);

-- Hardening, once SUPABASE_SERVICE_ROLE_KEY is set in the deploy: the route
-- writes as the service role, which bypasses RLS, so the public insert policy
-- above is no longer needed and the table can be closed entirely.
--
--   drop policy "Anyone can submit a demo request" on public.demo_requests;
