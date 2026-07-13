-- P1: tutors + clients (rate rules), RLS: a tutor reads/writes only their own rows.

create type rate_type as enum (
  'standard',
  'professional_discount',
  'friend',
  'low_income',
  'pro_bono'
);

create table tutors (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  standard_rate_cents integer not null default 0,
  travel_rate_cents integer,
  bill_travel_default boolean not null default false,
  stripe_account_id text,
  invoice_terms text not null default 'due_on_receipt',
  reminder_cadence jsonb not null default '{"offsets_days": [0, 3, 7]}'::jsonb,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  student_name text not null,
  payer_name text,
  payer_email text,
  payer_phone text,
  rate_type rate_type not null default 'standard',
  custom_rate_cents integer,
  bill_travel boolean,
  travel_rate_cents integer,
  is_philanthropic boolean not null default false,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index clients_tutor_id_idx on clients (tutor_id);

alter table tutors enable row level security;
alter table clients enable row level security;

create policy "tutors_select_own" on tutors
  for select using (auth_user_id = auth.uid());

create policy "tutors_insert_own" on tutors
  for insert with check (auth_user_id = auth.uid());

create policy "tutors_update_own" on tutors
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy "clients_select_own" on clients
  for select using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  );

create policy "clients_insert_own" on clients
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  );

create policy "clients_update_own" on clients
  for update using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  ) with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  );

create policy "clients_delete_own" on clients
  for delete using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  );
