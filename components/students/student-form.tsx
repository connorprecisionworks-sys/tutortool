"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/input";
import { PrivacyPill } from "@/components/ui/privacy-pill";
import { useToast } from "@/components/ui/toast";
import { studentJoinLink } from "@/lib/invite-link";
import {
  RATE_TYPE_LABELS,
  RATE_TYPES_REQUIRING_CUSTOM_RATE,
  type RateType,
} from "@/lib/billing";
import type { StudentFormResult } from "@/app/tutor/students/actions";
import type { Tables } from "@/lib/database.types";

type Client = Tables<"clients">;

const initialState: StudentFormResult = {};

export function StudentForm({
  student,
  action,
  onSuccessPath,
  smsConfigured = false,
}: {
  student?: Client;
  action: (prev: StudentFormResult, formData: FormData) => Promise<StudentFormResult>;
  onSuccessPath: string;
  smsConfigured?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rateType, setRateType] = useState<RateType>((student?.rate_type as RateType) ?? "standard");
  const [state, formAction, pending] = useActionState(async (prev: StudentFormResult, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      // E3 (build-queue.md) — createStudentAction returns the student's
      // freshly-issued code on creation only (never on an edit save, see
      // that action's comment), so this auto-copy fires exactly once, at
      // the "just generated" moment, matching the Resend pattern: "creating
      // a student surfaces its code already copied." The Students list this
      // redirects to still has a manual Copy fallback per row in case the
      // clipboard write below is blocked in this browser context.
      if (result.code) {
        const link = studentJoinLink(result.code);
        try {
          await navigator.clipboard.writeText(link);
          toast("Student added — code copied to clipboard", { variant: "success" });
        } catch {
          toast("Student added — copy its code from the Students list");
        }
      }
      router.push(onSuccessPath);
      router.refresh();
    }
    return result;
  }, initialState);

  const needsCustomRate = RATE_TYPES_REQUIRING_CUSTOM_RATE.includes(rateType);

  return (
    <form action={formAction} className="space-y-6">
      {student && <input type="hidden" name="id" value={student.id} />}

      <div>
        <Label htmlFor="student_name">Student name</Label>
        <Input
          id="student_name"
          name="student_name"
          defaultValue={student?.student_name}
          placeholder="e.g. Maya Chen"
          // E5 (build-queue.md): create-only autofocus.
          autoFocus={!student}
          required
        />
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-1 text-sm font-semibold">Student intake</h2>
        <p className="mb-4 text-xs text-text-tertiary">
          Parent/guardian contact (also used as the billing payer on invoices) and their needs and goals.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="payer_name">Payer name</Label>
            <Input
              id="payer_name"
              name="payer_name"
              defaultValue={student?.payer_name ?? ""}
              placeholder="Parent / guardian"
            />
          </div>
          <div>
            <Label htmlFor="payer_email">Payer email</Label>
            <Input
              id="payer_email"
              name="payer_email"
              type="email"
              defaultValue={student?.payer_email ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="payer_phone">Payer phone</Label>
            <Input id="payer_phone" name="payer_phone" type="tel" defaultValue={student?.payer_phone ?? ""} />
          </div>
        </div>

        {smsConfigured && (
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sms_opt_in"
              defaultChecked={student?.sms_opt_in ?? false}
              className="h-4 w-4 rounded border-border"
            />
            Parent has agreed to receive text reminders at this number
          </label>
        )}

        <div className="mt-4">
          <Label htmlFor="needs_goals">Needs &amp; goals (optional)</Label>
          <Textarea
            id="needs_goals"
            name="needs_goals"
            defaultValue={student?.needs_goals ?? ""}
            rows={3}
            placeholder="Learning goals, challenges, accommodations, or anything else worth knowing."
          />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-semibold">Rate rule</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rate_type">Rate type</Label>
            <Select
              id="rate_type"
              name="rate_type"
              value={rateType}
              onChange={(e) => setRateType(e.target.value as RateType)}
            >
              {Object.entries(RATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <FieldHint>
              Standard uses your default rate from Settings. Pro bono bills $0 and tracks value given.
            </FieldHint>
          </div>
          {needsCustomRate && (
            <div>
              <Label htmlFor="custom_rate_cents">Hourly rate ($)</Label>
              <Input
                id="custom_rate_cents"
                name="custom_rate_cents"
                type="number"
                step="0.01"
                min="0"
                defaultValue={
                  student?.custom_rate_cents != null ? (student.custom_rate_cents / 100).toFixed(2) : ""
                }
                required
              />
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bill_travel">Bill travel</Label>
            <Select
              id="bill_travel"
              name="bill_travel"
              defaultValue={student?.bill_travel === null || student?.bill_travel === undefined ? "default" : student.bill_travel ? "yes" : "no"}
            >
              <option value="default">Use my default</option>
              <option value="yes">Yes, bill travel</option>
              <option value="no">No, don&apos;t bill travel</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="travel_rate_cents">Travel rate override ($/hr, optional)</Label>
            <Input
              id="travel_rate_cents"
              name="travel_rate_cents"
              type="number"
              step="0.01"
              min="0"
              defaultValue={
                student?.travel_rate_cents != null ? (student.travel_rate_cents / 100).toFixed(2) : ""
              }
              placeholder="Same as session rate"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_philanthropic"
            defaultChecked={student?.is_philanthropic ?? false}
            className="h-4 w-4 rounded border-border"
          />
          Tag as community impact (rolls into your value-given total)
        </label>
      </div>

      <div className="border-t border-border pt-6">
        <Label htmlFor="scheduling_mode">Scheduling</Label>
        <Select id="scheduling_mode" name="scheduling_mode" defaultValue={student?.scheduling_mode ?? "message"}>
          <option value="message">Message — I&apos;ll log sessions myself</option>
          <option value="request">Request — parent asks, I approve</option>
          <option value="calendar">Calendar — parent books an open slot</option>
        </Select>
        <FieldHint>
          Request and Calendar let the parent book against your availability (set in Schedule).
        </FieldHint>
      </div>

      <div className="border-t border-border pt-6">
        <Label htmlFor="notes">
          Tutor Notes
          <PrivacyPill shared={false} className="ml-2" />
        </Label>
        <Textarea id="notes" name="notes" defaultValue={student?.notes ?? ""} rows={3} />
        <FieldHint>Private — never shown to parents or students. General notes about this student.</FieldHint>
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : student ? "Save changes" : "Add student"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
