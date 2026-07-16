# SMS reminders — what to know before turning this on

This build wires SMS in behind Twilio env keys (`TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`), same disabled-until-configured
pattern as email/Resend and Stripe elsewhere in this app. No keys were
available during this build, so — like Stripe — this is wired up but
**unexercised against a live Twilio account.** Before flipping it on for
real, read this.

## What you need from Twilio

1. **A Twilio account** (twilio.com) with a funded balance.
2. **A phone number** capable of sending SMS to US numbers — either:
   - A **local (10-digit) number** — cheapest, but subject to A2P 10DLC
     throughput limits (see below) and higher spam-filtering risk once
     you're sending business/transactional texts at any volume.
   - A **toll-free number** — simpler compliance path (toll-free
     verification instead of full A2P 10DLC campaign registration), higher
     default throughput, but toll-free verification can take 1-2+ weeks
     and Twilio/carriers have been tightening toll-free scrutiny too.
   - For a single-tutor or small-scale product like this, toll-free is
     usually the less painful starting point.
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`
   in your environment. That alone makes `isSmsConfigured()` return true
   and lights up the SMS toggle in tutor Settings — nothing else in the
   app needs to change.

## A2P 10DLC registration (US SMS compliance) — do this BEFORE real traffic

If you use a **local** Twilio number to send business SMS in the US, carriers
require **A2P 10DLC registration** or your messages will be filtered,
rate-limited, or blocked outright. This is not optional and not fast:

- **Brand registration**: register your business (EIN, legal name, address)
  with The Campaign Registry via Twilio. One-time, ~same day to a few days.
- **Campaign registration**: register the *use case* for these messages
  (this app's traffic is "Account Notifications" / "Customer Care" —
  invoice and session reminders to a known, consenting recipient list, not
  marketing). Campaign vetting can take a few days to ~2 weeks, longer if
  a carrier flags it for manual review.
- **Ongoing carrier fees**: T-Mobile and others charge small per-message or
  per-campaign fees on top of Twilio's own pricing, billed through Twilio.
- **Throughput limits**: an unregistered/unverified local number is
  extremely rate-limited (a handful of messages/day before carrier
  filtering kicks in) — fine for testing, not for real usage.
- **Toll-free verification** is a separate, lighter-weight process (submit
  business + use-case info, no per-campaign registration) but still
  required for sustained volume and still carrier-reviewed.

**Bottom line: budget 1-3 weeks of lead time for whichever path you pick
before this can carry real production traffic reliably.** Sending before
registering will mostly work in low volume during testing, then start
silently failing/filtering as carriers notice unregistered traffic.

## Cost (Twilio's published US SMS pricing, verify current rates before
budgeting — these move)

- **Outbound SMS**: roughly **$0.0079/segment** (per-message send) on a
  local number, similar ballpark on toll-free, **plus** the carrier fee
  layered on for A2P-registered local numbers (typically low
  single-digit cents per message, varies by carrier).
- **A segment is 160 characters** (GSM-7 encoding) or **70 characters** if
  the message contains any character outside the basic GSM-7 set (emoji,
  curly quotes, most non-Latin scripts) — a longer message gets split into
  multiple segments and billed per segment. Keep reminder templates plain
  ASCII and under ~155 characters to reliably stay at 1 segment; the
  session/invoice reminder templates in this build should be checked
  against that before going live, tutor-edited templates could easily
  drift past it.
- **Phone number rental**: ~$1-2/month for a local number, ~$2/month for
  toll-free.
- **A2P 10DLC campaign fees**: a few dollars/month per registered campaign
  once verified (varies by campaign type and carrier).

At this app's likely volume (a handful of reminders per tutor per week),
monthly SMS cost per active tutor should be well under $5 even with all
the registration overhead — the friction is the one-time registration lead
time, not the marginal per-message cost.

## What this build actually implements

- `lib/sms.ts` — `isSmsConfigured()` / `sendSms()`, mirrors `lib/email.ts`'s
  no-op-and-log-when-unconfigured pattern exactly.
- `tutors.sms_enabled` — a tutor-level toggle, only shown in Settings when
  `isSmsConfigured()` is true (Twilio keys present platform-wide).
- `clients.sms_opt_in` (+ existing `clients.payer_phone`) — captured on the
  student form via a checkbox with explicit consent language, **only
  entered/attested by the tutor**, not a double opt-in flow where the
  parent themselves confirms via a reply text.
- The daily reminder cron sends SMS as an **additional** channel alongside
  email (not a replacement) for both invoice and session reminders, gated
  on all three: Twilio configured + tutor opted in + that specific
  client opted in with a phone number on file.

## TODO(connor) — the compliance gap in this MVP

**The consent captured here is tutor-attested, not recipient-verified.**
The tutor checks a box on the student form saying (in effect) "I have this
parent's consent to text them" — there's no double opt-in step where the
parent's own phone confirms (e.g., replying "YES" to a verification text).
For A2P 10DLC campaign registration, carriers generally want to see
evidence of how consent was actually collected. A tutor's own checkbox is
a reasonable MVP starting point (and is how a lot of small-business tools
handle this in practice — the tutor already has a real relationship with
the parent), but if this scales or a carrier's campaign review pushes back,
the next step is a proper double opt-in: parent enters their own phone
number in their portal and confirms via a one-time SMS reply before
`sms_opt_in` ever flips true. Worth revisiting before real volume.

Also unhandled in this MVP: inbound STOP/START keyword handling (Twilio
handles basic STOP opt-out automatically at the carrier level for a
registered number, but this app doesn't reflect an inbound STOP back onto
`clients.sms_opt_in` — a parent who texts STOP to the Twilio number is
opted out at the network level, but this app's own UI would still show
them as opted in until a tutor manually unchecks it). A Twilio inbound
webhook to sync that status is a reasonable follow-up.
