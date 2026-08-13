/**
 * End-to-end SMS smoke test.
 *
 *   npx tsx scripts/sms-smoke-test.ts +15551234567
 *   npx tsx scripts/sms-smoke-test.ts +15551234567 --template offset_3
 *   npx tsx scripts/sms-smoke-test.ts +15551234567 --dry
 *
 * Checks the whole chain in the order it can fail, and stops at the first
 * broken link rather than reporting a vague "didn't send":
 *
 *   1. env vars present and shaped right
 *   2. destination number normalizes to E.164
 *   3. the real reminder template renders
 *   4. encoding + segment count + what this send actually costs
 *   5. Twilio accepts it
 *   6. Twilio's own delivery status a few seconds later
 *
 * Step 6 is the one that matters and the one people skip. Twilio returning
 * 201 means "queued", NOT "delivered" — an unregistered or unverified number
 * gets a 201 and then fails silently at the carrier. This polls the message
 * back until it reaches a terminal state, so a green run means a handset
 * actually buzzed.
 */
import { readFileSync } from "node:fs";
import { countSmsSegments, isSmsConfigured, maskPhone, normalizePhoneToE164, toGsm7 } from "../lib/sms";
import { SYSTEM_EMAIL_TEMPLATES } from "../lib/email-templates";
import { interpolateTemplate } from "../lib/reminders";

// Next.js loads .env.local itself; a standalone script doesn't. Parsing it
// here beats adding dotenv as a dependency for six lines of work.
function loadEnvLocal() {
  try {
    for (const raw of readFileSync(".env.local", "utf-8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // No .env.local — fall through; the config check below reports it properly.
  }
}
loadEnvLocal();

const COST_PER_SEGMENT = 0.0125; // Twilio $0.0083 + ~$0.004 carrier pass-through

const args = process.argv.slice(2);
const to = args.find((a) => !a.startsWith("--"));
const dry = args.includes("--dry");
const templateKey = args[args.indexOf("--template") + 1] ?? "session_reminder";

const ok = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m: string) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const info = (m: string) => console.log(`    \x1b[2m${m}\x1b[0m`);

function die(m: string): never {
  bad(m);
  process.exit(1);
}

async function main() {
  console.log("\n\x1b[1mSlate SMS smoke test\x1b[0m\n");

  // 1 ── configuration
  if (!isSmsConfigured()) {
    bad("TWILIO_* env vars missing");
    info("Need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env.local");
    process.exit(1);
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  if (!sid.startsWith("AC")) die(`TWILIO_ACCOUNT_SID should start with "AC", got "${sid.slice(0, 4)}..."`);
  if (!/^\+[1-9]\d{7,14}$/.test(from)) die(`TWILIO_PHONE_NUMBER must be E.164 (+15551234567), got "${from}"`);
  ok(`config present — sending from ${from}`);

  // 2 ── destination
  if (!to) die("No destination number. Usage: npx tsx scripts/sms-smoke-test.ts +15551234567");
  const dest = normalizePhoneToE164(to);
  if (!dest) die(`"${to}" doesn't normalize to E.164`);
  ok(`destination ${maskPhone(dest)}`);

  // 3 ── render the real template, not a toy string
  const tpl = SYSTEM_EMAIL_TEMPLATES.find((t) => t.key === templateKey);
  if (!tpl) die(`No template "${templateKey}". Try: ${SYSTEM_EMAIL_TEMPLATES.map((t) => t.key).join(", ")}`);
  const rendered = interpolateTemplate(
    { subject: tpl.defaultSubject, body: tpl.defaultBody },
    {
      student: "Maya",
      tutor: "Connor Dore",
      when: "Thursday, August 14 at 4:00 PM",
      amount: "$420.00",
      due_date: "August 20",
      link: "slate.com/i/a3f9c2e81b4d6079fe23",
    }
  );
  ok(`template "${templateKey}" rendered`);

  // 4 ── encoding and what it costs
  const raw = rendered.body;
  const clean = toGsm7(raw);
  const before = countSmsSegments(raw);
  const after = countSmsSegments(clean);

  console.log("");
  console.log(`  \x1b[2m┌\x1b[0m ${clean}`);
  console.log("");

  if (before.encoding !== after.encoding) {
    ok(`sanitizer saved you money: ${before.encoding} → ${after.encoding}`);
    info(`would have been ${before.segments} segment(s) at ${before.encoding} — forced by ${JSON.stringify(before.offenders)}`);
  }
  const line = `${after.encoding}, ${after.units} units, ${after.segments} segment(s), $${(after.segments * COST_PER_SEGMENT).toFixed(4)}`;
  if (after.segments > 1) {
    bad(`${line}  ← over one segment, this costs ${after.segments}x`);
    if (after.offenders.length) info(`non-GSM-7 characters remain: ${JSON.stringify(after.offenders)}`);
    else info(`${after.units} units, limit is 160 for a single GSM-7 segment. Shorten it.`);
  } else {
    ok(line);
  }

  if (dry) {
    console.log("\n  \x1b[2m--dry: stopping before send\x1b[0m\n");
    return;
  }

  // 5 ── hand it to Twilio
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: dest, From: from, Body: clean }),
  });
  const payload = (await res.json()) as { sid?: string; code?: number; message?: string; status?: string };

  if (!res.ok) {
    bad(`Twilio rejected it — HTTP ${res.status}, code ${payload.code}`);
    info(payload.message ?? "(no message)");
    const hints: Record<number, string> = {
      21608: "Trial account: the destination must be a VERIFIED number. Add it in Console → Phone Numbers → Verified Caller IDs.",
      21606: "That From number can't send SMS. Buy an SMS-capable number.",
      21610: "This number replied STOP. It's unsubscribed at the carrier until they text START.",
      21211: "Destination number isn't valid E.164.",
      30034: "Unregistered 10DLC. Finish A2P registration, or move to a toll-free number.",
      63007: "From number not found on this account — check TWILIO_PHONE_NUMBER.",
    };
    if (payload.code && hints[payload.code]) info(`→ ${hints[payload.code]}`);
    process.exit(1);
  }
  ok(`accepted by Twilio — ${payload.sid} (status: ${payload.status})`);

  // 6 ── the step that actually proves delivery
  console.log("\n  \x1b[2mpolling delivery status...\x1b[0m");
  const terminal = new Set(["delivered", "undelivered", "failed", "sent"]);
  let status = payload.status ?? "queued";
  let errorCode: number | null = null;

  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${payload.sid}.json`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    const m = (await poll.json()) as { status?: string; error_code?: number };
    status = m.status ?? status;
    errorCode = m.error_code ?? null;
    info(`${((i + 1) * 2).toString().padStart(2)}s — ${status}`);
    if (terminal.has(status)) break;
  }

  console.log("");
  if (status === "delivered") {
    ok("DELIVERED — a handset actually received this. The pipeline works.");
  } else if (status === "sent") {
    ok("sent — carrier accepted it. Toll-free often stops reporting here; check the phone.");
  } else if (status === "undelivered" || status === "failed") {
    bad(`${status.toUpperCase()}${errorCode ? ` (error ${errorCode})` : ""}`);
    info("Twilio took it and the carrier refused it. Almost always registration: finish toll-free verification or A2P.");
    process.exit(1);
  } else {
    bad(`still "${status}" after 20s — check the Console's Message Logs.`);
  }
  console.log("");
}

main().catch((e) => {
  bad(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
