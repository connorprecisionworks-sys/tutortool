-- D12: auto-send invoices, opt-in per client, default OFF.
--
-- Three trigger modes (clients.auto_invoice_trigger): 'weekly' (cadence,
-- driven by the new daily cron reading auto_invoice_next_date), 'after_session'
-- (fires right after a regular session is logged for that client), and
-- 'package_depleted' (fires when a package tied to that client hits 0
-- remaining sessions). All three funnel through the same entry point,
-- run_client_auto_invoice(), so there is exactly one place that decides what
-- "unbilled" means and how a client gets billed automatically.
--
-- run_client_auto_invoice is deliberately NOT keyed off current_tutor_id() —
-- unlike every other invoice function, its caller is never a signed-in
-- tutor's own request. The cron uses the service-role admin client (no
-- auth.uid() at all); the after_session/package_depleted triggers fire from
-- inside an already-authenticated, already-ownership-checked tutor server
-- action, but deliberately go through the admin client too (see
-- lib/auto-invoice.ts) so this function has exactly one calling convention
-- to reason about. It is granted to service_role only — never to
-- authenticated or anon — so it can't be invoked directly by a tutor's own
-- session even for their own client; the app-level opt-in gate
-- (auto_invoice_enabled) is re-checked inside the function itself as
-- defense-in-depth against a bug in a future caller.
--
-- The money logic (session eligibility, credit application, line items,
-- send/due-date resolution) is copied verbatim from create_draft_invoice
-- (D4's version) and send_invoice (Q5's version) rather than calling them,
-- since both derive their tutor scope from current_tutor_id(). Duplicated
-- deliberately so this never becomes a second, drifting reimplementation of
-- the money math in application code — it's still the same SQL, just with
-- the tutor scope threaded through as a parameter instead of auth.uid().

create table auto_invoice_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  -- e.g. 'weekly:2026-07-26', 'session:<uuid>', 'package:<uuid>' — claimed
  -- via insert-then-check-unique-violation, same dedup pattern as
  -- `reminders` (Q6), so a retried cron run or a race between two triggers
  -- can never generate two invoices for the same event.
  trigger_key text not null,
  invoice_id uuid references invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (client_id, trigger_key)
);

create index auto_invoice_runs_client_id_idx on auto_invoice_runs (client_id);

alter table auto_invoice_runs enable row level security;

