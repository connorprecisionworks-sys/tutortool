-- Q8: SMS as an additional reminder channel, key-gated behind Twilio env
-- vars (same disabled-until-configured pattern as Resend/email — see
-- lib/sms.ts). SMS is sent ALONGSIDE email, not instead of it, for both
-- invoice and session reminders — so the existing reminders dedup
-- constraints (one row per invoice+template_key, one per session+kind)
-- widen to include channel, letting an email row and an sms row coexist
-- for the same logical reminder event.
--
-- See notes/sms-reminders.md for the real-world requirements (A2P 10DLC
-- registration, cost per segment) and the compliance gap in what's built
-- here (tutor-attested consent, not a recipient-verified double opt-in).

alter table tutors add column sms_enabled boolean not null default false;

-- Reuses the existing clients.payer_phone as the SMS destination — no new
-- phone column. Consent is captured on the student form as a checkbox the
-- TUTOR checks (attesting they have the parent's consent), not a double
-- opt-in the parent confirms themselves — see notes/sms-reminders.md for
-- why that's a real limitation to revisit before meaningful volume.
alter table clients add column sms_opt_in boolean not null default false;

alter table reminders drop constraint reminders_invoice_template_unique;
alter table reminders add constraint reminders_invoice_template_unique
  unique (invoice_id, template_key, channel);

drop index reminders_session_kind_unique;
create unique index reminders_session_kind_unique on reminders (session_id, kind, channel) where session_id is not null;

-- create_student gains p_sms_opt_in — adding a parameter changes the
-- function's identity, so the old 11-arg overload must be dropped
-- explicitly or it lingers alongside the new one.
drop function if exists create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text);

create function create_student(
  p_student_name text,
  p_payer_name text,
  p_payer_email text,
  p_payer_phone text,
  p_rate_type rate_type,
  p_custom_rate_cents integer,
  p_bill_travel boolean,
  p_travel_rate_cents integer,
  p_is_philanthropic boolean,
  p_scheduling_mode text,
  p_notes text,
  p_sms_opt_in boolean
)
returns clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_student clients%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  insert into clients (
    tutor_id, student_name, payer_name, payer_email, payer_phone, rate_type,
    custom_rate_cents, bill_travel, travel_rate_cents, is_philanthropic,
    scheduling_mode, notes, sms_opt_in
  )
  values (
    v_tutor_id, p_student_name, p_payer_name, p_payer_email, p_payer_phone, p_rate_type,
    p_custom_rate_cents, p_bill_travel, p_travel_rate_cents, p_is_philanthropic,
    p_scheduling_mode, p_notes, p_sms_opt_in
  )
  returning * into v_student;

  perform create_invite(v_student.id);

  return v_student;
end;
$$;

revoke execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text, boolean) from public;
grant execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text, boolean) to authenticated;
