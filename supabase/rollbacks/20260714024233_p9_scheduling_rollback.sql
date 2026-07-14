-- Rollback for 20260714024233_p9_scheduling.sql

drop function if exists decline_booking(uuid);
drop function if exists approve_booking(uuid);
drop function if exists create_booking(uuid, timestamptz, integer);
drop function if exists create_session_for_booking(uuid, uuid, date, time, integer);

drop policy if exists "bookings_select_parent" on bookings;
drop policy if exists "bookings_select_own" on bookings;
drop index if exists bookings_student_id_idx;
drop index if exists bookings_tutor_id_idx;
drop table if exists bookings;

drop type if exists booking_mode;
drop type if exists booking_status;

drop policy if exists "availability_delete_own" on availability;
drop policy if exists "availability_insert_own" on availability;
drop policy if exists "availability_select_parent" on availability;
drop policy if exists "availability_select_own" on availability;
drop index if exists availability_tutor_id_idx;
drop table if exists availability;

alter table clients drop column if exists scheduling_mode;
