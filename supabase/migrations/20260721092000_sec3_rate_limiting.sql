-- Security review finding: no rate limiting exists anywhere in the app.
-- app/book/[token] and app/t/[handle]/book (fully anonymous, DB-writing,
-- and each triggers a metered Resend/Twilio send on success) plus signup
-- and invite/tutor-code redemption had zero abuse protection — a low-effort
-- cost/DoS vector. Rather than provision a new external service (Upstash/KV)
-- for this, this uses the DB that's already the source of truth: a small
-- fixed-window counter table plus an atomic SECURITY DEFINER check-and-
-- increment function, called once per attempt from the relevant server
-- action/route with an IP+action-scoped key.
create table rate_limit_buckets (
  bucket_key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

-- No RLS policies at all — direct table access is fully default-deny for
-- every role; the only sanctioned access path is check_rate_limit() below.
alter table rate_limit_buckets enable row level security;

revoke all on table rate_limit_buckets from public, anon, authenticated;

-- Atomic fixed-window rate limiter: increments (or resets, if the window has
-- elapsed) a single row per bucket_key and returns whether this attempt is
-- still within p_max_count for the current window. The insert...on conflict
-- makes the check-and-increment a single atomic statement (no separate
-- select-then-update TOCTOU race under concurrent requests for the same key).
create or replace function check_rate_limit(p_key text, p_max_count integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
begin
  insert into rate_limit_buckets (bucket_key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (bucket_key) do update
    set count = case
          when rate_limit_buckets.window_start <= v_now - make_interval(secs => p_window_seconds)
            then 1
          else rate_limit_buckets.count + 1
        end,
        window_start = case
          when rate_limit_buckets.window_start <= v_now - make_interval(secs => p_window_seconds)
            then v_now
          else rate_limit_buckets.window_start
        end
  returning count into v_count;

  return v_count <= p_max_count;
end;
$$;

-- Callable by both anonymous visitors (booking pages, signup) and signed-in
-- users (invite/tutor-code redemption) — safe to grant broadly since the
-- function only ever touches its own bookkeeping table, never app data.
revoke execute on function check_rate_limit(text, integer, integer) from public;
grant execute on function check_rate_limit(text, integer, integer) to anon, authenticated;
