-- P2: sessions (travel + rate snapshot). RLS: tutor reads/writes only their own rows.

create type session_status as enum ('logged', 'billed');

create table sessions (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  occurred_on date not null,
  start_time time,
  duration_minutes integer not null check (duration_minutes > 0),
  travel_minutes integer not null default 0 check (travel_minutes >= 0),
  location text,
  -- Snapshots resolved at log time so a later rate/travel-rule change on the
  -- tutor or client never silently rewrites a past session's billing math.
  bill_travel boolean not null,
  effective_rate_cents integer not null check (effective_rate_cents >= 0),
  travel_rate_cents integer,
  status session_status not null default 'logged',
  -- FK to invoices added in the P3 migration (invoices table doesn't exist yet).
  invoice_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create index sessions_tutor_id_idx on sessions (tutor_id);
create index sessions_client_id_idx on sessions (client_id);
create index sessions_status_idx on sessions (status);

alter table sessions enable row level security;

create policy "sessions_select_own" on sessions
  for select using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  );

-- Note: both branches independently constrain to "owned by auth.uid()"
-- rather than cross-referencing each other's column (self-referencing the
-- row-under-check by table-qualified name inside a correlated subquery is
-- ambiguous in Postgres RLS). Since a tutor row is unique per auth_user_id,
-- requiring tutor_id and client_id to each resolve back to the same
-- authenticated tutor is equivalent to requiring client_id belongs to that
-- exact tutor_id.
create policy "sessions_insert_own" on sessions
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

create policy "sessions_update_own" on sessions
  for update using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  ) with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

create policy "sessions_delete_own" on sessions
  for delete using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and status = 'logged'
  );
