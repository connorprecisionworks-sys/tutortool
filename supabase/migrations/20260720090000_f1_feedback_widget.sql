-- F1: in-app feedback widget + diagnostic mini-report (build-queue.md).
--
-- founder_feedback already exists in this shared Supabase project — it's
-- the separate Slate Founders dashboard's own table (a leads/feedback
-- CRM), not a Slate app table, and already has 4 rows worth of schema:
-- id, lead_id, date, source (check: demo/call/in_app), body, tag (check:
-- bug/feature/ux/pricing/praise), status (check: new/queued/built/
-- declined), build_queue_ref, created_at, updated_at. RLS is already
-- enabled with four policies gated on founder_is_allowlisted() for the
-- founders' own dashboard. `source` already reserves an 'in_app' value
-- for exactly this feature.
--
-- Per the F1 spec this migration only EXTENDS the table: two new columns
-- Slate's own writes need, and widening (never narrowing) tag's check to
-- also allow null. Every existing column, existing CHECK value, and the
-- founders' own four policies are left completely untouched — the two new
-- policies below are additional PERMISSIVE policies that OR on top of the
-- existing ones, scoped strictly to a tutor's own in_app rows.

alter table founder_feedback
  add column tutor_id uuid references tutors (id) on delete set null,
  add column context jsonb;

comment on column founder_feedback.tutor_id is
  'Set only for source = ''in_app'' rows written by the Slate feedback widget (F1) — identifies the submitting tutor for RLS (select-own) and founder triage. Always null for founder-authored demo/call rows, and stays null if the tutor account is later deleted.';
comment on column founder_feedback.context is
  'Diagnostic mini-report auto-attached by the Slate feedback widget (F1, build-queue.md), shown to the tutor before send. Shape: { route, page_title, breadcrumb: [{type, label, at}] (last ~10 static button labels / route navigations, never dynamic field values), device: { user_agent, viewport: {width,height}, theme }, timestamp, app_version, console_errors: [{message, at}] }. Never contains form field values, keystrokes, note contents, student names, or parent contact details. Null for non-in_app rows.';

-- Nothing is required to submit feedback except the text (spec: "Nothing
-- required except the text. No star ratings..."), so tag must become
-- nullable for the widget's optional category. Widening the existing
-- check (rather than replacing its allowed values) keeps every prior
-- value — and the founders' own tag filters on non-null rows — unchanged.
alter table founder_feedback alter column tag drop not null;
alter table founder_feedback drop constraint founder_feedback_tag_check;
alter table founder_feedback add constraint founder_feedback_tag_check
  check (tag is null or tag = any (array['bug', 'feature', 'ux', 'pricing', 'praise']));

create index founder_feedback_tutor_id_idx on founder_feedback (tutor_id) where tutor_id is not null;

-- Additive RLS only. No UPDATE/DELETE policy is added for tutors — once
-- sent, feedback can't be edited or withdrawn from the tutor side,
-- matching the spec ("read only their own"). The insert WITH CHECK also
-- pins source/status/lead_id/build_queue_ref so an authenticated tutor
-- can only ever create a fresh, untriaged, unlinked in_app row for
-- themselves — never impersonate a demo/call entry, pre-set another
-- tutor's id, or write into the founders' own triage fields.
create policy "founder_feedback_tutor_insert_own" on founder_feedback
  for insert
  with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and source = 'in_app'
    and status = 'new'
    and lead_id is null
    and build_queue_ref is null
  );

create policy "founder_feedback_tutor_select_own" on founder_feedback
  for select
  using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  );
