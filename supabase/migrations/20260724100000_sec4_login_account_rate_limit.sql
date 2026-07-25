-- QA follow-up: signInAction's rate limiting (sec3) was IP-only. An IP
-- limit stops one source hammering many accounts, but does nothing against
-- credential stuffing from a rotating pool (cheap residential proxies, one
-- request per IP) aimed at a single account — that needs a limiter keyed on
-- the account being targeted, independent of source IP. app/(auth)/actions.ts
-- signInAction now checks both (an email-scoped 5-per-15-min and
-- 20-per-hour bucket, alongside the existing IP bucket) and requires all to
-- pass.
--
-- A fixed-window counter never naturally decrements mid-window, so a
-- legitimate user who mistypes a password once or twice would otherwise
-- carry those failed attempts as a handicap into their next visit even
-- after successfully logging in. reset_rate_limit() gives callers a way to
-- clear a specific bucket on success — check_rate_limit() itself is
-- intentionally only ever check-and-increment (no reset branch inside it)
-- so a caller can't accidentally combine "check" and "clear" into one racy
-- statement.
create or replace function reset_rate_limit(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from rate_limit_buckets where bucket_key = p_key;
end;
$$;

-- Same broad-grant rationale as check_rate_limit (sec3): only ever touches
-- this function's own bookkeeping table, never app data, so anon/
-- authenticated access is safe.
revoke execute on function reset_rate_limit(text) from public;
grant execute on function reset_rate_limit(text) to anon, authenticated;
