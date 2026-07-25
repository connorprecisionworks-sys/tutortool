-- QA follow-up: rate_limit_buckets (sec3) has no cleanup — one row per
-- unique bucket_key ever seen, upserted in place, never deleted. Grows
-- unboundedly with normal traffic.
--
-- Requested approach was a pg_cron scheduled DELETE. This project doesn't
-- use pg_cron anywhere — grepping supabase/migrations turns up no
-- extension enablement or cron.schedule call, and every other recurring
-- job in this codebase (reminders, auto-invoice, generate-recurring-
-- sessions) runs through Vercel Cron hitting a Next.js route instead, not
-- a Postgres-side scheduler. Whether the pg_cron extension is even
-- available on this Supabase project is UNCONFIRMED — that can only be
-- checked with live DB access (`select * from pg_available_extensions
-- where name = 'pg_cron'`), which this task's constraints don't allow. So
-- this uses the fallback named in the task instead: a cheap probabilistic
-- sweep piggybacked on check_rate_limit's own writes, keeping the table
-- self-maintaining without introducing a new scheduling mechanism.
--
-- If pg_cron does turn out to be available/preferred later, this can be
-- swapped for `select cron.schedule('rl-cleanup', '*/15 * * * *', $$delete
-- from rate_limit_buckets where window_start < now() - interval '2
-- hours'$$);` — the index below benefits that path too.
create index if not exists idx_rate_limit_buckets_window_start on rate_limit_buckets (window_start);

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

  -- ~1% of calls also sweep buckets whose window closed well in the past.
  -- Fixed 2-hour cutoff, not tied to this call's own p_window_seconds — a
  -- bucket is only safe to delete once EVERY caller's window has closed,
  -- and the longest window any caller in this app uses today is 3600s
  -- (1 hour: signin-email hourly, signup, redeem); 2 hours gives a full
  -- window of headroom past that so a still-relevant bucket for some other
  -- caller is never swept out from under it, including if a future caller
  -- picks a longer window without this function's cutoff being revisited.
  if random() < 0.01 then
    delete from rate_limit_buckets
    where window_start < v_now - interval '2 hours';
  end if;

  return v_count <= p_max_count;
end;
$$;