create policy "auto_invoice_runs_select_own" on auto_invoice_runs
  for select using (
    client_id in (
      select id from clients where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

alter table clients
  add column auto_invoice_enabled boolean not null default false,
  add column auto_invoice_trigger text not null default 'weekly'
    check (auto_invoice_trigger in ('weekly', 'after_session', 'package_depleted')),
  -- Only meaningful when auto_invoice_enabled and auto_invoice_trigger =
  -- 'weekly'. Set to today + 7 whenever the tutor (re)enables weekly mode
  -- (see updateAutoInvoiceSettingsAction), so a freshly-enabled client's
  -- first auto-invoice always fires one cadence period out, never
  -- immediately on save.
  add column auto_invoice_next_date date;

alter table invoices add column auto_generated boolean not null default false;

create function run_client_auto_invoice(p_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid;
  v_enabled boolean;
  v_invoice_id uuid;
  v_session record;
  v_line_count integer := 0;
  v_subtotal integer := 0;
  v_available_credit integer;
  v_credit_to_apply integer;
  v_credit_row credits%rowtype;
  v_consume integer;
  v_total_consumed integer;
  v_min_occurred date;
  v_max_occurred date;
  v_terms text;
  v_timing text;
begin
  select tutor_id, auto_invoice_enabled into v_tutor_id, v_enabled
  from clients where id = p_client_id;

  if v_tutor_id is null then
    raise exception 'Student not found.';
  end if;
  if not v_enabled then
    raise exception 'Auto-invoicing is not enabled for this student.';
  end if;

  -- Auto mode has no tutor-picked date range (unlike the manual flow) — it
  -- always sweeps up whatever's currently unbilled. period_start/period_end
  -- are placeholders here and get set below from the sessions actually
  -- locked and claimed in the loop, not from a separate pre-loop query —
  -- a session that becomes eligible in the gap between two queries would
  -- otherwise risk landing outside a period computed too early.
  insert into invoices (tutor_id, client_id, period_start, period_end, status, payment_timing, auto_generated)
  values (
    v_tutor_id, p_client_id, current_date, current_date, 'draft',
    (select default_payment_timing from tutors where id = v_tutor_id),
    true
  )
  returning id into v_invoice_id;

  for v_session in
    select * from sessions
    where tutor_id = v_tutor_id
      and client_id = p_client_id
      and invoice_id is null
      and status = 'logged'
      and cancelled_at is null
      and package_id is null
    order by occurred_on
    for update
  loop
    insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents, line_type)
    values (
      v_invoice_id,
      v_session.id,
      'Session on ' || to_char(v_session.occurred_on, 'FMMM/FMDD/YYYY')
        || case when v_session.travel_minutes > 0 and v_session.bill_travel
             then ' (' || v_session.duration_minutes || ' min + ' || v_session.travel_minutes || ' min travel)'
             else ' (' || v_session.duration_minutes || ' min)'
           end,
      v_session.duration_minutes + case when v_session.bill_travel then v_session.travel_minutes else 0 end,
      session_amount_cents(
        v_session.duration_minutes,
        v_session.travel_minutes,
        v_session.effective_rate_cents,
        v_session.bill_travel,
        v_session.travel_rate_cents,
        v_session.service_price_cents
      ),
      'charge'
    );

    update sessions set invoice_id = v_invoice_id where id = v_session.id;
    v_line_count := v_line_count + 1;
    if v_min_occurred is null or v_session.occurred_on < v_min_occurred then
      v_min_occurred := v_session.occurred_on;
    end if;
    if v_max_occurred is null or v_session.occurred_on > v_max_occurred then
      v_max_occurred := v_session.occurred_on;
    end if;
  end loop;

  if v_line_count = 0 then
    delete from invoices where id = v_invoice_id;
    return null;
  end if;

  update invoices set period_start = v_min_occurred, period_end = v_max_occurred where id = v_invoice_id;

  select coalesce(sum(amount_cents), 0) into v_subtotal
  from invoice_line_items where invoice_id = v_invoice_id and line_type = 'charge';

  select coalesce(sum(remaining_cents), 0) into v_available_credit
  from credits where tutor_id = v_tutor_id and client_id = p_client_id and remaining_cents > 0;

  if v_available_credit > 0 and v_subtotal > 0 then
    v_credit_to_apply := least(v_available_credit, v_subtotal);
    v_total_consumed := 0;

    for v_credit_row in
      select * from credits
      where tutor_id = v_tutor_id and client_id = p_client_id and remaining_cents > 0
      order by created_at
      for update
    loop
      exit when v_credit_to_apply <= 0;
      v_consume := least(v_credit_row.remaining_cents, v_credit_to_apply);
      update credits set remaining_cents = remaining_cents - v_consume where id = v_credit_row.id;
      v_credit_to_apply := v_credit_to_apply - v_consume;
      v_total_consumed := v_total_consumed + v_consume;
    end loop;

    if v_total_consumed > 0 then
      insert into invoice_line_items (invoice_id, session_id, description, quantity_minutes, amount_cents, line_type)
      values (v_invoice_id, null, 'Credit applied', null, v_total_consumed, 'credit');
    end if;
  end if;

  perform recompute_invoice_totals(v_invoice_id);

  select invoice_terms into v_terms from tutors where id = v_tutor_id;
  select payment_timing into v_timing from invoices where id = v_invoice_id;

  update invoices
  set status = 'sent',
      sent_at = now(),
      due_date = case
        when v_timing = 'pay_before' then current_date
        else (current_date + case v_terms
          when 'net_7' then 7
          when 'net_14' then 14
          when 'net_30' then 30
          else 0
        end)
      end
  where id = v_invoice_id;

  update sessions set status = 'billed' where invoice_id = v_invoice_id;

  return v_invoice_id;
end;
$$;

-- This project's public schema has default privileges that grant EXECUTE on
-- every new function directly to anon/authenticated (not just via PUBLIC) —
-- confirmed empirically with has_function_privilege() before this fix was
-- added. Revoking from public alone does NOT remove those, since they were
-- granted straight to the role, not inherited through PUBLIC. All three
-- revokes are required for this function to actually be service_role-only.
revoke execute on function run_client_auto_invoice(uuid) from public;
revoke execute on function run_client_auto_invoice(uuid) from authenticated;
revoke execute on function run_client_auto_invoice(uuid) from anon;
grant execute on function run_client_auto_invoice(uuid) to service_role;

-- New system email template, sent when auto-invoicing generates and sends
-- an invoice (there's no tutor in the loop to manually share the payment
-- link, unlike the manual flow, so this send is not optional the way the
-- manual "share this link yourself" step is). Seed it onto every existing
-- tutor row and update the column default so new tutors get it too — same
-- pattern D9 used for 'invite_parent'.
update tutors
set reminder_templates = jsonb_set(
  reminder_templates, '{auto_invoice_sent}',
  '{"subject":"{{student}}''s invoice is ready","body":"Hi! {{tutor}} just sent an automatic invoice for {{student}} — {{amount}}, due {{due_date}}. Pay anytime here: {{link}}"}'::jsonb
)
where not (reminder_templates ? 'auto_invoice_sent');

alter table tutors alter column reminder_templates set default '{
  "offset_0": {
    "subject": "{{student}}''s invoice is ready",
    "body": "Hi! {{tutor}} has an invoice ready for {{student}} — {{amount}}, due today. Pay anytime here: {{link}}"
  },
  "offset_3": {
    "subject": "Quick nudge — {{student}}''s invoice",
    "body": "Hi! Just floating this back up — {{student}}''s invoice ({{amount}}) was due a few days ago. No rush, pay whenever works: {{link}}"
  },
  "offset_7": {
    "subject": "Following up — {{student}}''s invoice",
    "body": "Hi! One more friendly check-in on {{student}}''s invoice ({{amount}}), due last week. Let {{tutor}} know if anything''s off: {{link}}"
  },
  "booking_confirmation": {
    "subject": "You''re booked with {{tutor}}",
    "body": "You''re all set! {{student}}''s session with {{tutor}} is confirmed for {{when}}."
  },
  "session_reminder": {
    "subject": "Reminder — {{student}}''s session is coming up",
    "body": "Just a heads up: {{student}}''s session with {{tutor}} is coming up on {{when}}. Let {{tutor}} know if anything''s changed."
  },
  "invite_parent": {
    "subject": "You''re invited to Slate for {{student}}",
    "body": "{{tutor}} uses Slate to share {{student}}''s sessions, notes, schedule, and invoices with you. Join here: {{link}} (or enter code {{code}})."
  },
  "auto_invoice_sent": {
    "subject": "{{student}}''s invoice is ready",
    "body": "Hi! {{tutor}} just sent an automatic invoice for {{student}} — {{amount}}, due {{due_date}}. Pay anytime here: {{link}}"
  }
}'::jsonb;
