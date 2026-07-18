-- C4: let a tutor customize their public page's content and arrangement
-- (photo, display name, headline, welcome note, booking CTA label, service
-- order) without re-theming it — Slate typography/accent stay fixed, only
-- content and layout arrangement are tutor-controlled, per the baked-in
-- decision in build-queue.md.

alter table tutors
  add column avatar_path text,
  add column public_display_name text,
  add column headline text,
  add column welcome_note text,
  add column booking_cta_label text not null default 'Book';

-- Explicit ordering for the public page's service list — defaults to 0 for
-- every existing row, which combined with the "order by sort_order,
-- created_at" below preserves today's chronological ordering until a tutor
-- actually reorders something.
alter table services
  add column sort_order integer not null default 0;

-- Same "public bucket, admin-client-only writes, no storage.objects RLS"
-- shape as receipts (B1) is private/admin-only — this one is the opposite
-- half of that pattern: public=true because an avatar has to be viewable
-- by anonymous visitors on /t/[handle] without a signed URL (which expires
-- and would break a page meant to stay shareable indefinitely). Writes
-- still only ever happen through the admin client from
-- uploadAvatarAction (server-side, requireTutor()-gated), never a direct
-- client upload, so no storage.objects policy is needed for writes either.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Widens get_public_tutor_profile (CREATE OR REPLACE, same signature) to
-- surface the new customization fields and order services by the tutor's
-- chosen sort_order instead of always chronological. avatar_path is
-- returned as-is (a storage path, not a URL) — the client builds the public
-- URL via supabase.storage.from('avatars').getPublicUrl(), same division of
-- responsibility as every other path-vs-URL field in this schema (e.g.
-- expenses.receipt_path).
create or replace function get_public_tutor_profile(p_handle text)
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
        'id', s.id,
        'name', s.name,
        'description', s.description,
        'duration_minutes', s.duration_minutes,
        'price_cents', case when v_tutor.show_prices then s.price_cents else null end
      )
      order by s.sort_order, s.created_at
    ),
    '[]'::json
  )
  into v_services
  from services s
  where s.tutor_id = v_tutor.id and s.is_active;

  select bl.token into v_booking_token
  from booking_links bl
  where bl.tutor_id = v_tutor.id
    and bl.status = 'open'
    and bl.student_id is null
    and (bl.service_id is null or exists (
      select 1 from services sv where sv.id = bl.service_id and sv.is_active
    ))
    and (
      bl.mode = 'open_availability'
      or exists (select 1 from booking_link_slots s where s.booking_link_id = bl.id and s.start_ts > now())
    )
  order by bl.created_at desc
  limit 1;

  return json_build_object(
    'found', true,
    'name', coalesce(nullif(btrim(v_tutor.public_display_name), ''), v_tutor.name),
    'avatar_path', v_tutor.avatar_path,
    'headline', v_tutor.headline,
    'bio', case when v_tutor.show_bio then v_tutor.bio else null end,
    'subjects', v_tutor.subjects,
    'welcome_note', v_tutor.welcome_note,
    'booking_cta_label', v_tutor.booking_cta_label,
    'services', v_services,
    'booking_token', v_booking_token
  );
end;
$$;
-- Keeps its existing grant (CREATE OR REPLACE carries it forward).
