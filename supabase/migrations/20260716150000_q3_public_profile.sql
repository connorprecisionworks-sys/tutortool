-- Q3: public tutor page at /t/[handle]. A tutor picks a handle, writes a
-- short bio + subjects, and toggles what's visible; the page shows their
-- active services (with or without prices, per their toggle) and a "Book"
-- button.
--
-- "Book" reuses Q2 as-is rather than inventing a second booking mechanism:
-- it links to the tutor's newest still-open, unassigned booking link
-- (student_id is null) — i.e. the tutor makes their public page bookable
-- by creating an open-ended Booking Link (already fully built in Q2) and
-- leaving "For" set to Open. If none exists, the public page shows a
-- calm "no open times right now" state instead of a dead link. A
-- standing self-serve calendar (book any time inside weekly availability,
-- no pre-set slots) would be a reasonable future enhancement but is a
-- distinct feature from what Q2 built, so it's left out here rather than
-- half-building a third booking surface.
--
-- Public read goes through a SECURITY DEFINER function, same pattern as
-- Q2's get_booking_link_public — never a public SELECT policy on `tutors`
-- itself, since that table also holds standard_rate_cents,
-- stripe_account_id, email, etc. Only the fields intentionally meant to be
-- public are ever returned.

alter table tutors
  add column handle text,
  add column bio text,
  add column subjects text,
  add column is_public boolean not null default false,
  add column show_bio boolean not null default true,
  add column show_prices boolean not null default true;

-- Case-insensitive uniqueness — subsumes a plain case-sensitive unique
-- constraint (which is why the column above has none), since "JaneDoe"
-- and "janedoe" would otherwise collide at the URL (/t/janedoe resolves
-- whichever the query happens to match) without being rejected as
-- duplicates at write time.
create unique index tutors_handle_lower_idx on tutors (lower(handle)) where handle is not null;

create function get_public_tutor_profile(p_handle text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tutor tutors%rowtype;
  v_services json;
  v_booking_token text;
begin
  select * into v_tutor from tutors where lower(handle) = lower(p_handle) and is_public;
  if v_tutor.id is null then
    return json_build_object('found', false);
  end if;

  select coalesce(
    json_agg(
      json_build_object(
        'name', s.name,
        'description', s.description,
        'duration_minutes', s.duration_minutes,
        'price_cents', case when v_tutor.show_prices then s.price_cents else null end
      )
      order by s.created_at
    ),
    '[]'::json
  )
  into v_services
  from services s
  where s.tutor_id = v_tutor.id and s.is_active;

  -- Excludes a link whose service was since deactivated (confirm_booking_link
  -- would reject it anyway — no point surfacing a dead-on-arrival button) and
  -- one whose every offered slot has already passed (nothing in Q2 expires a
  -- link automatically, so an old unused link can otherwise sit at
  -- status='open' indefinitely with only past times left to offer).
  select bl.token into v_booking_token
  from booking_links bl
  where bl.tutor_id = v_tutor.id
    and bl.status = 'open'
    and bl.student_id is null
    and (bl.service_id is null or exists (
      select 1 from services sv where sv.id = bl.service_id and sv.is_active
    ))
    and exists (
      select 1 from booking_link_slots s where s.booking_link_id = bl.id and s.start_ts > now()
    )
  order by bl.created_at desc
  limit 1;

  return json_build_object(
    'found', true,
    'name', v_tutor.name,
    'bio', case when v_tutor.show_bio then v_tutor.bio else null end,
    'subjects', v_tutor.subjects,
    'services', v_services,
    'booking_token', v_booking_token
  );
end;
$$;

revoke execute on function get_public_tutor_profile(text) from public;
grant execute on function get_public_tutor_profile(text) to anon, authenticated;
