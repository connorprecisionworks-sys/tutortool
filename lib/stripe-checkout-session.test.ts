import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createInvoiceCheckoutSession } from "@/lib/stripe-checkout-session";
import { isStripeConfigured, getStripe, getStripeAccountStatus } from "@/lib/stripe/client";

vi.mock("@/lib/stripe/client", () => ({
  isStripeConfigured: vi.fn(),
  getStripe: vi.fn(),
  getStripeAccountStatus: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  appUrl: vi.fn(() => "https://app.example.com"),
}));

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcImpl = Record<string, (args: unknown) => RpcResult>;

const baseInvoice = {
  id: "inv_1",
  status: "sent",
  stripe_invoice_id: null,
  total_cents: 5000,
  tutors: { stripe_account_id: "acct_123" },
  clients: { payer_email: "client@example.com", student_name: "Alex" },
};

function makeSupabase(invoice: unknown, rpcImpl: RpcImpl) {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: invoice, error: null }),
        }),
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      const impl = rpcImpl[name];
      if (!impl) return { data: null, error: null };
      return impl(args);
    },
  } as unknown as SupabaseClient;
  return { supabase, rpcCalls };
}

function makeFakeStripe() {
  return {
    checkout: {
      sessions: {
        create: vi.fn(),
        expire: vi.fn(),
      },
    },
  };
}

