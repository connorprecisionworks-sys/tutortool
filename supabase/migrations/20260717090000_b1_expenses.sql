-- B1: expense/receipt/mileage tracking (tax records module).
--
-- Not a money state machine like invoices/packages — each row is an
-- independent tutor-owned record with no cross-row invariant to protect
-- (nothing sums into a running balance that a direct client write could
-- corrupt), so plain ownership-scoped RLS INSERT/UPDATE/DELETE policies are
-- enough here; no SECURITY DEFINER function layer needed (see
-- money_mutation_architecture memory for when that pattern IS required).
--
-- Receipts follow the exact pattern from the `resources` feature (P8):
-- a private bucket with NO storage.objects policies at all — access is
-- gated entirely through the owning `expenses` row's RLS, and the actual
-- storage I/O happens via the service-role admin client after the table
-- write already proved ownership.

alter table tutors
  add column mileage_rate_cents integer not null default 70
    check (mileage_rate_cents >= 0);
comment on column tutors.mileage_rate_cents is
  'Cents per mile for mileage expense valuation. Defaults to the 2025 IRS standard business mileage rate (70c/mi) — the IRS rate changes yearly, so this needs a tutor-editable settings field, not a hardcoded constant.';

create table expenses (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  incurred_on date not null,
  category text not null check (category in ('supplies', 'curriculum', 'training', 'mileage', 'fees', 'other')),
  amount_cents integer not null check (amount_cents >= 0),
  vendor text,
  note text,
  receipt_path text,
  student_id uuid references clients (id) on delete set null,
  session_id uuid references sessions (id) on delete set null,
  -- Mileage-only fields. amount_cents for a mileage row is always
  -- round(miles * mileage_rate_cents) computed server-side at log time —
  -- mileage_rate_cents is snapshotted here (same reasoning as
  -- sessions.effective_rate_cents) so a later change to the tutor's rate
  -- setting never silently rewrites a past year's totals.
  miles numeric(8, 2),
  mileage_rate_cents integer,
  from_location text,
  to_location text,
  created_at timestamptz not null default now(),
  check (category != 'mileage' or miles is not null)
);

create index expenses_tutor_id_idx on expenses (tutor_id);
create index expenses_tutor_incurred_on_idx on expenses (tutor_id, incurred_on);

alter table expenses enable row level security;

create policy "expenses_select_own" on expenses
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "expenses_insert_own" on expenses
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and (student_id is null or student_id in (
      select id from clients where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
    and (session_id is null or session_id in (
      select id from sessions where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
  );

-- WITH CHECK mirrors the insert policy's FK ownership checks (not just the
-- row's own tutor_id) — see rls_insert_update_asymmetry memory: an UPDATE
-- policy that only re-checks tutor_id would let a tutor reassign
-- student_id/session_id to point at another tutor's row after the fact.
create policy "expenses_update_own" on expenses
  for update
  using (tutor_id in (select id from tutors where auth_user_id = auth.uid()))
  with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and (student_id is null or student_id in (
      select id from clients where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
    and (session_id is null or session_id in (
      select id from sessions where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    ))
  );

create policy "expenses_delete_own" on expenses
  for delete using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;
