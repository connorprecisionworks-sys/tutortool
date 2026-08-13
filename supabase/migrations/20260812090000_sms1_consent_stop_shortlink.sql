-- NOT YET APPLIED.
--
-- SMS1: the three things standing between the SMS build (Q8) and traffic a
-- real carrier will accept.
--
--   1. Consent audit. Q8 captures consent as a tutor-checked box and stores
--      a single boolean. For TCPA that boolean is not evidence — "the tutor
--      said it was fine" is not a defense. What's defensible is *when*
--      consent was given and *what disclosure* was agreed to, so both are
--      now stamped automatically.
--   2. Carrier opt-out. Twilio answers STOP at the carrier and stops
--      delivering, but nothing tells this database, so the app would keep
--      showing an opted-in parent who is in fact unreachable — and keep
--      billing send attempts that go nowhere.
--   3. Short invoice links. A `/invoice/<uuid>` URL is 61 characters of a
--      160-character SMS. More importantly, get_invoice_document authorizes
--      on *session* (tutor or linked parent), so a parent tapping a payment
--      link on their phone while signed out gets "not found" — which makes
--      "invoice with a payment link" unusable over SMS. The token becomes
--      the credential, same shape as booking links (Q2).

-- ---------------------------------------------------------------------------
-- 1. Consent audit
-- ---------------------------------------------------------------------------

alter table clients add column sms_consent_at timestamptz;
alter table clients add column sms_consent_text text;
alter table clients add column sms_opt_out_at timestamptz;

comment on column clients.sms_consent_at is
  'When sms_opt_in last went false->true. Stamped by trigger, never by the app.';
comment on column clients.sms_consent_text is
  'The exact disclosure in force when consent was recorded. Versioned copy, not a pointer, so old records stay meaningful after the wording changes.';
comment on column clients.sms_opt_out_at is
  'When the recipient sent STOP to the carrier. Distinct from a tutor simply unchecking the box: a carrier opt-out must not be reversible from the tutor UI.';

-- The disclosure text lives here as the single source of truth. The app
-- imports the same string (SMS_CONSENT_TEXT in lib/sms.ts) to render the
-- checkbox label, so what the tutor agrees to on screen and what gets
-- stored are the same sentence. If you change one, change both — there is
-- deliberately no runtime check, because a mismatch must not be able to
-- fail a student save.
create function current_sms_consent_text()
returns text
language sql
immutable
as $$
  select 'I confirm this parent gave permission to receive text messages about sessions and invoices.'::text;
$$;

-- A trigger rather than app code because consent is written through two
-- different paths today (create_student's RPC insert, and a plain update in
-- app/tutor/students/actions.ts) and will grow more. Stamping here means no
-- write path can record consent without recording its provenance, including
-- paths that don't exist yet.
create function stamp_sms_consent()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.sms_opt_in then
      new.sms_consent_at := now();
      new.sms_consent_text := current_sms_consent_text();
    end if;
    return new;
  end if;

  -- A carrier STOP is final until the recipient themselves sends START.
  -- Without this guard a tutor could re-check the box and quietly resume
  -- texting someone who explicitly opted out, which is the exact scenario
  -- carriers audit for. record_sms_opt_in below is the only way back.
  if new.sms_opt_in and not old.sms_opt_in and old.sms_opt_out_at is not null then
    raise exception 'This number opted out by replying STOP. They must text START to resume.';
  end if;

  if new.sms_opt_in and not old.sms_opt_in then
    new.sms_consent_at := now();
    new.sms_consent_text := current_sms_consent_text();
  elsif not new.sms_opt_in and old.sms_opt_in then
    -- Keep the historical record; consent that was withdrawn still needs to
    -- be provable for the period it was in force.
    new.sms_consent_at := old.sms_consent_at;
    new.sms_consent_text := old.sms_consent_text;
  end if;

  -- Consent was given for one specific number. If the number changes, the
  -- consent does not follow it. app/tutor/students/actions.ts already does
  -- this in app code; enforcing it here too closes the RPC and any future
  -- write path.
  if new.payer_phone is distinct from old.payer_phone then
    new.sms_opt_in := false;
    new.sms_consent_at := null;
    new.sms_consent_text := null;
    new.sms_opt_out_at := null;
  end if;

  return new;
end;
$$;

create trigger clients_stamp_sms_consent
  before insert or update on clients
  for each row execute function stamp_sms_consent();

-- ---------------------------------------------------------------------------
-- 2. Carrier opt-out (STOP / START)
-- ---------------------------------------------------------------------------

