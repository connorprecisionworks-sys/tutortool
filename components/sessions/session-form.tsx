"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/input";
import { computeSessionAmountCents, resolveBillTravel, resolveTravelRateCents } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import type { SessionFormResult } from "@/app/tutor/sessions/actions";
import type { Tables } from "@/lib/database.types";

type Client = Tables<"clients">;
type Session = Tables<"sessions">;
type Service = Tables<"services">;
type Package = Tables<"packages">;

const initialState: SessionFormResult = {};
const NO_SERVICE = "";
const NO_PACKAGE = "";

export function SessionForm({
  clients,
  services,
  packages = [],
  tutor,
  session,
  action,
  onSuccessPath,
}: {
  clients: Client[];
  services: Service[];
  packages?: Package[];
  tutor: Tables<"tutors">;
  session?: Session;
  action: (prev: SessionFormResult, formData: FormData) => Promise<SessionFormResult>;
  onSuccessPath: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(session?.client_id ?? clients[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(session?.service_id ?? NO_SERVICE);
  const [packageId, setPackageId] = useState(session?.package_id ?? NO_PACKAGE);
  const [duration, setDuration] = useState(session?.duration_minutes ?? 60);
  const [travel, setTravel] = useState(session?.travel_minutes ?? 0);
  const clientPackages = packages.filter((p) => p.client_id === clientId);

  const [state, formAction, pending] = useActionState(async (prev: SessionFormResult, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result.error) {
      router.push(onSuccessPath);
      router.refresh();
    }
    return result;
  }, initialState);

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedService = services.find((s) => s.id === serviceId);
  // Editing an already-logged session never changes which service it's
  // billed against (see update_session in the Q1 migration) — the picker is
  // create-only; on edit we just show what was picked, read-only. Keyed off
  // service_price_cents rather than service_id: deleting the service nulls
  // service_id via an `on delete set null` FK, but service_price_cents (and
  // the flat billing it drives) survives — session.service_id alone would
  // wrongly read as "no service" and claim hourly billing here.
  const isServicePriced = session ? session.service_price_cents != null : false;
  const lockedServiceName = isServicePriced
    ? (services.find((s) => s.id === session?.service_id)?.name ?? "a service no longer offered")
    : null;

  const isPackageSession = session ? session.package_id != null : Boolean(packageId);

  const preview = useMemo(() => {
    if (!selectedClient || isPackageSession) return null;
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
    const servicePriceCents = session ? session.service_price_cents : (selectedService?.price_cents ?? null);
    const amount = computeSessionAmountCents({
      durationMinutes: duration || 0,
      travelMinutes: travel || 0,
      effectiveRateCents,
      billTravel,
      travelRateCents,
      servicePriceCents,
    });
    return { amount, billTravel };
  }, [selectedClient, selectedService, duration, travel, tutor, session, isPackageSession]);

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

      {(session ? session.package_id != null : clientPackages.length > 0) && (
        <div>
          <Label htmlFor="package_id">Package (optional)</Label>
          {session ? (
            <>
              <input type="hidden" name="package_id" value={session.package_id ?? ""} />
              <p className="flex h-9 items-center text-sm text-text-secondary">
                {packages.find((p) => p.id === session.package_id)?.name ?? "a package no longer available"}
              </p>
            </>
          ) : (
            <>
              <Select
                id="package_id"
                name="package_id"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
              >
                <option value={NO_PACKAGE}>None — bill normally</option>
                {clientPackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.remaining_sessions} left
                  </option>
                ))}
              </Select>
              <FieldHint>Draws down a prepaid package instead of billing this session separately.</FieldHint>
            </>
          )}
        </div>
      )}

      {!isPackageSession && (
      <div>
        <Label htmlFor="service_id">Service (optional)</Label>
        {session ? (
          <>
            <input type="hidden" name="service_id" value={session.service_id ?? ""} />
            <p className="flex h-9 items-center text-sm text-text-secondary">
              {lockedServiceName ?? "None — billed at the student's hourly rate"}
            </p>
          </>
        ) : (
          <>
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
            <FieldHint>Picking a service bills its flat price instead of the hourly rate.</FieldHint>
          </>
        )}
      </div>
      )}

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
            // readOnly, not disabled: the field still needs to submit its
            // value in FormData (the server locks it to the original
            // duration for a service-priced session either way, but a
            // disabled field submits nothing and would fail the "duration
            // required" check before the server even sees it).
            readOnly={isServicePriced}
            className={isServicePriced ? "bg-surface-sunken text-text-secondary" : undefined}
            required
          />
          {isServicePriced && (
            <FieldHint>Locked — {lockedServiceName} bills a flat price regardless of duration.</FieldHint>
          )}
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

      {isPackageSession && (
        <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm text-text-secondary">
          Drawing from a prepaid package — no separate charge.
        </div>
      )}

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
