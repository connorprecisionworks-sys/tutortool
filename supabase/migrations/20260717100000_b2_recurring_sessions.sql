-- B2: recurring weekly session templates.
--
-- recurring_sessions is the template (student, service, weekday, time,
-- duration/travel, start/end date). It does not itself carry billing state
-- — each occurrence is a normal `sessions` row (recurring_session_id links
-- back), generated ahead of time on a rolling horizon so it bills, reminds,
-- and cancels exactly like any manually-logged session (see
-- money_mutation_architecture memory: no new invariant to protect here
-- since a `sessions` row is still the sole unit that ever gets invoiced).
--
-- Row creation is a plain ownership-scoped RLS insert (no invariant to
-- protect for a single template row), same as `clients`. All UPDATEs
-- (ending/cancelling a series) go through end_recurring_series() only — no
-- update policy exists — because ending a series must also atomically
-- cancel its future not-yet-occurred instances, a cross-row operation.

create table recurring_sessions (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  service_id uuid references services (id) on delete set null,
  weekday integer not null check (weekday between 0 and 6), -- 0=Sunday..6=Saturday, matches JS Date#getDay()
  start_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  travel_minutes integer not null default 0 check (travel_minutes >= 0),
  location text,
  start_date date not null,
  end_date date, -- null = ongoing
  status text not null default 'active' check (status in ('active', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index recurring_sessions_tutor_id_idx on recurring_sessions (tutor_id);

alter table recurring_sessions enable row level security;

-- Tutor-only — parents already see each generated instance via the normal
-- `sessions` RLS; the template itself has no parent-facing use case.
create policy "recurring_sessions_select_own" on recurring_sessions
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "recurring_sessions_insert_own" on recurring_sessions
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
    and (service_id is null or service_id in (
      select id from services where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
  );

alter table sessions
  add column recurring_session_id uuid references recurring_sessions (id) on delete set null;

-- Belt-and-suspenders against the generator's check-then-insert race (an
-- authenticated tutor creating a series at the same moment the daily cron
-- extends its horizon) ever double-booking the same calendar date onto the
-- same series.
create unique index sessions_recurring_occurrence_unique_idx
  on sessions (recurring_session_id, occurred_on)
  where recurring_session_id is not null;

-- Mirrors the Q5 package_id tightening (see rls_insert_update_asymmetry
-- memory): a direct client insert must only be able to link a session to a
-- recurring series the caller's own tutor owns.
drop policy "sessions_insert_own" on sessions;

create policy "sessions_insert_own" on sessions
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and client_id in (
      select id from clients where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
    and package_id is null
    and (recurring_session_id is null or recurring_session_id in (
      select id from recurring_sessions where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
  );

-- end_recurring_series: the sanctioned way to cancel "this and future" —
-- stops generation from p_from_date forward and cancels (via the existing
-- cancel_session, so credit/refund/package handling stays identical to a
-- one-off cancellation) every not-yet-cancelled generated instance on or
-- after that date. Each cancel_session call is wrapped so one instance that
-- can't be cancelled (e.g. already on a sent invoice) doesn't abort the
-- rest of the series — it's skipped and counted instead.
create function end_recurring_series(
  p_recurring_session_id uuid,
  p_from_date date,
  p_override_handling text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_series recurring_sessions%rowtype;
  v_session_id uuid;
  v_cancelled_count integer := 0;
  v_skipped_count integer := 0;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select * into v_series from recurring_sessions where id = p_recurring_session_id and tutor_id = v_tutor_id for update;
  if v_series.id is null then
    raise exception 'Recurring session not found.';
  end if;
  if v_series.status = 'cancelled' then
    raise exception 'This series is already cancelled.';
  end if;

  -- end_date must stay >= start_date (table check constraint) — a series
  -- cancelled on or before its own start never has a valid "day before
  -- start" end_date to record, but status='cancelled' alone already halts
  -- generateRecurringInstances (it bails out for any non-'active' status),
  -- so end_date is simply left untouched in that branch.
  update recurring_sessions
  set end_date = case when p_from_date > v_series.start_date then p_from_date - 1 else end_date end,
      status = case when p_from_date <= v_series.start_date then 'cancelled' else 'ended' end
  where id = p_recurring_session_id;

  for v_session_id in
    select id from sessions
    where recurring_session_id = p_recurring_session_id
      and occurred_on >= p_from_date
      and cancelled_at is null
      and status = 'logged'
  loop
    begin
      perform cancel_session(v_session_id, p_override_handling);
      v_cancelled_count := v_cancelled_count + 1;
    exception when others then
      v_skipped_count := v_skipped_count + 1;
    end;
  end loop;

  return json_build_object('cancelled', v_cancelled_count, 'skipped', v_skipped_count);
end;
$$;

revoke execute on function end_recurring_series(uuid, date, text) from public;
grant execute on function end_recurring_series(uuid, date, text) to authenticated;
