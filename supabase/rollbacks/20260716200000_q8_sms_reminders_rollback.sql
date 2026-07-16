-- Rollback for 20260716200000_q8_sms_reminders.sql

-- Restore create_student's pre-Q8 (11-arg, no sms_opt_in) signature.
drop function if exists create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text, boolean);

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
  p_notes text
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
    scheduling_mode, notes
  )
  values (
    v_tutor_id, p_student_name, p_payer_name, p_payer_email, p_payer_phone, p_rate_type,
    p_custom_rate_cents, p_bill_travel, p_travel_rate_cents, p_is_philanthropic,
    p_scheduling_mode, p_notes
  )
  returning * into v_student;

  perform create_invite(v_student.id);

  return v_student;
end;
$$;

revoke execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text) from public;
grant execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text) to authenticated;

-- Any sms-channel reminder rows can't survive the constraint reverting to
-- (session_id, kind) without a channel component — same data-loss-on-
-- rollback tradeoff accepted throughout this build's rollbacks.
delete from reminders where channel = 'sms';

drop index if exists reminders_session_kind_unique;
create unique index reminders_session_kind_unique on reminders (session_id, kind) where session_id is not null;

alter table reminders drop constraint if exists reminders_invoice_template_unique;
alter table reminders add constraint reminders_invoice_template_unique unique (invoice_id, template_key);

alter table clients drop column if exists sms_opt_in;
alter table tutors drop column if exists sms_enabled;