describe("createInvoiceCheckoutSession", () => {
  beforeEach(() => {
    vi.mocked(isStripeConfigured).mockReturnValue(true);
    vi.mocked(getStripeAccountStatus).mockResolvedValue({ chargesEnabled: true, detailsSubmitted: true });
  });

  it("happy path: mints a session and calls writeBack with its id/url", async () => {
    const fakeStripe = makeFakeStripe();
    fakeStripe.checkout.sessions.create.mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });
    vi.mocked(getStripe).mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>);

    const { supabase, rpcCalls } = makeSupabase(baseInvoice, {
      claim_invoice_checkout_session_lock: () => ({ data: "2026-01-01T00:00:00Z", error: null }),
      release_invoice_checkout_session_lock: () => ({ data: null, error: null }),
    });
    const writeBack = vi.fn().mockResolvedValue({});

    const result = await createInvoiceCheckoutSession(supabase, "inv_1", writeBack);

    expect(result).toEqual({});
    expect(writeBack).toHaveBeenCalledWith({ id: "cs_1", url: "https://checkout.stripe.com/cs_1" });
    expect(rpcCalls.some((c) => c.name === "claim_invoice_checkout_session_lock")).toBe(true);
  });

  it("lease already held: returns the retry error and never calls Stripe", async () => {
    const fakeStripe = makeFakeStripe();
    vi.mocked(getStripe).mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>);

    const { supabase } = makeSupabase(baseInvoice, {
      claim_invoice_checkout_session_lock: () => ({ data: null, error: null }),
    });
    const writeBack = vi.fn();

    const result = await createInvoiceCheckoutSession(supabase, "inv_1", writeBack);

    expect(result).toEqual({
      error: "A payment link is already being generated for this invoice — try again in a moment.",
    });
    expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("claim rpc errors: returns the try-again error and never calls Stripe", async () => {
    const fakeStripe = makeFakeStripe();
    vi.mocked(getStripe).mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>);

    const { supabase } = makeSupabase(baseInvoice, {
      claim_invoice_checkout_session_lock: () => ({ data: null, error: { message: "connection reset" } }),
    });
    const writeBack = vi.fn();

    const result = await createInvoiceCheckoutSession(supabase, "inv_1", writeBack);

    expect(result).toEqual({ error: "Couldn't generate a payment link right now — try again in a moment." });
    expect(fakeStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("Stripe create throws: returns the error and releases the lease with the claimed timestamp", async () => {
    const fakeStripe = makeFakeStripe();
    fakeStripe.checkout.sessions.create.mockRejectedValue(new Error("stripe down"));
    vi.mocked(getStripe).mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>);

    const { supabase, rpcCalls } = makeSupabase(baseInvoice, {
      claim_invoice_checkout_session_lock: () => ({ data: "2026-01-01T00:00:00Z", error: null }),
      release_invoice_checkout_session_lock: () => ({ data: null, error: null }),
    });
    const writeBack = vi.fn();

    const result = await createInvoiceCheckoutSession(supabase, "inv_1", writeBack);

    expect(result).toEqual({ error: "stripe down" });
    const releaseCall = rpcCalls.find((c) => c.name === "release_invoice_checkout_session_lock");
    expect(releaseCall?.args).toEqual({ p_invoice_id: "inv_1", p_claimed_at: "2026-01-01T00:00:00Z" });
  });

  it("session.url falsy: returns {} without calling writeBack, still releases the lease", async () => {
    const fakeStripe = makeFakeStripe();
    fakeStripe.checkout.sessions.create.mockResolvedValue({ id: "cs_2", url: null });
    vi.mocked(getStripe).mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>);

    const { supabase, rpcCalls } = makeSupabase(baseInvoice, {
      claim_invoice_checkout_session_lock: () => ({ data: "2026-01-01T00:00:00Z", error: null }),
      release_invoice_checkout_session_lock: () => ({ data: null, error: null }),
    });
    const writeBack = vi.fn();

    const result = await createInvoiceCheckoutSession(supabase, "inv_1", writeBack);

    expect(result).toEqual({});
    expect(writeBack).not.toHaveBeenCalled();
    const releaseCall = rpcCalls.find((c) => c.name === "release_invoice_checkout_session_lock");
    expect(releaseCall?.args).toEqual({ p_invoice_id: "inv_1", p_claimed_at: "2026-01-01T00:00:00Z" });
  });

  it("writeBack errors: returns that error, still releases the lease", async () => {
    const fakeStripe = makeFakeStripe();
    fakeStripe.checkout.sessions.create.mockResolvedValue({ id: "cs_3", url: "https://checkout.stripe.com/cs_3" });
    vi.mocked(getStripe).mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>);

    const { supabase, rpcCalls } = makeSupabase(baseInvoice, {
      claim_invoice_checkout_session_lock: () => ({ data: "2026-01-01T00:00:00Z", error: null }),
      release_invoice_checkout_session_lock: () => ({ data: null, error: null }),
    });
    const writeBack = vi.fn().mockResolvedValue({ error: "db write failed" });

    const result = await createInvoiceCheckoutSession(supabase, "inv_1", writeBack);

    expect(result).toEqual({ error: "db write failed" });
    const releaseCall = rpcCalls.find((c) => c.name === "release_invoice_checkout_session_lock");
    expect(releaseCall?.args).toEqual({ p_invoice_id: "inv_1", p_claimed_at: "2026-01-01T00:00:00Z" });
  });

  it("never-throws hardening: a rejected release rpc does not leak past the finally block", async () => {
    const fakeStripe = makeFakeStripe();
    fakeStripe.checkout.sessions.create.mockRejectedValue(new Error("stripe down"));
    vi.mocked(getStripe).mockReturnValue(fakeStripe as unknown as ReturnType<typeof getStripe>);

    const { supabase } = makeSupabase(baseInvoice, {
      claim_invoice_checkout_session_lock: () => ({ data: "2026-01-01T00:00:00Z", error: null }),
      release_invoice_checkout_session_lock: () => {
        throw new Error("network blip");
      },
    });
    const writeBack = vi.fn();

    await expect(createInvoiceCheckoutSession(supabase, "inv_1", writeBack)).resolves.toEqual({
      error: "stripe down",
    });
  });

  it("not configured: short-circuits before ever claiming the lease", async () => {
    vi.mocked(isStripeConfigured).mockReturnValue(false);
    const { supabase, rpcCalls } = makeSupabase(baseInvoice, {});
    const writeBack = vi.fn();

    const result = await createInvoiceCheckoutSession(supabase, "inv_1", writeBack);

    expect(result).toEqual({});
    expect(rpcCalls.length).toBe(0);
  });
});
