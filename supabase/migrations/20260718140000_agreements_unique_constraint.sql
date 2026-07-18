-- Code review found that backfillSignupAgreement (lib/legal/gate.ts) could
-- be called twice for one signup consent event — the winning and losing
-- request of a concurrent-insert race both call it, and it had no way to
-- know a row already existed. Rather than patch each call site with an
-- existence check (more races), make the insert itself idempotent: a given
-- user accepting a given (terms_version, privacy_version) pair is
-- inherently a single event, so a duplicate insert is either the same race
-- landing twice or a redundant re-submit — both should silently no-op, not
-- create a second row in what's documented as an immutable legal audit
-- record.
alter table agreements
  add constraint agreements_unique_version_accept unique (auth_user_id, terms_version, privacy_version);
