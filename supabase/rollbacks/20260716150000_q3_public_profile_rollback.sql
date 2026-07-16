-- Rollback for 20260716150000_q3_public_profile.sql

revoke execute on function get_public_tutor_profile(text) from anon;
revoke execute on function get_public_tutor_profile(text) from authenticated;
drop function if exists get_public_tutor_profile(text);

drop index if exists tutors_handle_lower_idx;

alter table tutors
  drop column if exists show_prices,
  drop column if exists show_bio,
  drop column if exists is_public,
  drop column if exists subjects,
  drop column if exists bio,
  drop column if exists handle;
