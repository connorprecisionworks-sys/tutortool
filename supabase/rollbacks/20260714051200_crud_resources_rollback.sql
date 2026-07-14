-- Rollback for 20260714051200_crud_resources.sql

drop trigger if exists resources_prevent_type_change_trigger on resources;
drop function if exists resources_prevent_type_change();
drop policy if exists "resources_update_own" on resources;
