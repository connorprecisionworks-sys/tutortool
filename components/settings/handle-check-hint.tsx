import { FieldHint } from "@/components/ui/input";
import type { HandleCheckState } from "@/lib/hooks/use-handle-check";

/**
 * Live format/availability feedback under the handle field (D1), shared by
 * the onboarding wizard and Settings so the five status messages can't
 * drift between the two — only the idle-state copy differs per surface.
 */
export function HandleCheckHint({ handleCheck, idleText }: { handleCheck: HandleCheckState; idleText: string }) {
  return (
    <FieldHint>
      {handleCheck.status === "checking" && "Checking availability…"}
      {handleCheck.status === "available" && "Available."}
      {handleCheck.status === "taken" && handleCheck.message}
      {handleCheck.status === "invalid" && handleCheck.message}
      {handleCheck.status === "error" && handleCheck.message}
      {(handleCheck.status === "idle" || handleCheck.status === "current") && idleText}
    </FieldHint>
  );
}
