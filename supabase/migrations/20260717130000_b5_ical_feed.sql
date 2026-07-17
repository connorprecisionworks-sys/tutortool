-- B5: keyless calendar sync — a per-tutor secret iCal feed URL a tutor
-- subscribes to from Google/Apple/Outlook. Read-only, one-way (Slate ->
-- calendar): the feed URL's token is a 128-bit random capability, same
-- entropy/shape as booking_links.token (Q2), not a short hand-typed code
-- like tutor_code (Q7) — this is embedded in a URL a calendar app polls
-- unattended, not something a person reads aloud, so it needs the same
-- "unguessable" bar as any other anonymous-access secret in this app. A
-- bare-expression column DEFAULT (not a retry-loop function like
-- generate_tutor_code(), which exists specifically because its much
-- smaller 33^8 keyspace has non-trivial collision odds) is enough here —
-- 2^128 combinations makes a genuine collision astronomically less likely
-- than the retry loop's own bug surface would be worth guarding against;
-- the `unique` constraint is still the real backstop either way.
--
-- Public read goes through a SECURITY DEFINER RPC returning JSON (same
-- get_booking_link_public/get_public_tutor_profile shape), not a route
-- handler reaching for the service-role admin client directly — keeps
-- every anonymous read in this app flowing through the one reviewed
-- pattern instead of introducing a second one. The route handler
-- (app/api/ical/[token]/route.ts) just formats this RPC's JSON into ICS
-- text and sets the content type.

alter table tutors add column ical_token text unique default encode(extensions.gen_random_bytes(16), 'hex');

create function get_ical_feed(p_token text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tutor tutors%rowtype;
  v_sessions json;
begin
  select * into v_tutor from tutors where ical_token = p_token;
  if v_tutor.id is null then
    return json_build_object('found', false);
  end if;

  -- "Upcoming" per the spec — from today forward, capped at 180 days out
  -- (generous relative to B2's 8-week recurring-instance horizon) and 500
  -- rows so the feed stays bounded regardless of how far ahead a tutor's
  -- data happens to reach, same defensive-cap instinct as every other
  -- unbounded-in-principle query in this app. The ORDER BY + LIMIT have to
  -- apply to the raw rows in a subquery, not the same level as json_agg —
  -- an aggregate query with no GROUP BY collapses to one row, so an outer
  -- ORDER BY/LIMIT on ungrouped columns is a syntax error, not just a
  -- no-op (caught by direct SQL testing before this ever reached the app).
  select coalesce(json_agg(row_to_json(t) order by t.occurred_on, t.start_time), '[]'::json)
  into v_sessions
  from (
    select s.id, s.occurred_on, s.start_time, s.duration_minutes, s.location,
           c.student_name, sv.name as service_name
    from sessions s
    join clients c on c.id = s.client_id
    left join services sv on sv.id = s.service_id
    where s.tutor_id = v_tutor.id
      and s.cancelled_at is null
      and s.occurred_on >= current_date
      and s.occurred_on <= current_date + 180
    order by s.occurred_on, s.start_time
    limit 500
  ) t;

  return json_build_object('found', true, 'tutor_name', v_tutor.name, 'sessions', v_sessions);
end;
$$;

-- regenerate_ical_token: the sanctioned "revoke" — a fresh random token
-- immediately makes the old feed URL 404 (get_ical_feed can't find a
-- tutor by a token that no longer exists), with no separate revoke list
-- to maintain.
create function regenerate_ical_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_token text;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  update tutors set ical_token = v_token where id = v_tutor_id;

  return v_token;
end;
$$;

revoke execute on function get_ical_feed(text) from public;
revoke execute on function regenerate_ical_token() from public;

grant execute on function get_ical_feed(text) to anon, authenticated;
grant execute on function regenerate_ical_token() to authenticated;
