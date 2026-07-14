-- Full-CRUD pass, part 5: resources gets a real update path (title, and
-- URL for link-type resources) instead of delete-and-re-add only.
--
-- File-type resources still can't have their underlying file replaced
-- in-place through this policy — re-uploading is out of scope here, same
-- as P8's original "immutable" design intent for the storage object
-- itself. What changes is the app layer only ever sends title/url_or_path
-- in the update payload (the storage path for a file-type resource is
-- left untouched by the edit UI); RLS here just re-validates ownership,
-- matching resources_insert_own.

create policy "resources_update_own" on resources
  for update using (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
  ) with check (
    tutor_id in (select id from tutors where auth_user_id = auth.uid())
    and student_id in (
      select id from clients
      where tutor_id in (select id from tutors where auth_user_id = auth.uid())
    )
  );

-- RLS's WITH CHECK only sees the NEW row, so it can't compare against what
-- `type`/`url_or_path` used to be — resources_update_own's ownership check
-- above is necessary but not sufficient. Without this trigger, a raw
-- PostgREST PATCH (not going through updateResourceAction, which never
-- touches `type`) could flip a resource from 'link' to 'file' and set
-- url_or_path to any string, including a guessed path in the shared
-- private 'resources' storage bucket — the download flow's trust model is
-- "row access implies path access" (P8's design comment), so that would
-- serve back whatever object happens to live at that path, regardless of
-- which tutor originally uploaded it.
create function resources_prevent_type_change()
returns trigger
language plpgsql
as $$
begin
  if new.type <> old.type then
    raise exception 'A resource''s type can''t be changed after creation.';
  end if;
  if old.type = 'file' and new.url_or_path <> old.url_or_path then
    raise exception 'A file resource''s storage path can''t be changed directly — remove and re-add it instead.';
  end if;
  return new;
end;
$$;

create trigger resources_prevent_type_change_trigger
  before update on resources
  for each row execute function resources_prevent_type_change();
