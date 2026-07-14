-- P5: reminders log + editable templates. RLS: tutor reads only their own
-- rows (via invoice_id -> invoices.tutor_id). Mutation path:
--   - the daily cron job uses the service-role admin client (bypasses RLS
--     by design, same as the Stripe webhook)
--   - a tutor-triggered "send reminder now" goes through log_reminder(),
--     a SECURITY DEFINER function that re-derives its own auth, matching
--     the money_mutation_architecture pattern from P3/P4

create table reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  sent_at timestamptz not null default now(),
  channel text not null default 'email',
  template_key text not null
);

create index reminders_invoice_id_idx on reminders (invoice_id);

-- Guards the automated cadence path against duplicate sends from concurrent
-- cron invocations: the job inserts-to-claim before sending, and a unique
-- violation means another run already claimed/sent that exact offset for
-- that invoice. Manual "send reminder now" sends use a distinct
-- {key}_manual_{timestamp} template_key (see reminder-actions.ts) so a
-- tutor can deliberately resend without ever colliding with this
-- constraint or with the automated cadence's own keys.
alter table reminders add constraint reminders_invoice_template_unique unique (invoice_id, template_key);

alter table reminders enable row level security;

create policy "reminders_select_own" on reminders
  for select using (
    invoice_id in (
      select id from invoices
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

-- No insert/update/delete policy: default-deny for direct client writes.

create function log_reminder(p_invoice_id uuid, p_template_key text, p_channel text default 'email')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from invoices
    where id = p_invoice_id
      and tutor_id = current_tutor_id()
      and status in ('sent', 'overdue')
  ) then
    raise exception 'Invoice not found or not reminder-eligible.';
  end if;

  insert into reminders (invoice_id, channel, template_key)
  values (p_invoice_id, p_channel, p_template_key)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function log_reminder(uuid, text, text) from public;
grant execute on function log_reminder(uuid, text, text) to authenticated;

-- Editable, warm/non-nagging default templates keyed by cadence offset
-- (matches tutors.reminder_cadence's default {"offsets_days": [0, 3, 7]}
-- from P1). Plain self-service field on tutors — no new RLS needed, same
-- as standard_rate_cents etc.
alter table tutors add column reminder_templates jsonb not null default '{
  "offset_0": {
    "subject": "Invoice for {{student}} is due today",
    "body": "Hi! Just a friendly note that the invoice for {{student}}''s sessions is due today. Thanks so much for tutoring with {{tutor}} — pay whenever is convenient: {{link}}"
  },
  "offset_3": {
    "subject": "Quick reminder: invoice for {{student}}",
    "body": "Hi! Floating this back to the top — the invoice for {{student}} was due a few days ago, no rush at all. Link: {{link}}"
  },
  "offset_7": {
    "subject": "Following up on {{student}}''s invoice",
    "body": "Hi! Circling back one more time on the invoice for {{student}} from last week. Let me know if you have any questions — happy to help. Link: {{link}}"
  }
}'::jsonb;
