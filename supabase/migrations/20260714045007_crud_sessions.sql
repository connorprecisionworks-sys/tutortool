-- Full-CRUD pass, part 1: sessions update/delete via SECURITY DEFINER.
--
-- Two problems with the direct-client-write path this closes:
--
-- 1. sessions_update_own (P2) had no status guard at all — a tutor's app
--    code refused to edit a 'billed' session, but nothing stopped a direct
--    REST PATCH from doing it anyway, since RLS alone governed writes.
--    Same bug class the P3/P7 reviews caught for invoices/session_notes.
--
-- 2. A session claimed onto a DRAFT invoice (create_draft_invoice sets
--    invoice_id without flipping status to 'billed' — that only happens on
--    send_invoice) could still be edited or deleted through the direct
--    path, silently desyncing that invoice's line item and total. The
--    money_mutation_architecture invariant ("a draft invoice's total always
--    equals the sum of its line items") has to be maintained by whatever
--    touches a claimed session, which a plain RLS policy can't express.
--
-- update_session/delete_session below are now the only sanctioned write
-- path — sessions_update_own and sessions_delete_own are dropped.
-- sessions_insert_own stays: a brand new session is never pre-attached to
-- an invoice, so there's no cross-row invariant to protect at insert time.

drop policy "sessions_update_own" on sessions;
drop policy "sessions_delete_own" on sessions;

create function update_session(
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

  -- FOR UPDATE locks this session row for the rest of the transaction —
  -- without it, this SELECT is a stale snapshot: a concurrent send_invoice
  -- could commit (flipping status to 'billed' and the parent invoice to
  -- 'sent') between this read and the UPDATE below, which would then
  -- silently overwrite a billed session's fields and rewrite an
  -- already-sent invoice's total. Locking here means send_invoice's own
  -- UPDATE on this same row blocks until we commit, so whatever we read is
  -- guaranteed to still hold by the time we act on it.
  select * into v_session from sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if v_session.id is null then
    raise exception 'Session not found.';
  end if;
  if v_session.status = 'billed' then
    raise exception 'This session is already billed and can''t be edited. Void the invoice first if it needs to change.';
  end if;
  if p_duration_minutes <= 0 then
    raise exception 'Duration must be more than 0 minutes.';
  end if;
  if p_travel_minutes < 0 then
    raise exception 'Travel minutes can''t be negative.';
  end if;

  -- A session claimed onto a draft invoice must stay inside that invoice's
  -- billing period — create_draft_invoice only ever claims sessions whose
  -- occurred_on already falls within period_start/period_end, and nothing
  -- else re-checks that invariant once claimed. Block a date edit that
  -- would break it instead of silently letting the invoice's stated period
  -- drift out of sync with what it actually bills.
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

  -- Re-resolve the rate snapshot from the client's *current* rate rule —
  -- editing a logged session is treated as re-logging it, matching the
  -- direct-client update action this replaces.
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

  -- Only a draft invoice can have a claimed-but-not-yet-billed session
  -- (status check above already rejected 'billed'), so if invoice_id is
  -- set here, resync that invoice's line item and total in the same
  -- transaction rather than leaving them stale.
  if v_session.invoice_id is not null then
    v_amount_cents := session_amount_cents(
      p_duration_minutes, p_travel_minutes, v_effective_rate, v_bill_travel, v_travel_rate
    );

    select id into v_line_item_id from invoice_line_items
    where invoice_id = v_session.invoice_id and session_id = p_session_id;

    if v_line_item_id is not null then
      update invoice_line_items
      set amount_cents = v_amount_cents,
          description = 'Session on ' || to_char(p_occurred_on, 'Mon DD, YYYY')
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

create function delete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_session sessions%rowtype;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  -- Same locking rationale as update_session: without FOR UPDATE, a
  -- concurrent send_invoice could flip this session to 'billed' between
  -- this read and the delete below, and this stale check wouldn't catch it.
  select * into v_session from sessions where id = p_session_id and tutor_id = v_tutor_id for update;
  if v_session.id is null then
    raise exception 'Session not found.';
  end if;
  if v_session.status = 'billed' then
    raise exception 'This session is on a sent or paid invoice — void that invoice first if it needs to change.';
  end if;

  -- Same draft-invoice desync risk as update_session: remove the line item
  -- and resync the total before the session disappears, instead of letting
  -- invoice_line_items.session_id's `on delete set null` silently orphan it.
  if v_session.invoice_id is not null then
    delete from invoice_line_items
    where invoice_id = v_session.invoice_id and session_id = p_session_id;

    perform recompute_invoice_totals(v_session.invoice_id);
  end if;

  delete from sessions where id = p_session_id;
end;
$$;

revoke execute on function update_session(uuid, date, time, integer, integer, text, text) from public;
revoke execute on function delete_session(uuid) from public;

grant execute on function update_session(uuid, date, time, integer, integer, text, text) to authenticated;
grant execute on function delete_session(uuid) to authenticated;
