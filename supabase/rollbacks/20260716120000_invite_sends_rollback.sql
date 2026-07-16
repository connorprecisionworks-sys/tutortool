-- Rollback for 20260716120000_invite_sends.sql

revoke execute on function log_invite_send(uuid, text, text, text) from authenticated;
drop function if exists log_invite_send(uuid, text, text, text);

drop policy if exists "invite_sends_select_own" on invite_sends;
drop table if exists invite_sends;
