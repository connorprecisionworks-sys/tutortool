import { Mark } from "@/components/brand/logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="flex items-center gap-2 px-6 py-6 sm:px-10">
        <Mark className="h-5" />
        <span className="text-sm font-semibold tracking-tight">Slate</span>
      </div>
      <div className="mx-auto flex max-w-lg flex-col px-6 pb-16 pt-6 sm:px-4">{children}</div>
    </div>
  );
}
