-- P8: resources library (file/link) scoped to a student, visible in the
-- parent portal for that student only.
--
-- TODO(connor): section 12's data model also allows resources scoped to a
-- `class_id` instead of a student. We deliberately did NOT wire that up —
-- there is no class-management UI anywhere in this build yet (classes is
-- an inert table created in P6 for future use, per spec's "1:1 tutors can
-- ignore it"), so a class_id column/constraint/RLS branch here would be
-- pure dead surface area with no way to create, reach, or test it. Scoped
-- resources to student_id only, matching what's actually buildable right
-- now; add class_id back (with the matching parent-visibility branch and
-- the parent resources page query) once a class-management UI exists.
--
-- Storage note: the 'resources' bucket stays fully private — no
-- storage.objects RLS policies are added at all (default deny). Both
-- upload and download go exclusively through server actions using the
-- service-role admin client, with authorization enforced entirely by the
-- `resources` table's own RLS (fetch the row through the tutor/parent's
-- authenticated client first — if that succeeds, they're allowed to
-- upload/download; the admin client then does the actual storage I/O).
-- This keeps a single source of truth for "who can see this resource"
-- instead of duplicating that logic into Storage policies too.

insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

create type resource_type as enum ('file', 'link');

create table resources (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  student_id uuid not null references clients (id) on delete cascade,
  title text not null,
  type resource_type not null,
  url_or_path text not null,
  created_at timestamptz not null default now()
);

create index resources_tutor_id_idx on resources (tutor_id);
create index resources_student_id_idx on resources (student_id);

alter table resources enable row level security;

create policy "resources_select_own" on resources
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "resources_select_parent" on resources
  for select using (is_parent_of_student(student_id));

create policy "resources_insert_own" on resources
  for insert with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and student_id in (
      select id from clients
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

create policy "resources_delete_own" on resources
  for delete using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

-- No update policy: resources are immutable once created (delete + re-add
-- instead of edit) — there's no in-place-edit UI, so no update path needed.
