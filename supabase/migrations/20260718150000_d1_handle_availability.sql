-- D1: live handle-availability check for the onboarding + settings handle
-- field. tutors_select_own RLS blocks a plain client-side lookup of another
-- tutor's row, so this mirrors the SECURITY DEFINER pattern already used by
-- get_public_tutor_profile / get_tutor_name_for_code — returns only a
-- boolean, never another tutor's data. A handle the calling tutor already
-- owns reports available (re-saving your own handle unchanged must not
-- report itself as taken).
create function is_handle_available(p_handle text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_owner_id uuid;
begin
  select id into v_owner_id from tutors where lower(handle) = lower(p_handle);
  if v_owner_id is null then
    return true;
  end if;
  return v_owner_id in (select id from tutors where auth_user_id = auth.uid());
end;
$$;

revoke execute on function is_handle_available(text) from public;
grant execute on function is_handle_available(text) to authenticated;
