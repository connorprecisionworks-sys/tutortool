"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { WEEKDAY_LABELS } from "@/lib/recurring-sessions";
import { formatCents } from "@/lib/money";
import type { RecurringSessionFormResult } from "@/app/tutor/sessions/recurring/actions";
import type { Tables } from "@/lib/database.types";

type Client = Tables<"clients">;
type Service = Tables<"services">;

const initialState: RecurringSessionFormResult = {};
const NO_SERVICE = "";

export function RecurringSessionForm({
  clients,
  services,
  action,
  onSuccessPath,
}: {
  clients: Client[];
  services: Service[];
  action: (prev: RecurringSessionFormResult, formData: FormData) => Promise<RecurringSessionFormResult>;
  onSuccessPath: string;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(NO_SERVICE);
  const [duration, setDuration] = useState(60);
  const [ongoing, setOngoing] = useState(true);

  const [state, formAction, pending] = useActionState(async (prev: RecurringSessionFormResult, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      // push() alone — a trailing router.refresh() here races push() and
      // can clobber the navigation; see the note in app/accept-terms/actions.ts.
      router.push(onSuccessPath);
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="client_id">Student</Label>
        <Select id="client_id" name="client_id" defaultValue={clients[0]?.id ?? ""}>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.student_name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="service_id">Service (optional)</Label>
        <Select
          id="service_id"
          name="service_id"
          value={serviceId}
          onChange={(e) => {
            const value = e.target.value;
            setServiceId(value);
            const service = services.find((s) => s.id === value);
            if (service) setDuration(service.duration_minutes);
          }}
        >
          <option value={NO_SERVICE}>None — bill at the student&apos;s hourly rate</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatCents(s.price_cents)}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="weekday">Day of the week</Label>
          <Select id="weekday" name="weekday" defaultValue="2">
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="start_time">Start time</Label>
          <Input id="start_time" name="start_time" type="time" defaultValue="16:00" required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="duration_minutes">Duration (minutes)</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min="1"
            step="1"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <Label htmlFor="travel_minutes">Travel time (minutes)</Label>
          <Input id="travel_minutes" name="travel_minutes" type="number" min="0" step="1" defaultValue={0} />
        </div>
      </div>

      <div>
        <Label htmlFor="location">Location (optional)</Label>
        <Input id="location" name="location" />
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-semibold">Series dates</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="start_date">Starting</Label>
            <Input id="start_date" name="start_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ongoing}
                onChange={(e) => setOngoing(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Ongoing — no end date
            </label>
            {!ongoing && (
              <Input id="end_date" name="end_date" type="date" className="mt-2" required={!ongoing} />
            )}
          </div>
        </div>
        <FieldHint>
          Upcoming sessions are generated automatically about {8} weeks ahead and keep rolling forward as time
          passes.
        </FieldHint>
      </div>

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !clients.length}>
          {pending ? "Creating…" : "Create recurring session"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
