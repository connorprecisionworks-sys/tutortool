-- Full-CRUD pass, part 2: a real "delete an invoice" path, restricted to
-- draft invoices only.
--
-- A sent/paid/overdue invoice is a financial record — void_invoice already
-- covers "this shouldn't count anymore" for those without erasing the
-- history. A DRAFT invoice is still the tutor's in-progress workspace
-- (never sent to anyone), so deleting it outright is safe and matches how
-- create_draft_invoice/remove_line_item already treat draft state as
-- freely mutable. Mirrors void_invoice's session-release behavior so
-- deleted-draft sessions go straight back into the unbilled pool instead
-- of being stuck with a dangling invoice_id.

create function delete_draft_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  -- Lock the invoice row before checking status — a plain existence check
  -- here would be stale by the time we delete: a concurrent send_invoice
  -- could commit in between, and this function would still remove the
  -- (now-sent, now-billed-sessions-attached) invoice while its sessions
  -- were already flipped to 'billed', permanently detaching them with no
  -- way back (too billed to re-edit, not 'logged' so unclaimable by a new
  -- draft invoice). Locking forces send_invoice's own UPDATE on this row
  -- to block until we're done, so the status we check is still true when
  -- we act on it.
  perform 1 from invoices where id = p_invoice_id and tutor_id = v_tutor_id and status = 'draft' for update;
  if not found then
    raise exception 'Only a draft invoice can be deleted — void it instead if it has already been sent.';
  end if;

  -- invoice_line_items cascades via its own FK; sessions.invoice_id is
  -- released to null via its own FK's `on delete set null` — no need to
  -- touch either table explicitly before this delete.
  delete from invoices where id = p_invoice_id and tutor_id = v_tutor_id and status = 'draft';
end;
$$;

revoke execute on function delete_draft_invoice(uuid) from public;
grant execute on function delete_draft_invoice(uuid) to authenticated;
