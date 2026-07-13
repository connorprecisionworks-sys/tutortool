"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { computeSessionAmountCents, resolveBillTravel, resolveTravelRateCents } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import type { SessionFormResult } from "@/app/tutor/sessions/actions";
import type { Tables } from "@/lib/database.types";

type Client = Tables<"clients">;
type Session = Tables<"sessions">;

const initialState: SessionFormResult = {};

export function SessionForm({
  clients,
  tutor,
  session,
  action,
  onSuccessPath,
}: {
  clients: Client[];
  tutor: Tables<"tutors">;
  session?: Session;
  action: (prev: SessionFormResult, formData: FormData) => Promise<SessionFormResult>;
  onSuccessPath: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(session?.client_id ?? clients[0]?.id ?? "");
  const [duration, setDuration] = useState(session?.duration_minutes ?? 60);
  const [travel, setTravel] = useState(session?.travel_minutes ?? 0);

  const [state, formAction, pending] = useActionState(async (prev: SessionFormResult, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      router.push(onSuccessPath);
      router.refresh();
    }
    return result;
  }, initialState);

  const selectedClient = clients.find((c) => c.id === clientId);

  const preview = useMemo(() => {
    if (!selectedClient) return null;
    const effectiveRateCents =
      selectedClient.rate_type === "pro_bono"
        ? 0
        : selectedClient.rate_type === "standard"
          ? tutor.standard_rate_cents
          : (selectedClient.custom_rate_cents ?? tutor.standard_rate_cents);
    const billTravel = resolveBillTravel(selectedClient.bill_travel, tutor.bill_travel_default);
    const travelRateCents = billTravel
      ? resolveTravelRateCents(selectedClient.travel_rate_cents, tutor.travel_rate_cents, effectiveRateCents)
      : 0;
    const amount = computeSessionAmountCents({
      durationMinutes: duration || 0,
      travelMinutes: travel || 0,
      effectiveRateCents,
      billTravel,
      travelRateCents,
    });
    return { amount, billTravel };
  }, [selectedClient, duration, travel, tutor]);

  return (
    <form action={formAction} className="space-y-6">
      {session && <input type="hidden" name="id" value={session.id} />}

      <div>
        <Label htmlFor="client_id">Student</Label>
        <Select
          id="client_id"
          name="client_id"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          disabled={!!session}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.student_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="occurred_on">Date</Label>
          <Input
            id="occurred_on"
            name="occurred_on"
            type="date"
            defaultValue={session?.occurred_on ?? new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div>
          <Label htmlFor="start_time">Start time (optional)</Label>
          <Input id="start_time" name="start_time" type="time" defaultValue={session?.start_time ?? ""} />
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
          <Input
            id="travel_minutes"
            name="travel_minutes"
            type="number"
            min="0"
            step="1"
            value={travel}
            onChange={(e) => setTravel(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="location">Location (optional)</Label>
        <Input id="location" name="location" defaultValue={session?.location ?? ""} />
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" defaultValue={session?.notes ?? ""} rows={3} />
      </div>

      {preview && (
        <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Estimated amount</span>
            <span className="font-medium tabular-nums">{formatCents(preview.amount)}</span>
          </div>
          {travel > 0 && !preview.billTravel && (
            <p className="mt-1 text-xs text-text-tertiary">Travel time won&apos;t be billed for this student.</p>
          )}
        </div>
      )}

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !selectedClient}>
          {pending ? "Saving…" : session ? "Save changes" : "Log session"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
