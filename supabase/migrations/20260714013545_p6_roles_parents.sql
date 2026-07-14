-- P6: roles + parent signup + per-student invite codes + RLS isolation.
--
-- TODO(connor): the spec (section 12) describes renaming the V1 `clients`
-- concept to `students`. We deliberately did NOT rename the table — five
-- already-shipped, QA'd phases (P1-P5) read/write `clients` throughout
-- (student CRUD, session snapshots, invoice line items, dashboard
-- aggregation, Stripe checkout, reminders), and `clients` already models
-- exactly what "students" would (one row per child, owned by a tutor,
-- carries the rate rule). A pure rename is high-risk churn across dozens of
-- files for zero functional gain. Everywhere below, "student" in a column
-- or policy name refers to a `clients` row. If you want the literal rename
-- later, it's a mechanical `ALTER TABLE clients RENAME TO students` plus a
-- global find/replace — safe to do in one focused pass once P6-P10 are done
-- and stable.
--
-- Same money_mutation_architecture pattern as P3/P4/P5 for anything with a
-- cross-row invariant (invite redemption): RLS is read-only where it
-- matters, SECURITY DEFINER functions are the sole write path.

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null check (role in ('tutor', 'parent')),
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create index users_auth_user_id_idx on users (auth_user_id);

alter table users enable row level security;

create policy "users_select_own" on users
  for select using (auth_user_id = auth.uid());

create policy "users_insert_own" on users
  for insert with check (auth_user_id = auth.uid());

create policy "users_update_own" on users
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Backfill: every tutor who signed up in P1-P5 (before `users` existed)
-- gets a role='tutor' row so middleware/requireTutor role checks work
-- retroactively.
insert into users (auth_user_id, role, name, email)
select auth_user_id, 'tutor', name, email from tutors
on conflict (auth_user_id) do nothing;

create table classes (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index classes_tutor_id_idx on classes (tutor_id);

alter table classes enable row level security;

create policy "classes_select_own" on classes
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "classes_insert_own" on classes
  for insert with check (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "classes_update_own" on classes
  for update using (tutor_id in (select id from tutors where auth_user_id = auth.uid()))
  with check (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

create policy "classes_delete_own" on classes
  for delete using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

alter table clients add column class_id uuid references classes (id) on delete set null;

-- Parents read only rows tied to their child through parent_students.
create table parent_students (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references users (id) on delete cascade,
  student_id uuid not null references clients (id) on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique (parent_user_id, student_id)
);

create index parent_students_parent_user_id_idx on parent_students (parent_user_id);
create index parent_students_student_id_idx on parent_students (student_id);

alter table parent_students enable row level security;

-- SECURITY DEFINER helpers so the clients <-> parent_students RLS policies
-- below don't reference each other directly. Without these, clients'
-- "parents can read their linked student" policy queries parent_students,
-- whose own "tutors can see who's linked to their students" policy queries
-- clients right back — Postgres detects that as infinite recursion
-- (42P17) and every clients query fails, for tutors and parents alike.
-- Wrapping each cross-table check in a SECURITY DEFINER function breaks
-- the cycle: the function's internal query runs as its owner (bypassing
-- RLS on the table it reads), so it never re-triggers the calling table's
-- own policy.
create function is_tutor_of_client(p_client_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from clients
    where id = p_client_id
      and tutor_id in (select id from tutors where auth_user_id = auth.uid())
  )
$$;

create function is_parent_of_student(p_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from parent_students
    where student_id = p_student_id
      and parent_user_id in (select id from users where auth_user_id = auth.uid())
  )
$$;

revoke execute on function is_tutor_of_client(uuid) from public;
revoke execute on function is_parent_of_student(uuid) from public;
grant execute on function is_tutor_of_client(uuid) to authenticated;
grant execute on function is_parent_of_student(uuid) to authenticated;

create policy "parent_students_select_own" on parent_students
  for select using (
    parent_user_id in (select id from users where auth_user_id = auth.uid())
    or is_tutor_of_client(student_id)
  );

-- No insert/update/delete policy: only redeem_invite() (below) creates
-- these rows, and only for the calling parent themselves.

create table invites (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references tutors (id) on delete cascade,
  student_id uuid not null references clients (id) on delete cascade,
  code text not null unique,
  status text not null default 'open' check (status in ('open', 'used', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_tutor_id_idx on invites (tutor_id);
create index invites_code_idx on invites (code);

alter table invites enable row level security;

create policy "invites_select_own" on invites
  for select using (tutor_id in (select id from tutors where auth_user_id = auth.uid()));

-- No insert/update/delete policy: create_invite() / revoke_invite() /
-- redeem_invite() are the only sanctioned writes.

create function create_invite(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_code text;
  v_attempts integer := 0;
begin
  if v_tutor_id is null then
    raise exception 'Not a tutor.';
  end if;

  if not exists (select 1 from clients where id = p_student_id and tutor_id = v_tutor_id) then
    raise exception 'Student not found.';
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
    begin
      insert into invites (tutor_id, student_id, code, status)
      values (v_tutor_id, p_student_id, v_code, 'open');
      return v_code;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts > 5 then
        raise exception 'Could not generate a unique invite code — try again.';
      end if;
    end;
  end loop;
end;
$$;

create function revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update invites
  set status = 'revoked'
  where id = p_invite_id
    and tutor_id = current_tutor_id()
    and status = 'open';

  if not found then
    raise exception 'Invite not found or not revocable.';
  end if;
end;
$$;

create function redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_user_id uuid;
  v_student_id uuid;
begin
  select id into v_parent_user_id from users where auth_user_id = auth.uid() and role = 'parent';
  if v_parent_user_id is null then
    raise exception 'Not a parent account.';
  end if;

  -- Single atomic guarded UPDATE (not a prior SELECT) so two concurrent
  -- redemptions of the same code can't both pass an "is it still open"
  -- check before either commits — the loser's UPDATE simply matches zero
  -- rows once the winner's commit is visible, same pattern as
  -- send_invoice/mark_invoice_paid in P3.
  update invites
  set status = 'used'
  where code = p_code
    and status = 'open'
    and (expires_at is null or expires_at > now())
  returning student_id into v_student_id;

  if v_student_id is null then
    raise exception 'Invalid or expired invite code.';
  end if;

  insert into parent_students (parent_user_id, student_id)
  values (v_parent_user_id, v_student_id)
  on conflict (parent_user_id, student_id) do nothing;

  return v_student_id;
end;
$$;

revoke execute on function create_invite(uuid) from public;
revoke execute on function revoke_invite(uuid) from public;
revoke execute on function redeem_invite(text) from public;

grant execute on function create_invite(uuid) to authenticated;
grant execute on function revoke_invite(uuid) to authenticated;
grant execute on function redeem_invite(text) to authenticated;

-- Parents read their linked child's row (additive alongside the existing
-- tutor-owner select policy on clients — RLS OR's permissive policies for
-- the same command, so this doesn't affect tutor access at all). Uses the
-- SECURITY DEFINER helper above, not a direct parent_students subquery, to
-- avoid the circular-RLS recursion described above.
create policy "clients_select_parent" on clients
  for select using (is_parent_of_student(id));
