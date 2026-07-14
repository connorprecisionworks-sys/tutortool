"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { redeemInviteAction, type RedeemInviteResult } from "@/app/parent/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

const initialState: RedeemInviteResult = {};

export function JoinCodeForm({ code }: { code: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: RedeemInviteResult, formData: FormData) => {
    const result = await redeemInviteAction(prev, formData);
    if (!result.error) {
      router.push("/parent");
      router.refresh();
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="code">Invite code</Label>
        <Input
          id="code"
          name="code"
          defaultValue={code}
          placeholder="e.g. A7BXK92"
          className="uppercase"
          required
        />
      </div>
      {state.error && <p className="text-sm text-text">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Joining…" : "Join"}
      </Button>
    </form>
  );
}
