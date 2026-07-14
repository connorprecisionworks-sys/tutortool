-- Rollback for 20260714050700_crud_bookings.sql

revoke execute on function cancel_booking(uuid) from authenticated;
drop function if exists cancel_booking(uuid);
