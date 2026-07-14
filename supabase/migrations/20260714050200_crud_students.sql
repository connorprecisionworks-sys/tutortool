-- Full-CRUD pass, part 3: a real "delete a student" path.
--
-- clients has an unused delete RLS policy (clients_delete_own) from P1 that
-- would let a direct client call hard-delete a student today — and because
-- almost everything cascades from clients.id (sessions, invoices,
-- resources, invites, parent_students all `on delete cascade`), a raw
-- delete could silently wipe a student's entire paid-invoice history along
-- with them. delete_student() is the sanctioned path from here: it blocks
-- deleting a student who has ever had a non-draft invoice (sent, paid,
-- overdue, or void — i.e. real billing history), directing the tutor to
-- archive instead (already supported, non-destructive). A student with no
-- billing history beyond in-progress drafts is safe to delete outright —
-- draft invoices are released the same way delete_draft_invoice does, then
-- the client row's own cascades take care of everything else.

drop policy "clients_delete_own" on clients;

create function delete_student(p_student_id uuid)
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

  if not exists (select 1 from clients where id = p_student_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  -- Lock every invoice this student has before checking their statuses —
  -- a plain EXISTS here would be stale by the time we delete: a concurrent
  -- send_invoice/mark_invoice_paid on one of the student's draft invoices
  -- could commit in between, and the clients cascade below would then
  -- destroy that now-non-draft invoice anyway, right past the guard this
  -- function exists to enforce. Locking forces those functions' own
  -- UPDATEs on the same rows to block until we're done, so nothing can
  -- change status out from under this check.
  perform 1 from invoices where client_id = p_student_id for update;

  if exists (select 1 from invoices where client_id = p_student_id and status <> 'draft') then
    raise exception 'This student has billing history (a sent, paid, or voided invoice) — archive them instead to keep that record intact.';
  end if;

  -- Only draft invoices exist at this point (guard above ruled out
  -- anything else, and the lock above ensures that's still true) — the
  -- client row's own cascades (invoices, sessions, resources, invites,
  -- parent_students, and transitively invoice_line_items/session_notes)
  -- take care of everything, no need to delete any of them explicitly.
  delete from clients where id = p_student_id and tutor_id = v_tutor_id;
end;
$$;

revoke execute on function delete_student(uuid) from public;
grant execute on function delete_student(uuid) to authenticated;
