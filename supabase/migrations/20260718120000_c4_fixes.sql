-- Fixes from code review of C4:
--
-- 1. New services always inserted at sort_order=0 (the column default),
--    which combined with "order by sort_order, created_at" meant a newly
--    added service could land mid-list instead of appending at the end
--    the way the old pure-created_at ordering always guaranteed. A
--    BEFORE INSERT trigger assigns the next sort_order automatically —
--    always current-max-plus-one for that tutor — so app code never has
--    to (and can't accidentally forget to) set it at create time.
--
-- 2. moveServiceAction's JS-side rewrite loop issued one UPDATE per row
--    with no transaction — a failure partway through left some rows on
--    the new order and others stale, and nothing enforced "swap two
--    services for the SAME tutor" beyond the app code's own .eq()
--    filters. Replaced with one SECURITY DEFINER function that does the
--    whole read-swap-renumber-write cycle inside a single implicit
--    transaction (one function call = atomic), and re-derives its own
--    tutor scope from current_tutor_id() rather than trusting an
--    RLS-scoped client update loop.
create or replace function assign_service_sort_order()
returns trigger
language plpgsql
as $$
begin
  select coalesce(max(sort_order) + 1, 0) into new.sort_order
  from services
  where tutor_id = new.tutor_id;
  return new;
end;
$$;

create trigger services_assign_sort_order
  before insert on services
  for each row
  execute function assign_service_sort_order();

create function move_service(p_service_id uuid, p_direction text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id uuid := current_tutor_id();
  v_ids uuid[];
  v_index integer;
  v_swap_index integer;
begin
  if v_tutor_id is null then
    raise exception 'Not authorized.';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'Invalid direction.';
  end if;

  select array_agg(id order by sort_order, created_at) into v_ids
  from services
  where tutor_id = v_tutor_id;

  v_index := array_position(v_ids, p_service_id);
  if v_index is null then
    raise exception 'Service not found.';
  end if;

  v_swap_index := case when p_direction = 'up' then v_index - 1 else v_index + 1 end;
  if v_swap_index < 1 or v_swap_index > array_length(v_ids, 1) then
    return; -- already at that end of the list — a no-op, not an error
  end if;

  update services set sort_order = v_index - 1 where id = v_ids[v_swap_index];
  update services set sort_order = v_swap_index - 1 where id = v_ids[v_index];
end;
$$;

revoke execute on function move_service(uuid, text) from public;
grant execute on function move_service(uuid, text) to authenticated;
