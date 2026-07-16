"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { redeemInviteAction, type RedeemInviteResult } from "@/app/parent/actions";

const initialState: RedeemInviteResult = {};

export function RedeemInviteForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [state, formAction, pending] = useActionState(redeemInviteAction, initialState);

  return (
    <form action={formAction} className="mx-auto flex max-w-sm flex-col gap-3">
      <div>
        <Label htmlFor="code">Student Code</Label>
        <Input
          id="code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. A7BX92K"
          className="text-center uppercase tracking-widest"
          required
        />
      </div>
      {state.error && <p className="text-sm text-text">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Linking…" : "Link my child"}
      </Button>
    </form>
  );
}
