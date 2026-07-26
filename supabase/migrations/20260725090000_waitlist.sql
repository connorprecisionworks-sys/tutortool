-- NOT YET APPLIED.
--
-- Pre-launch waitlist capture for the new marketing landing page. One row per
-- email; two optional survey fields (subjects taught, roster size) feed the
-- future "real numbers" marketing stats, so they're first-class columns rather
-- than a JSON blob. `source` records which form placement converted
-- (hero vs closing band) for a cheap read on page effectiveness.
--
-- Same access model as rate_limit_buckets (sec3): RLS enabled with zero
-- policies — direct table access is fully default-deny for every role; the
-- only sanctioned write path is the SECURITY DEFINER function below, and
-- reads happen via service_role/dashboard only. Emails are PII, so nothing
-- readable is ever granted to anon/authenticated.
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  subjects text,
  num_students text,
  source text,
  created_at timestamptz not null default now()
);

alter table waitlist enable row level security;

revoke all on table waitlist from public, anon, authenticated;

-- Atomic join-or-update: a duplicate email is treated as a clean success —
-- the function's return value never distinguishes "new signup" from "already
-- on the list", so a caller can't probe which emails have signed up. The
-- ON CONFLICT branch coalesces survey fields instead of DO NOTHING because
-- the form submits in two steps (email first, optional survey after): the
-- second call must be able to attach answers to the row the first call
-- created, and a later duplicate join with no answers must not blank out
-- answers already given.
--
-- Email validation here is a format sanity floor (server actions validate
-- properly with zod before calling); it exists so the function is safe to
-- call on its own, not dependent on every future caller validating.
create or replace function join_waitlist(
  p_email text,
  p_subjects text default null,
  p_num_students text default null,
  p_source text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid email.';
  end if;

  insert into waitlist (email, subjects, num_students, source)
  values (v_email, nullif(trim(p_subjects), ''), nullif(trim(p_num_students), ''), nullif(trim(p_source), ''))
  on conflict (email) do update
    set subjects = coalesce(nullif(trim(excluded.subjects), ''), waitlist.subjects),
        num_students = coalesce(nullif(trim(excluded.num_students), ''), waitlist.num_students);
end;
$$;

-- Callable by anonymous visitors (the landing page form) and signed-in users
-- alike. Revoke from public AND anon explicitly before granting — on this
-- project a public-only revoke has left anon/authenticated still able to
-- call (see sec-series migrations); verify with has_function_privilege()
-- if unsure.
revoke execute on function join_waitlist(text, text, text, text) from public, anon, authenticated;
grant execute on function join_waitlist(text, text, text, text) to anon, authenticated;
