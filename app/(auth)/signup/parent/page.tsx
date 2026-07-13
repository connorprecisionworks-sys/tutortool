import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// TODO(connor): full parent signup (invite-code redemption + parent_students
// binding) ships in P6. Until then this is a holding page so the link on the
// landing page and login screen doesn't 404.
export default function ParentSignupPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-xl font-semibold">Parent sign-up is almost ready</h1>
        <p className="text-sm text-text-secondary">
          Your tutor will send you an invite code once this opens up. Check back soon, or ask
          your tutor when it&apos;s ready.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button variant="secondary">Back home</Button>
        </Link>
      </Card>
    </div>
  );
}
