-- P3: invoices + invoice_line_items. RLS: tutor reads only their own rows.
-- Adds the invoice_id FK to sessions now that invoices exists (P2 left it unconstrained).
--
-- Mutations are NOT exposed via direct-client RLS write policies. The
-- invoice lifecycle (draft -> sent -> paid/void, line item totals) is a
-- state machine with invariants (totals = sum of line items, a session
-- billed at most once, guarded status transitions) that can't be expressed
-- safely as row-level USING/WITH CHECK predicates alone. All writes go
-- through the SECURITY DEFINER functions in the next migration, which
-- re-derive and enforce those invariants inside a single transaction. Only
-- SELECT is granted here so the tutor's own client can still read invoices
-- for rendering.

create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'void');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  client_id uuid not null references clients (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  subtotal_cents integer not null default 0,
  total_cents integer not null default 0,
  status invoice_status not null default 'draft',
  due_date date,
  stripe_invoice_id text,
  stripe_payment_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  paid_method text,
  created_at timestamptz not null default now()
);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  -- null session_id = a manual line (e.g. a materials charge) added by the tutor.
  session_id uuid references sessions (id) on delete set null,
  description text not null,
  quantity_minutes integer,
  amount_cents integer not null check (amount_cents >= 0),
  created_at timestamptz not null default now()
);

alter table sessions
  add constraint sessions_invoice_id_fkey
  foreign key (invoice_id) references invoices (id) on delete set null;

create index invoices_tutor_id_idx on invoices (tutor_id);
create index invoices_client_id_idx on invoices (client_id);
create index invoices_status_idx on invoices (status);
create index invoice_line_items_invoice_id_idx on invoice_line_items (invoice_id);
create index invoice_line_items_session_id_idx on invoice_line_items (session_id);

alter table invoices enable row level security;
alter table invoice_line_items enable row level security;

create policy "invoices_select_own" on invoices
  for select using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  );

create policy "invoice_line_items_select_own" on invoice_line_items
  for select using (
    invoice_id in (
      select id from invoices
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

-- No insert/update/delete policies: default-deny for direct client writes
-- on both tables. See the functions migration for the only sanctioned
-- write path.
