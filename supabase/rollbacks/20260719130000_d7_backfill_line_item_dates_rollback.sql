-- No-op by design: this migration only reformats existing text (a data
-- backfill, not a schema change), and the prior 'Mon DD, YYYY' text was
-- never captured anywhere to restore — nor would restoring it be
-- desirable, since it was the bug D4 was fixing. If this ever needs to be
-- undone, regenerate the old format the same way this migration generated
-- the new one: `to_char(s.occurred_on, 'Mon DD, YYYY')` in place of
-- `to_char(s.occurred_on, 'FMMM/FMDD/YYYY')`.
select 1;
