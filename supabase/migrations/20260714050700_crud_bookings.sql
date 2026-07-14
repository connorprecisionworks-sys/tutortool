-- Full-CRUD pass, part 4: cancel a confirmed booking (tutor side).
--
-- booking_status already defined 'cancelled' back in P9 but nothing ever
-- set it — decline_booking only covers 'requested' -> 'declined'. A
-- CONFIRMED booking (already created its session) needs its own path so
-- the tutor can call it off without touching the session it created —
-- that session still goes through the normal session CRUD (edit/delete),
-- which already knows how to keep a draft invoice in sync or refuse a
-- billed one.

create function cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;

  update bookings
  set status = 'cancelled'
  where id = p_booking_id and tutor_id = v_tutor_id and status = 'confirmed';

  if not found then
    raise exception 'Booking not found or not confirmed.';
  end if;
end;
$$;

revoke execute on function cancel_booking(uuid) from public;
grant execute on function cancel_booking(uuid) to authenticated;
