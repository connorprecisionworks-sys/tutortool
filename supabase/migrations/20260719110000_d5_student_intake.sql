-- D5: student intake — a structured "needs & goals" field alongside the
-- existing payer_name/payer_email/payer_phone parent-contact fields
-- (already on `clients`, just ungrouped in the UI today). No RLS change
-- needed — clients_select_own/update_own already cover the new column,
-- and it's never selected anywhere in app/parent/**.

alter table clients add column needs_goals text;

-- create_student gains p_needs_goals — adding a parameter changes the
-- function's identity, so the prior 12-arg overload (Q8) must be dropped
-- explicitly or it lingers alongside the new one.
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
  p_notes text,
  p_sms_opt_in boolean,
  p_needs_goals text
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
    scheduling_mode, notes, sms_opt_in, needs_goals
  )
  values (
    v_tutor_id, p_student_name, p_payer_name, p_payer_email, p_payer_phone, p_rate_type,
    p_custom_rate_cents, p_bill_travel, p_travel_rate_cents, p_is_philanthropic,
    p_scheduling_mode, p_notes, p_sms_opt_in, p_needs_goals
  )
  returning * into v_student;

  perform create_invite(v_student.id);

  return v_student;
end;
$$;

revoke execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text, boolean, text) from public;
grant execute on function create_student(text, text, text, text, rate_type, integer, boolean, integer, boolean, text, text, boolean, text) to authenticated;