-- Matched on phone number across every tutor, not scoped to one: the person
-- texting STOP is telling the carrier they want no messages from this
-- number, full stop. Honouring it for only the tutor who happened to text
-- them last is both wrong and a violation.
--
-- Called from app/api/webhooks/twilio/route.ts with the service role, which
-- is why there is no grant to anon/authenticated below — a client that could
-- call this could opt out arbitrary numbers.
create function record_sms_opt_out(p_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update clients
  set sms_opt_in = false,
      sms_opt_out_at = now()
  where payer_phone = p_phone;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- START/UNSTOP: clears the carrier block. Deliberately does NOT set
-- sms_opt_in back to true — the recipient re-enabled delivery, but the
-- tutor's record of consent is a separate fact and gets re-affirmed through
-- the normal UI.
create function record_sms_opt_in(p_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update clients
  set sms_opt_out_at = null
  where payer_phone = p_phone;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function record_sms_opt_out(text) from public, anon, authenticated;
revoke execute on function record_sms_opt_in(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Short invoice links
-- ---------------------------------------------------------------------------

alter table invoices add column short_token text unique;

comment on column invoices.short_token is
  'Bearer credential for the public invoice view. 10 random bytes (80 bits) hex-encoded — shorter than the 16-byte booking-link token because every character costs SMS budget, and still far beyond guessing at the rate limit the route enforces.';

-- extensions.gen_random_bytes is fully qualified for the same reason as in
-- Q2 booking links: search_path stays pinned to `public` for SECURITY
-- DEFINER safety, and pgcrypto lives in `extensions`.
create function gen_invoice_short_token()
returns text
language sql
volatile
as $$
  select encode(extensions.gen_random_bytes(10), 'hex');
$$;

update invoices set short_token = gen_invoice_short_token() where short_token is null;

alter table invoices alter column short_token set default gen_invoice_short_token();
alter table invoices alter column short_token set not null;

-- The existing get_invoice_document body, lifted verbatim minus its
-- authorization check, so the two public entry points below cannot drift
-- apart in what they render. Internal only: it performs no authorization of
-- its own and must never be reachable by a client.
create function _invoice_document_payload(p_invoice_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_invoice invoices%rowtype;
  v_tutor tutors%rowtype;
  v_client clients%rowtype;
  v_line_items json;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    return json_build_object('found', false);
  end if;

  select * into v_tutor from tutors where id = v_invoice.tutor_id;
  select * into v_client from clients where id = v_invoice.client_id;

  select coalesce(
    json_agg(
      json_build_object('description', li.description, 'amount_cents', li.amount_cents, 'line_type', li.line_type)
      order by li.created_at
    ),
    '[]'::json
  )
  into v_line_items
  from invoice_line_items li
  where li.invoice_id = p_invoice_id;

  return json_build_object(
    'found', true,
    'invoice', json_build_object(
      'id', v_invoice.id,
      'period_start', v_invoice.period_start,
      'period_end', v_invoice.period_end,
      'status', v_invoice.status,
      'due_date', v_invoice.due_date,
      'sent_at', v_invoice.sent_at,
      'paid_at', v_invoice.paid_at,
      'paid_method', v_invoice.paid_method,
      'subtotal_cents', v_invoice.subtotal_cents,
      'total_cents', v_invoice.total_cents,
      -- Exposed so the public invoice view can offer a Pay button. Only
      -- populated while the invoice is actually payable: a paid or voided
      -- invoice must not keep handing out a live checkout link.
      'stripe_payment_url', case
        when v_invoice.status in ('sent', 'overdue') then v_invoice.stripe_payment_url
        else null
      end
    ),
    'tutor', json_build_object(
      'name', coalesce(nullif(btrim(v_tutor.public_display_name), ''), v_tutor.name),
      'email', v_tutor.email,
      'phone', case when v_tutor.show_phone then v_tutor.phone else null end
    ),
    'client', json_build_object(
      'student_name', v_client.student_name,
      'payer_name', v_client.payer_name,
      'payer_email', v_client.payer_email
    ),
    'line_items', v_line_items
  );
end;
$$;

revoke execute on function _invoice_document_payload(uuid) from public, anon, authenticated;

-- Session-authorized: the owning tutor, or a linked parent once the invoice
-- has left draft. Now delegating the payload — and fixing an authorization
-- hole in the D7 original while we're in here.
--
-- SECURITY FIX (was live from D7 until this migration): the guard read
--
--     if not (v_invoice.tutor_id = current_tutor_id() or (...)) then
--
-- and current_tutor_id() returns NULL for any signed-in user who is not a
-- tutor — every parent, and every account mid-onboarding. `uuid = NULL` is
-- NULL, `NULL or false` is NULL, `not NULL` is NULL, and plpgsql treats a
-- NULL IF condition as false. So the deny branch never ran for those users
-- and the function fell through and returned the document. Any signed-in
-- non-tutor could read ANY invoice by id — student name, amount, and the
-- tutor's email address. Verified by replaying the migration chain against
-- a scratch Postgres and calling it with an unrelated user's JWT claim.
--
-- coalesce(..., false) is what the rest of this codebase already does for
-- exactly this predicate (see create_session in p9_scheduling and
-- q1_services); D7 is the one place it was missed.
create or replace function get_invoice_document(p_invoice_id uuid)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_invoice invoices%rowtype;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    return json_build_object('found', false);
  end if;

  if not coalesce(
    v_invoice.tutor_id = current_tutor_id()
    or (v_invoice.status <> 'draft' and is_parent_of_student(v_invoice.client_id)),
    false
  ) then
    return json_build_object('found', false);
  end if;

  return _invoice_document_payload(p_invoice_id);
end;
$$;

-- Token-authorized: possession of the link is the credential, which is what
-- makes an emailed or texted payment link work for a parent who has never
-- created an account. This is how every invoicing product does it, and the
-- exposure is deliberately bounded:
--   * draft invoices are never reachable, so nothing is public before the
--     tutor decides to send it;
--   * the payload contains no more than the invoice document the parent is
--     entitled to see, and no tutor phone unless they set show_phone;
--   * 80 bits of entropy, and the route rate-limits by IP, so enumeration
--     is not a practical attack.
-- If you would rather require a login, drop this function and the /i route
-- — but then payment links only work for parents who have already signed up.
create function get_invoice_document_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_invoice invoices%rowtype;
begin
  if p_token is null or length(p_token) <> 20 then
    return json_build_object('found', false);
  end if;

  select * into v_invoice from invoices where short_token = p_token;

  if v_invoice.id is null or v_invoice.status = 'draft' then
    return json_build_object('found', false);
  end if;

  return _invoice_document_payload(v_invoice.id);
end;
$$;

revoke execute on function get_invoice_document_by_token(text) from public, anon, authenticated;
grant execute on function get_invoice_document_by_token(text) to anon, authenticated;
