"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, FieldHint } from "@/components/ui/input";
import { formatCents, dollarsToCents } from "@/lib/money";
import { createPackageAction, type PackageFormResult } from "@/app/tutor/packages/actions";
import type { Tables } from "@/lib/database.types";

const initialState: PackageFormResult = {};
const NO_SERVICE = "";
const GENERAL = "";
type DiscountType = "none" | "percent" | "amount";

export function PackageForm({
  clients,
  services,
  mostCommonServiceId = null,
}: {
  clients: Tables<"clients">[];
  services: Tables<"services">[];
  mostCommonServiceId?: string | null;
}) {
  const router = useRouter();
  // Defaults to a real student when the tutor has one — general packages
  // skip invoicing entirely and activate with a full balance immediately,
  // so that's too consequential a choice to default to silently.
  const [clientId, setClientId] = useState(clients[0]?.id ?? GENERAL);
  // Prefill to the tutor's most-used service, but only if it's still an
  // active, selectable option — a since-deactivated/deleted service must
  // not get silently defaulted back in.
  const [serviceId, setServiceId] = useState(
    mostCommonServiceId && services.some((s) => s.id === mostCommonServiceId) ? mostCommonServiceId : NO_SERVICE
  );
  const [customPrice, setCustomPrice] = useState("");
  // Kept as strings so clearing the field to retype doesn't get forced back
  // to "0" mid-edit (Number("") === 0, which fights a controlled input).
  const [totalSessionsInput, setTotalSessionsInput] = useState("4");
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountPercentInput, setDiscountPercentInput] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  // "Touched" once the tutor types their own name directly — after that we
  // never overwrite it, even if student/service/session-count keep changing.
  const [nameTouched, setNameTouched] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const totalSessions = Number(totalSessionsInput) || 0;
  const discountPercent = Number(discountPercentInput) || 0;

  const [state, formAction, pending] = useActionState(async (prev: PackageFormResult, formData: FormData) => {
    const result = await createPackageAction(prev, formData);
    if (result.invoiceId) {
      router.push(`/tutor/invoices/${result.invoiceId}`);
      router.refresh();
    } else if (result.packageId) {
      router.push("/tutor/packages");
      router.refresh();
    }
    return result;
  }, initialState);

  const selectedService = services.find((s) => s.id === serviceId);
  const pricePerSessionCents = selectedService ? selectedService.price_cents : dollarsToCents(Number(customPrice) || 0);

  const selectedClient = clients.find((c) => c.id === clientId);
  const serviceLabel = selectedService ? selectedService.name : "Session";
  const derivedName = selectedClient
    ? `${selectedClient.student_name} — ${totalSessions}× ${serviceLabel}`
    : `${totalSessions}× ${serviceLabel}`;
  const nameValue = nameTouched ? nameInput : derivedName;

  const { subtotalCents, discountCents, totalCents } = useMemo(() => {
    const subtotal = pricePerSessionCents * totalSessions;
    let discount = 0;
    if (discountType === "percent") {
      discount = Math.round((subtotal * Math.min(100, Math.max(0, discountPercent))) / 100);
    } else if (discountType === "amount") {
      discount = dollarsToCents(Number(discountAmount) || 0);
    }
    discount = Math.min(discount, subtotal);
    return { subtotalCents: subtotal, discountCents: discount, totalCents: subtotal - discount };
  }, [pricePerSessionCents, totalSessions, discountType, discountPercent, discountAmount]);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <Label htmlFor="client_id">Student</Label>
        <Select
          id="client_id"
          name="client_id"
          value={clientId}
          // E5 (build-queue.md): this form is create-only (no edit prop).
          autoFocus
          onChange={(e) => {
            const value = e.target.value;
            setClientId(value);
            // General-page visibility is a deliberate, per-submission choice
            // — don't let a stale checked state from an earlier "General"
            // selection silently carry back in if the tutor toggles away
            // and back before submitting.
            if (value !== GENERAL) setIsPublic(false);
          }}
        >
          <option value={GENERAL}>Any student (general package)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.student_name}
            </option>
          ))}
        </Select>
        <FieldHint>
          {clientId === GENERAL
            ? "Not tied to one family — any student can draw sessions from it."
            : "Only this student's sessions can draw from it."}
        </FieldHint>
      </div>

      <div>
        <Label htmlFor="service_id">Service (optional)</Label>
        <Select id="service_id" name="service_id" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value={NO_SERVICE}>None — custom pricing</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {formatCents(s.price_cents)}/session
            </option>
          ))}
        </Select>
        <FieldHint>Sessions logged against this package default to this service. Its price sets the per-session rate below.</FieldHint>
      </div>

      {!selectedService && (
        <div>
          <Label htmlFor="custom_price_per_session">Price per session ($)</Label>
          <Input
            id="custom_price_per_session"
            name="custom_price_per_session"
            type="number"
            min="0"
            step="0.01"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            required
          />
        </div>
      )}

      <div>
        <Label htmlFor="name">Package name</Label>
        <Input
          id="name"
          name="name"
          value={nameValue}
          onChange={(e) => {
            setNameInput(e.target.value);
            setNameTouched(true);
          }}
          placeholder="e.g. 4-Session Package"
          required
        />
      </div>

      <div>
        <Label htmlFor="total_sessions">Total sessions</Label>
        <Input
          id="total_sessions"
          name="total_sessions"
          type="number"
          min="1"
          max="365"
          step="1"
          value={totalSessionsInput}
          onChange={(e) => setTotalSessionsInput(e.target.value)}
          required
        />
      </div>

      <div className="border-t border-border pt-6">
        <h2 className="mb-4 text-sm font-semibold">Discount (optional)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="discount_type">Type</Label>
            <Select
              id="discount_type"
              name="discount_type"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as DiscountType)}
            >
              <option value="none">No discount</option>
              <option value="percent">Percent off</option>
              <option value="amount">Amount off</option>
            </Select>
          </div>
          {discountType === "percent" && (
            <div>
              <Label htmlFor="discount_percent">Percent off (%)</Label>
              <Input
                id="discount_percent"
                name="discount_percent"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="0"
                value={discountPercentInput}
                onChange={(e) => setDiscountPercentInput(e.target.value)}
              />
            </div>
          )}
          {discountType === "amount" && (
            <div>
              <Label htmlFor="discount_amount">Amount off ($)</Label>
              <Input
                id="discount_amount"
                name="discount_amount"
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mirrors create_package's discount math (supabase/migrations/20260719140000_d8_packages_upgrade.sql)
          — subtotal × session count, clamp discount to [0, subtotal], round percent. Keep both in sync. */}
      <div className="rounded-lg border border-border bg-surface-sunken px-4 py-3 text-sm">
        <div className="flex justify-between text-text-secondary">
          <span>Subtotal ({totalSessions || 0} × {formatCents(pricePerSessionCents)})</span>
          <span className="tabular-nums">{formatCents(subtotalCents)}</span>
        </div>
        {discountCents > 0 && (
          <div className="mt-1 flex justify-between text-text-secondary">
            <span>Discount</span>
            <span className="tabular-nums">−{formatCents(discountCents)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between text-base font-semibold text-text">
          <span>Total</span>
          <span className="tabular-nums">{formatCents(totalCents)}</span>
        </div>
      </div>

      {clientId === GENERAL && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_public"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Show on my public page
        </label>
      )}

      {state.error && <p className="text-sm text-text">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : clientId === GENERAL ? "Create package" : "Create package & build invoice"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
