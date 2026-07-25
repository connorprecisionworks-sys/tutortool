import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { getClientIp, checkIpRateLimit, checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

function mockHeaders(entries: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(entries) as unknown as Awaited<ReturnType<typeof headers>>);
}

type RpcResult = { data: unknown; error: { message: string } | null };
type RpcImpl = Record<string, (args: unknown) => RpcResult>;

function makeSupabase(rpcImpl: RpcImpl) {
  const rpcCalls: Array<{ name: string; args: unknown }> = [];
  const supabase = {
    rpc: async (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      const impl = rpcImpl[name];
      if (!impl) return { data: null, error: null };
      return impl(args);
    },
  } as unknown as SupabaseClient;
  return { supabase, rpcCalls };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getClientIp", () => {
  it("prefers x-vercel-forwarded-for over the other headers", async () => {
    mockHeaders({
      "x-vercel-forwarded-for": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
      "x-forwarded-for": "3.3.3.3, 4.4.4.4",
    });

    await expect(getClientIp()).resolves.toBe("1.1.1.1");
  });

  it("falls back to x-real-ip when x-vercel-forwarded-for is absent", async () => {
    mockHeaders({
      "x-real-ip": "2.2.2.2",
      "x-forwarded-for": "3.3.3.3, 4.4.4.4",
    });

    await expect(getClientIp()).resolves.toBe("2.2.2.2");
  });

  it("falls back to the first entry of x-forwarded-for when the others are absent", async () => {
    mockHeaders({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" });

    await expect(getClientIp()).resolves.toBe("3.3.3.3");
  });

  it("returns null when nothing resolves and NODE_ENV is production", async () => {
    mockHeaders({});
    vi.stubEnv("NODE_ENV", "production");

    await expect(getClientIp()).resolves.toBeNull();
  });

  it("returns 127.0.0.1 when nothing resolves and NODE_ENV is not production", async () => {
    mockHeaders({});
    vi.stubEnv("NODE_ENV", "development");

    await expect(getClientIp()).resolves.toBe("127.0.0.1");
  });
});

describe("checkIpRateLimit", () => {
  it("fails closed (returns false) when the IP can't be resolved in production, without calling the rpc", async () => {
    mockHeaders({});
    vi.stubEnv("NODE_ENV", "production");
    const { supabase, rpcCalls } = makeSupabase({
      check_rate_limit: () => ({ data: true, error: null }),
    });

    await expect(checkIpRateLimit(supabase, "signup", 5, 60)).resolves.toBe(false);
    expect(rpcCalls.length).toBe(0);
  });
});

describe("checkRateLimit", () => {
  it("fails open (returns true) when the rpc returns an error", async () => {
    const { supabase } = makeSupabase({
      check_rate_limit: () => ({ data: null, error: { message: "db down" } }),
    });

    await expect(checkRateLimit(supabase, "bucket", 5, 60)).resolves.toBe(true);
  });
});

describe("resetRateLimit", () => {
  it("swallows an rpc error without throwing", async () => {
    const { supabase } = makeSupabase({
      reset_rate_limit: () => ({ data: null, error: { message: "db down" } }),
    });

    await expect(resetRateLimit(supabase, "bucket")).resolves.toBeUndefined();
  });
});
