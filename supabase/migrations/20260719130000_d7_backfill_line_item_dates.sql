-- D4 shipped a new to_char format for invoice_line_items.description going
-- forward (create_draft_invoice/update_session), but never backfilled text
-- already stored on existing rows — a tutor's older invoices kept showing
-- "Session on Jul 05, 2026" while every other date on the same page
-- switched to "7/5/2026". Idempotent and precisely scoped: only rows with
-- a non-null session_id are touched (manual/credit lines have no
-- session_id and are left exactly as the tutor wrote them), and the
-- description is always fully regenerated from that session's current
-- data — running this again after a real edit just reproduces the same
-- correct text, never drifts.
update invoice_line_items li
set description = 'Session on ' || to_char(s.occurred_on, 'FMMM/FMDD/YYYY')
  || case when s.travel_minutes > 0 and s.bill_travel
       then ' (' || s.duration_minutes || ' min + ' || s.travel_minutes || ' min travel)'
       else ' (' || s.duration_minutes || ' min)'
     end
from sessions s
where li.session_id = s.id;
