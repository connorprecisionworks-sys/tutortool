-- Rollback D15: meeting links. Restores update_session to its pre-D15 (D4)
-- signature/body, then drops the column. The 8-arg overload must be
-- dropped explicitly first — create or replace can't turn an 8-arg
-- function back into a 7-arg one, it would just add a second overload.

drop function if exists update_session(uuid, date, time, integer, integer, text, text, text);

create or replace function update_session(
  p_session_id uuid,
  p_occurred_on date,
  p_start_time time,
  p_duration_minutes integer,
  p_travel_minutes integer,
  p_location text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_session sessions%rowtype;
  v_client clients%rowtype;
  v_tutor tutors%rowtype;
  v_effective_rate integer;
  v_bill_travel boolean;
  v_travel_rate integer;
  v_line_item_id uuid;
  v_amount_cents integer;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  select * into v_session from sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if v_session.id is null then
    raise exception 'Session not found.';
  end if;
  if v_session.status = 'billed' then
    raise exception 'This session is already billed and can''t be edited. Void the invoice first if it needs to change.';
  end if;
  if v_session.cancelled_at is not null then
    raise exception 'This session was cancelled and can''t be edited — its record is kept as-is.';
  end if;
  if p_duration_minutes <= 0 then
    raise exception 'Duration must be more than 0 minutes.';
  end if;
  if p_travel_minutes < 0 then
    raise exception 'Travel minutes can''t be negative.';
  end if;

  if v_session.service_id is not null then
    p_duration_minutes := v_session.duration_minutes;
  end if;

  if v_session.invoice_id is not null then
    if not exists (
      select 1 from invoices
      where id = v_session.invoice_id and p_occurred_on between period_start and period_end
    ) then
      raise exception 'That date falls outside this session''s invoice period — remove it from the invoice first if it needs to move.';
    end if;
  end if;

  select * into v_client from clients where id = v_session.client_id;
  select * into v_tutor from tutors where id = v_tutor_id;

  v_effective_rate := case
    when v_client.rate_type = 'pro_bono' then 0
    when v_client.rate_type = 'standard' then v_tutor.standard_rate_cents
    else coalesce(v_client.custom_rate_cents, v_tutor.standard_rate_cents)
  end;
  v_bill_travel := coalesce(v_client.bill_travel, v_tutor.bill_travel_default);
  v_travel_rate := case
    when v_bill_travel then coalesce(v_client.travel_rate_cents, v_tutor.travel_rate_cents, v_effective_rate)
    else null
  end;

  update sessions
  set occurred_on = p_occurred_on,
      start_time = p_start_time,
      duration_minutes = p_duration_minutes,
      travel_minutes = p_travel_minutes,
      location = p_location,
      bill_travel = v_bill_travel,
      effective_rate_cents = v_effective_rate,
      travel_rate_cents = v_travel_rate,
      notes = p_notes
  where id = p_session_id;

  if v_session.invoice_id is not null then
    v_amount_cents := session_amount_cents(
      p_duration_minutes, p_travel_minutes, v_effective_rate, v_bill_travel, v_travel_rate, v_session.service_price_cents
    );

    select id into v_line_item_id from invoice_line_items
    where invoice_id = v_session.invoice_id and session_id = p_session_id;

    if v_line_item_id is not null then
      update invoice_line_items
      set amount_cents = v_amount_cents,
          description = 'Session on ' || to_char(p_occurred_on, 'FMMM/FMDD/YYYY')
            || case when p_travel_minutes > 0 and v_bill_travel
                 then ' (' || p_duration_minutes || ' min + ' || p_travel_minutes || ' min travel)'
                 else ' (' || p_duration_minutes || ' min)'
               end,
          quantity_minutes = p_duration_minutes + case when v_bill_travel then p_travel_minutes else 0 end
      where id = v_line_item_id;

      perform recompute_invoice_totals(v_session.invoice_id);
    end if;
  end if;
end;
$$;

-- Note: cannot drop meeting_link from the view before dropping it from the
-- base table would fail the other way (view depends on the column) — drop
-- the view's dependency on it first by recreating without it, then the
-- column drop below is safe.
create or replace view parent_visible_sessions
with (security_invoker = false)
as
select
  id,
  tutor_id,
  client_id,
  occurred_on,
  start_time,
  duration_minutes,
  travel_minutes,
  location,
  status,
  created_at
from sessions
where is_parent_of_student(client_id);

alter table sessions drop column if exists meeting_link;
