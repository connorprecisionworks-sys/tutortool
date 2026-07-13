import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border px-6 sm:px-10">
        <span className="text-sm font-semibold tracking-tight">TutorTool</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <div className="max-w-lg space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            The back office for independent tutors.
          </h1>
          <p className="text-text-secondary">
            Set rates per family, log sessions and travel, invoice through Stripe, and let
            reminders chase late payments — so you just tutor.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/signup/tutor">
            <Button>I&apos;m a tutor</Button>
          </Link>
          <Link href="/signup/parent">
            <Button variant="secondary">I&apos;m a parent</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
