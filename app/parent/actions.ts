"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireParent } from "@/lib/auth/parent";

export interface RedeemInviteResult {
  error?: string;
}

export async function redeemInviteAction(
  _prev: RedeemInviteResult,
  formData: FormData
): Promise<RedeemInviteResult> {
  await requireParent();
  const supabase = await createClient();

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return { error: "Enter an invite code." };

  const { error } = await supabase.rpc("redeem_invite", { p_code: code });
  if (error) return { error: error.message };

  revalidatePath("/parent");
  return {};
}
