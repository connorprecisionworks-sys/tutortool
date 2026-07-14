-- Rollback for 20260714021957_p8_resources.sql

drop policy if exists "resources_delete_own" on resources;
drop policy if exists "resources_insert_own" on resources;
drop policy if exists "resources_select_parent" on resources;
drop policy if exists "resources_select_own" on resources;

drop index if exists resources_student_id_idx;
drop index if exists resources_tutor_id_idx;

drop table if exists resources;

drop type if exists resource_type;

-- Deliberately NOT deleting the 'resources' storage bucket here: Supabase
-- blocks direct `delete from storage.buckets` ("Direct deletion from
-- storage tables is not allowed. Use the Storage API instead."). If a full
-- rollback needs the bucket gone too, remove it via the Storage API/
-- dashboard (Storage -> resources -> delete bucket) as a separate manual
-- step — leaving an empty private bucket behind is harmless.
