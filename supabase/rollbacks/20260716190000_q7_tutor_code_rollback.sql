-- Rollback for 20260716190000_q7_tutor_code.sql

revoke execute on function merge_pending_student(uuid, uuid) from authenticated;
revoke execute on function confirm_pending_student(uuid) from authenticated;
revoke execute on function redeem_tutor_code(text, text, uuid) from authenticated;
revoke execute on function get_unclaimed_students_for_tutor_code(text) from authenticated;
revoke execute on function get_tutor_name_for_code(text) from anon;
revoke execute on function get_tutor_name_for_code(text) from authenticated;

drop function if exists merge_pending_student(uuid, uuid);
drop function if exists confirm_pending_student(uuid);
drop function if exists redeem_tutor_code(text, text, uuid);
drop function if exists get_unclaimed_students_for_tutor_code(text);
drop function if exists get_tutor_name_for_code(text);

alter table clients drop column if exists pending_parent_review;

alter table tutors drop column if exists tutor_code;
drop function if exists generate_tutor_code();
