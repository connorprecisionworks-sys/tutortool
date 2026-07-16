-- Rollback for 20260716140000_q2_booking_links.sql

revoke execute on function confirm_booking_link(text, uuid, text, text, text) from anon;
revoke execute on function confirm_booking_link(text, uuid, text, text, text) from authenticated;
revoke execute on function get_booking_link_public(text) from anon;
revoke execute on function get_booking_link_public(text) from authenticated;
revoke execute on function cancel_booking_link(uuid) from authenticated;
revoke execute on function create_booking_link(uuid, uuid, integer, timestamptz[]) from authenticated;

drop function if exists confirm_booking_link(text, uuid, text, text, text);
drop function if exists get_booking_link_public(text);
drop function if exists cancel_booking_link(uuid);
drop function if exists create_booking_link(uuid, uuid, integer, timestamptz[]);

drop policy if exists "booking_link_slots_select_own" on booking_link_slots;
drop policy if exists "booking_links_select_own" on booking_links;

-- The two tables reference each other (booking_links.chosen_slot_id ->
-- booking_link_slots, booking_link_slots.booking_link_id -> booking_links),
-- so neither can DROP TABLE first without breaking the other's FK — drop
-- the circular constraint explicitly, then it's a normal child-then-parent
-- drop order.
alter table booking_links drop constraint if exists booking_links_chosen_slot_id_fkey;

drop table if exists booking_link_slots;
drop table if exists booking_links;
